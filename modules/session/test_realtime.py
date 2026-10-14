"""Tests for the realtime whiteboard WebSocket (modules/session/consumers.py)."""
from asgiref.sync import async_to_sync, sync_to_async
from channels.routing import URLRouter
from channels.testing import WebsocketCommunicator
from django.test import TransactionTestCase

from modules.authentication.models import CustomUser
from modules.session.models import Session, Participant
from modules.session.routing import websocket_urlpatterns

application = URLRouter(websocket_urlpatterns)


class BoardConsumerTests(TransactionTestCase):
    """TransactionTestCase: the consumer reads the DB from another thread."""

    def setUp(self):
        self.teacher = CustomUser.objects.create_user("t", "t@cit.edu", "x", role="teacher")
        self.student = CustomUser.objects.create_user("s", "s@cit.edu", "x", role="student", student_id="1")
        self.other = CustomUser.objects.create_user("o", "o@cit.edu", "x", role="student", student_id="2")
        self.session = Session.objects.create(title="Board", created_by=self.teacher, code="ABC234")
        self.participant = Participant.objects.create(user=self.student, session=self.session, can_draw=False)

    # --- helpers -------------------------------------------------------
    async def connect(self, user):
        comm = WebsocketCommunicator(application, f"/ws/board/{self.session.id}/")
        comm.scope["user"] = user
        connected, code = await comm.connect()
        return comm, connected, code

    async def next_of_type(self, comm, kind, timeout=1):
        """Skip presence/other messages until one of `kind` arrives."""
        while True:
            msg = await comm.receive_json_from(timeout=timeout)
            if msg.get("type") == kind:
                return msg

    async def drain(self, comm):
        while not await comm.receive_nothing(timeout=0.1):
            await comm.receive_json_from()

    # --- tests ---------------------------------------------------------
    def test_outsider_and_anonymous_are_rejected(self):
        async def run():
            _, connected, code = await self.connect(self.other)
            self.assertFalse(connected)
            self.assertEqual(code, 4403)

            from django.contrib.auth.models import AnonymousUser
            _, connected, _ = await self.connect(AnonymousUser())
            self.assertFalse(connected)
        async_to_sync(run)()

    def test_teacher_strokes_reach_student_but_not_sender(self):
        async def run():
            teacher, ok1, _ = await self.connect(self.teacher)
            student, ok2, _ = await self.connect(self.student)
            self.assertTrue(ok1 and ok2)
            await self.drain(teacher)
            await self.drain(student)

            await teacher.send_json_to({"type": "broadcast", "event": "stroke",
                                        "payload": {"t": "begin", "x": 0.1, "y": 0.2, "c": "#000", "w": 3, "sid": "999"}})
            msg = await self.next_of_type(student, "broadcast")
            self.assertEqual(msg["event"], "stroke")
            self.assertEqual(msg["payload"]["sid"], str(self.teacher.id))  # spoofed sid replaced
            self.assertTrue(await teacher.receive_nothing(timeout=0.2))     # no echo
            await teacher.disconnect()
            await student.disconnect()
        async_to_sync(run)()

    def test_view_only_student_cannot_draw_until_teacher_allows(self):
        async def run():
            teacher, _, _ = await self.connect(self.teacher)
            student, _, _ = await self.connect(self.student)
            await self.drain(teacher)
            await self.drain(student)

            stroke = {"type": "broadcast", "event": "stroke", "payload": {"t": "begin", "x": 0, "y": 0}}
            await student.send_json_to(stroke)
            self.assertTrue(await teacher.receive_nothing(timeout=0.2))  # dropped

            # teacher grants permission (DB updated by the HTTP API, then broadcast)
            await sync_to_async(Participant.objects.filter(pk=self.participant.pk).update)(can_draw=True)
            await teacher.send_json_to({"type": "broadcast", "event": "perm",
                                        "payload": {"uid": self.student.id, "can": True}})
            perm = await self.next_of_type(student, "broadcast")
            self.assertEqual(perm["event"], "perm")

            await student.send_json_to(stroke)
            msg = await self.next_of_type(teacher, "broadcast")
            self.assertEqual(msg["payload"]["sid"], str(self.student.id))
            await teacher.disconnect()
            await student.disconnect()
        async_to_sync(run)()

    def test_students_cannot_send_teacher_events(self):
        async def run():
            await sync_to_async(Participant.objects.filter(pk=self.participant.pk).update)(can_draw=True)
            teacher, _, _ = await self.connect(self.teacher)
            student, _, _ = await self.connect(self.student)
            await self.drain(teacher)
            await self.drain(student)
            for event, payload in [("perm", {"uid": "all", "can": True}),
                                   ("meta", {"t": "chat", "enabled": False}),
                                   ("stroke", {"t": "clear_all"}),
                                   ("image", {"t": "clear_all"}),
                                   ("unknown", {})]:
                await student.send_json_to({"type": "broadcast", "event": event, "payload": payload})
            self.assertTrue(await teacher.receive_nothing(timeout=0.3))
            await teacher.disconnect()
            await student.disconnect()
        async_to_sync(run)()

    def test_presence_tracks_who_is_online(self):
        async def run():
            teacher, _, _ = await self.connect(self.teacher)
            await teacher.send_json_to({"type": "track", "meta": {"role": "admin-pls"}})
            student, _, _ = await self.connect(self.student)

            state = {}
            while str(self.student.id) not in state:
                state = (await self.next_of_type(teacher, "presence"))["state"]
            self.assertIn(str(self.teacher.id), state)
            self.assertEqual(state[str(self.teacher.id)][0]["role"], "teacher")  # cannot claim a role

            await student.disconnect()
            while str(self.student.id) in state:
                state = (await self.next_of_type(teacher, "presence"))["state"]
            await teacher.disconnect()
        async_to_sync(run)()

    def test_sync_request_is_relayed(self):
        async def run():
            teacher, _, _ = await self.connect(self.teacher)
            student, _, _ = await self.connect(self.student)
            await self.drain(teacher)
            await self.drain(student)
            await student.send_json_to({"type": "broadcast", "event": "sync", "payload": {"t": "request"}})
            msg = await self.next_of_type(teacher, "broadcast")
            self.assertEqual(msg["event"], "sync")
            self.assertEqual(msg["payload"]["sid"], str(self.student.id))
            await teacher.disconnect()
            await student.disconnect()
        async_to_sync(run)()

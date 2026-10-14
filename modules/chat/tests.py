import json

from django.urls import reverse

from modules.core.testing import CollaboardTestCase


class ChatTests(CollaboardTestCase):
    def room_id(self):
        return self.client.get(reverse("session_chat_room", args=[self.session.id])).json()["room_id"]

    def send(self, room_id, text):
        return self.client.post(
            reverse("send_message", args=[room_id]), json.dumps({"content": text}), content_type="application/json"
        )

    def test_participant_can_chat(self):
        self.join(self.student)
        self.client.force_login(self.student)
        room = self.room_id()
        self.assertEqual(self.send(room, "hello").status_code, 200)
        msgs = self.client.get(reverse("chat_messages", args=[room])).json()["messages"]
        self.assertEqual([m["content"] for m in msgs], ["hello"])

    def test_outsider_forbidden(self):
        self.client.force_login(self.other_student)
        self.assertEqual(self.client.get(reverse("session_chat_room", args=[self.session.id])).status_code, 403)

    def test_disabled_chat_blocks_sending(self):
        self.join(self.student)
        self.client.force_login(self.student)
        room = self.room_id()
        self.session.chat_enabled = False
        self.session.save()
        self.assertEqual(self.send(room, "hello").status_code, 403)

    def test_message_length_limit(self):
        self.client.force_login(self.teacher)
        self.assertEqual(self.send(self.room_id(), "x" * 1001).status_code, 400)

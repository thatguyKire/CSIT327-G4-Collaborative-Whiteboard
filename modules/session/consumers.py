"""Realtime whiteboard over WebSockets (Django Channels).

One group per session: ``board_<session_uuid>``. Clients send
``{"type": "broadcast", "event": ..., "payload": {...}}`` and
``{"type": "track", "meta": {...}}``; the server relays broadcasts to everyone
else in the session and pushes ``{"type": "presence", "state": {...}}`` whenever
someone connects, tracks or leaves.

Unlike a public pub/sub channel, the server checks who may join and who may
send what (only users allowed to draw can send strokes, only the teacher can
change permissions, clear the board or toggle chat).
"""
import logging
from collections import defaultdict

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer

from .models import Session, Participant

logger = logging.getLogger(__name__)

# Close codes understood by the browser client (4403 = do not reconnect).
CLOSE_FORBIDDEN = 4403

MAX_MESSAGE_BYTES = 2 * 1024 * 1024  # layer syncs carry a PNG data URL

# Which events need which right. Anything not listed is dropped.
DRAW_EVENTS = {"stroke", "image", "anno"}
TEACHER_EVENTS = {"perm", "meta"}
OPEN_EVENTS = {"sync"}
TEACHER_ONLY_ACTIONS = {"clear_all"}

# Presence lives in process memory, matching the in-memory channel layer.
# {session_id: {channel_name: {"uid": "5", "meta": {...}}}}
PRESENCE = defaultdict(dict)


class BoardConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.session_id = str(self.scope["url_route"]["kwargs"]["session_id"])
        self.group = f"board_{self.session_id}"
        user = self.scope.get("user")
        if user is None or not user.is_authenticated:
            await self.close(code=CLOSE_FORBIDDEN)
            return

        access = await self._load_access(user)
        if access is None:
            await self.close(code=CLOSE_FORBIDDEN)
            return
        self.user_id = str(user.id)
        self.is_teacher, self.can_draw = access

        await self.channel_layer.group_add(self.group, self.channel_name)
        await self.accept()
        PRESENCE[self.session_id][self.channel_name] = {"uid": self.user_id, "meta": {}}
        await self._announce_presence()

    async def disconnect(self, code):
        if not hasattr(self, "user_id"):
            return
        PRESENCE[self.session_id].pop(self.channel_name, None)
        if not PRESENCE[self.session_id]:
            PRESENCE.pop(self.session_id, None)
        await self.channel_layer.group_discard(self.group, self.channel_name)
        await self._announce_presence()

    async def receive(self, text_data=None, bytes_data=None, **kwargs):
        if text_data and len(text_data) > MAX_MESSAGE_BYTES:
            logger.warning("Dropped oversized realtime message from user %s", getattr(self, "user_id", "?"))
            return
        await super().receive(text_data=text_data, bytes_data=bytes_data, **kwargs)

    async def receive_json(self, content, **kwargs):
        if not isinstance(content, dict):
            return
        kind = content.get("type")
        if kind == "track":
            meta = content.get("meta") if isinstance(content.get("meta"), dict) else {}
            # The client cannot claim another identity or role.
            meta = {**meta, "uid": self.user_id, "role": "teacher" if self.is_teacher else "student"}
            entry = PRESENCE[self.session_id].get(self.channel_name)
            if entry is not None:
                entry["meta"] = meta
                await self._announce_presence()
            return
        if kind != "broadcast":
            return

        event = content.get("event")
        payload = content.get("payload")
        if not isinstance(event, str) or not isinstance(payload, dict):
            return
        if not self._allowed(event, payload):
            return
        if "sid" in payload or event in ("stroke", "sync"):
            payload["sid"] = self.user_id  # strokes always belong to the sender

        await self.channel_layer.group_send(self.group, {
            "type": "board.broadcast",
            "sender": self.channel_name,
            "event": event,
            "payload": payload,
        })

    def _allowed(self, event, payload):
        if event in OPEN_EVENTS:
            return True
        if event in TEACHER_EVENTS:
            return self.is_teacher
        if event in DRAW_EVENTS:
            if payload.get("t") in TEACHER_ONLY_ACTIONS:
                return self.is_teacher
            return self.is_teacher or self.can_draw
        return False

    # ----- group message handlers -----

    async def board_broadcast(self, message):
        event, payload = message["event"], message["payload"]
        if event == "perm":
            # Keep this connection's rights in step with the teacher's toggle.
            uid = payload.get("uid")
            if uid is not None and (str(uid) == "all" or str(uid) == self.user_id) and not self.is_teacher:
                self.can_draw = bool(payload.get("can"))
        if message["sender"] == self.channel_name:
            return  # like Supabase `self: false`: never echo to the sender
        await self.send_json({"type": "broadcast", "event": event, "payload": payload})

    async def board_presence(self, message):
        await self.send_json({"type": "presence", "state": self._presence_state()})

    # ----- helpers -----

    def _presence_state(self):
        state = {}
        for entry in PRESENCE.get(self.session_id, {}).values():
            state.setdefault(entry["uid"], []).append(entry["meta"] or {"uid": entry["uid"]})
        return state

    async def _announce_presence(self):
        await self.channel_layer.group_send(self.group, {"type": "board.presence"})

    @database_sync_to_async
    def _load_access(self, user):
        """Return (is_teacher, can_draw), or None if the user may not join."""
        session = Session.objects.filter(id=self.session_id).only("id", "created_by_id").first()
        if session is None:
            return None
        if session.created_by_id == user.id or user.is_staff:
            return True, True
        participant = Participant.objects.filter(session=session, user=user).only("can_draw").first()
        if participant is None:
            return None
        return False, participant.can_draw

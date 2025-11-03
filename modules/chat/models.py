from django.db import models
from django.conf import settings
from modules.session.models import Session


class ChatRoom(models.Model):
    CHAT_TYPES = [
        ("session", "Session Chat"),
        ("group", "Group Chat"),
        ("private", "Private Chat"),
        ("comment", "Comment Thread"),
    ]

    name = models.CharField(max_length=255)
    chat_type = models.CharField(max_length=20, choices=CHAT_TYPES, default="session")
    participants = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name="chat_rooms")

    # Optional link to a session (for session-based chats)
    session = models.ForeignKey(Session, on_delete=models.CASCADE, null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} [{self.chat_type}]"


class Message(models.Model):
    room = models.ForeignKey(ChatRoom, on_delete=models.CASCADE, related_name="messages")
    sender = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    content = models.TextField()
    timestamp = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"[{self.room.name}] {self.sender.username}: {self.content[:30]}"

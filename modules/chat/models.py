from django.db import models
from django.conf import settings
from modules.session.models import Session


class ChatRoom(models.Model):
    CHAT_TYPES = [("session", "Session Chat")]

    name = models.CharField(max_length=255)
    chat_type = models.CharField(max_length=20, choices=CHAT_TYPES, default="session")
    session = models.ForeignKey("session.Session", on_delete=models.CASCADE, null=True, blank=True, related_name="chat_room")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class Message(models.Model):
    room = models.ForeignKey(ChatRoom, on_delete=models.CASCADE, related_name="messages")
    sender = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="chat_messages_sent")
    content = models.TextField(default="", blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["timestamp"]

    def __str__(self):
        return f"[{self.room.name}] {self.sender.username}: {self.content[:30]}"

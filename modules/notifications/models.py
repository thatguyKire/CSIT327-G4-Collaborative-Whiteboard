from django.db import models
from django.conf import settings
from modules.session.models import Session

class Notification(models.Model):
    recipient = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications")
    session = models.ForeignKey(Session, on_delete=models.SET_NULL, null=True, blank=True, related_name="notifications")
    content = models.TextField()
    is_urgent = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    read_at = models.DateTimeField(null=True, blank=True)

    @property
    def is_read(self):
        return self.read_at is not None

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["recipient", "read_at"], name="notif_recipient_read_idx")]

    def __str__(self):
        return f"To {self.recipient_id}: {self.content[:40]}"

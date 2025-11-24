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
        # Prevent exact duplicates
        unique_together = ("recipient", "session", "content", "is_urgent")

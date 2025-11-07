from django.db import models
from django.conf import settings
import uuid

# ==========================
# 🎯 SESSION MODEL
# ==========================
class Session(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=100)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='created_sessions'
    )
    code = models.CharField(max_length=8, unique=True)
    scheduled_for = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    # Snapshot / Save system (CW-23, CW-35)
    snapshot_url = models.URLField(blank=True, null=True)
    is_saved = models.BooleanField(default=False)
    is_offline_available = models.BooleanField(default=False)

    def __str__(self):
        return self.title


# ==========================
# 🧍 PARTICIPANT MODEL
# ==========================
class Participant(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    session = models.ForeignKey(Session, on_delete=models.CASCADE, related_name='participants')
    can_draw = models.BooleanField(default=False)
    joined_at = models.DateTimeField(auto_now_add=True)
    strokes_count = models.PositiveIntegerField(default=0)
    uploads_count = models.PositiveIntegerField(default=0)
    last_active = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.user.username} in {self.session.title}"


# ==========================
# 💬 CHAT MESSAGE MODEL (CW-25)
# ==========================
class ChatMessage(models.Model):
    session = models.ForeignKey(Session, on_delete=models.CASCADE, related_name="messages")
    sender = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    message = models.TextField()
    timestamp = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.sender.username}: {self.message[:30]}"

    class Meta:
        ordering = ['-timestamp']


# ==========================
# 🖼️ UPLOADED FILES / IMAGES (CW-26)
# ==========================
class UploadedFile(models.Model):
    session = models.ForeignKey(Session, on_delete=models.CASCADE, related_name="uploads")
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    file = models.FileField(upload_to='uploads/')
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"File by {self.uploaded_by.username} in {self.session.title}"

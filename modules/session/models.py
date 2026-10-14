from django.db import models
from django.conf import settings
from django.utils.crypto import get_random_string
import uuid

# Unambiguous characters only (no 0/O, 1/I/L) so codes are easy to read aloud.
SESSION_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
SESSION_CODE_LENGTH = 6


def generate_session_code():
    """Return a join code that is not used by any existing session."""
    while True:
        code = get_random_string(SESSION_CODE_LENGTH, SESSION_CODE_ALPHABET)
        if not Session.objects.filter(code=code).exists():
            return code


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
    chat_enabled = models.BooleanField(default=True)  # <-- added
    snapshot_url = models.CharField(max_length=500, blank=True, null=True)  # /media/snapshots/...
    is_archived = models.BooleanField(default=False)
    is_saved = models.BooleanField(default=False)
    is_offline_available = models.BooleanField(default=False)

    class Meta:
        constraints = [
            # Titles only need to be unique per teacher, not across the whole site.
            models.UniqueConstraint(fields=["created_by", "title"], name="unique_session_title_per_owner"),
        ]

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
# Legacy: live chat uses modules.chat.Message. Kept so existing data/migrations stay valid.
# ==========================
class ChatMessage(models.Model):
    session = models.ForeignKey(Session, on_delete=models.CASCADE, related_name="messages")
    sender = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    content = models.TextField(default="", blank=True)  # rename from message
    timestamp = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.sender.username}: {self.content[:30]}"

    class Meta:
        ordering = ['-timestamp']


# ==========================
# 🖼️ UPLOADED FILES / IMAGES (CW-26)
# ==========================
class UploadedFile(models.Model):
    session = models.ForeignKey(Session, on_delete=models.CASCADE, related_name="uploads")
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    file = models.FileField(upload_to='uploads/', max_length=500)
    original_name = models.CharField(max_length=255, blank=True, default="")
    file_url = models.CharField(max_length=500, blank=True, default="")  # /media/session_files/...
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"File by {self.uploaded_by.username} in {self.session.title}"
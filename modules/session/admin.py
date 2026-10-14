from django.contrib import admin
from .models import Session, Participant, UploadedFile


class ParticipantInline(admin.TabularInline):
    model = Participant
    extra = 0
    fields = ("user", "can_draw", "joined_at", "last_active", "strokes_count", "uploads_count")
    readonly_fields = ("joined_at",)


@admin.register(Session)
class SessionAdmin(admin.ModelAdmin):
    list_display = ("title", "code", "created_by", "created_at", "chat_enabled", "is_saved")
    list_filter = ("chat_enabled", "is_saved", "is_archived")
    search_fields = ("title", "code", "created_by__username")
    inlines = [ParticipantInline]


@admin.register(UploadedFile)
class UploadedFileAdmin(admin.ModelAdmin):
    list_display = ("original_name", "session", "uploaded_by", "uploaded_at")
    search_fields = ("original_name", "uploaded_by__username", "session__title")

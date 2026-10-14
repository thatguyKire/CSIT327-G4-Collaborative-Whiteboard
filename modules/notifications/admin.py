from django.contrib import admin
from .models import Notification


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ("recipient", "session", "content", "is_urgent", "created_at", "read_at")
    list_filter = ("is_urgent",)
    search_fields = ("recipient__username", "content")

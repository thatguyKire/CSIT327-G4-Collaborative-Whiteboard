from django.contrib import admin
from .models import ChatRoom, Message

@admin.register(ChatRoom)
class ChatRoomAdmin(admin.ModelAdmin):
    list_display = ("name", "chat_type", "session", "created_at")
    search_fields = ("name", "chat_type")

@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ("room", "sender", "content", "timestamp")
    search_fields = ("sender__username", "content")

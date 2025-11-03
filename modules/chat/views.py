import json
from django.shortcuts import get_object_or_404
from django.http import JsonResponse
from django.contrib.auth.decorators import login_required
from modules.session.models import Session
from .models import ChatRoom, Message


@login_required
def get_or_create_session_chat(request, session_id):
    """Ensure each session has one chat room."""
    session = get_object_or_404(Session, id=session_id)
    chat_room, created = ChatRoom.objects.get_or_create(
        session=session,
        defaults={"name": f"Chat for {session.title}", "chat_type": "session"},
    )
    chat_room.participants.add(request.user)
    return JsonResponse({"room_id": chat_room.id, "created": created})


@login_required
def fetch_messages(request, room_id):
    """Fetch messages for a given chat room."""
    room = get_object_or_404(ChatRoom, id=room_id)
    messages = Message.objects.filter(room=room).select_related("sender").order_by("timestamp")

    data = [
        {"sender": msg.sender.username, "content": msg.content, "timestamp": msg.timestamp.strftime("%H:%M:%S")}
        for msg in messages
    ]
    return JsonResponse({"messages": data})


@login_required
def send_message(request, room_id):
    """Send a message in a chat room."""
    if request.method != "POST":
        return JsonResponse({"error": "POST required"}, status=405)

    try:
        body = json.loads(request.body)
        text = body.get("content", "").strip()
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    if not text:
        return JsonResponse({"error": "Message cannot be empty"}, status=400)

    room = get_object_or_404(ChatRoom, id=room_id)
    msg = Message.objects.create(room=room, sender=request.user, content=text)

    return JsonResponse({
        "sender": msg.sender.username,
        "content": msg.content,
        "timestamp": msg.timestamp.strftime("%H:%M:%S")
    })

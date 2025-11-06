from django.shortcuts import get_object_or_404
from django.http import JsonResponse
from django.contrib.auth.decorators import login_required
from django.views.decorators.http import require_http_methods
from django.utils import timezone
from modules.session.models import Session
from .models import ChatRoom, Message
import json

@login_required
@require_http_methods(["GET"])
def get_or_create_session_chat(request, session_id):
    session = get_object_or_404(Session, id=session_id)
    room, _ = ChatRoom.objects.get_or_create(session=session, defaults={
        "name": f"Chat for {getattr(session, 'title', f'Session {session.id}')}",
        "chat_type": "session",
    })
    room.participants.add(request.user)
    return JsonResponse({"room_id": room.id})

@login_required
@require_http_methods(["GET"])
def fetch_messages(request, room_id):
    room = get_object_or_404(ChatRoom, id=room_id)
    if not room.participants.filter(id=request.user.id).exists():
        return JsonResponse({"error": "Forbidden"}, status=403)
    msgs = Message.objects.filter(room=room).select_related("sender").order_by("id")
    data = []
    for m in msgs:
        ts = getattr(m, "timestamp", None) or getattr(m, "created_at", None) or getattr(m, "created", None)
        ts_str = timezone.localtime(ts).strftime("%H:%M") if ts else ""
        data.append({"id": m.id, "sender": m.sender.username, "content": m.content, "timestamp": ts_str})
    return JsonResponse({"messages": data})

@login_required
@require_http_methods(["POST"])
def send_message(request, room_id):
    room = get_object_or_404(ChatRoom, id=room_id)
    if not room.participants.filter(id=request.user.id).exists():
        return JsonResponse({"error": "Forbidden"}, status=403)
    try:
        body = json.loads(request.body or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)
    content = (body.get("content") or "").strip()
    if not content:
        return JsonResponse({"error": "Message cannot be empty"}, status=400)
    if len(content) > 500:
        return JsonResponse({"error": "Message too long"}, status=400)
    m = Message.objects.create(room=room, sender=request.user, content=content)
    ts = getattr(m, "timestamp", None) or getattr(m, "created_at", None) or getattr(m, "created", None)
    return JsonResponse({
        "id": m.id, "sender": m.sender.username, "content": m.content,
        "timestamp": timezone.localtime(ts).strftime("%H:%M") if ts else "",
    })

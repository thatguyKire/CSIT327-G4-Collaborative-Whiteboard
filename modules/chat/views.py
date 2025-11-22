from django.shortcuts import get_object_or_404
from django.http import JsonResponse
from django.contrib.auth.decorators import login_required
from django.views.decorators.http import require_http_methods
from modules.session.models import Session, Participant
from .models import ChatRoom, Message
import json

def _authorized(user, session: Session):
    return user == session.created_by or Participant.objects.filter(session=session, user=user).exists()

@login_required
@require_http_methods(["GET"])
def get_or_create_session_chat(request, session_id):
    session = get_object_or_404(Session, id=session_id)
    if not _authorized(request.user, session):
        return JsonResponse({"error": "Forbidden"}, status=403)
    session.refresh_from_db()
    if not session.chat_enabled:
        return JsonResponse({"chat_enabled": False}, status=403)
    room, _ = ChatRoom.objects.get_or_create(session=session, defaults={"name": f"Session {session_id} Chat"})
    return JsonResponse({"room_id": room.id, "chat_enabled": True})

@login_required
@require_http_methods(["GET"])
def fetch_messages(request, room_id):
    room = get_object_or_404(ChatRoom, id=room_id)
    session = room.session
    if session and (not _authorized(request.user, session) or not session.chat_enabled):
        return JsonResponse({"chat_enabled": False}, status=403)
    msgs = room.messages.select_related("sender")
    data = [{
        "id": m.id,
        "sender": m.sender.username,
        "content": m.content,
        "timestamp": m.timestamp.strftime("%H:%M"),
    } for m in msgs]
    return JsonResponse({"chat_enabled": True, "messages": data})

@login_required
@require_http_methods(["POST"])
def send_message(request, room_id):
    room = get_object_or_404(ChatRoom, id=room_id)
    session = room.session
    if session and (not _authorized(request.user, session) or not session.chat_enabled):
        return JsonResponse({"chat_enabled": False}, status=403)
    try:
        payload = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Bad JSON"}, status=400)
    content = (payload.get("content") or "").strip()
    if not content:
        return JsonResponse({"error": "Empty"}, status=400)
    if len(content) > 1000:
        return JsonResponse({"error": "Too long"}, status=400)
    msg = Message.objects.create(room=room, sender=request.user, content=content)
    return JsonResponse({
        "chat_enabled": True,
        "message": {
            "id": msg.id,
            "sender": msg.sender.username,
            "content": msg.content,
            "timestamp": msg.timestamp.strftime("%H:%M"),
        }
    })

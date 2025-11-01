import logging
import json
from django.shortcuts import get_object_or_404
from django.http import JsonResponse
from django.contrib.auth.decorators import login_required
from ..models import Session, ChatMessage
from django.http import JsonResponse, HttpResponseBadRequest, HttpResponse, StreamingHttpResponse, FileResponse

logger = logging.getLogger(__name__)

def safe_view(func):
    """Decorator to log exceptions and handle client disconnects (BrokenPipeError)."""
    def wrapper(request, *args, **kwargs):
        try:
            return func(request, *args, **kwargs)
        except BrokenPipeError:
            logger.info("Client disconnected during view %s", func.__name__)
            # Best-effort: return empty response
            return HttpResponse(status=204)
        except Exception:
            logger.exception("Unhandled exception in view %s", func.__name__)
            raise
    return wrapper


@login_required
@safe_view
def chat_messages(request, session_id):
    session = get_object_or_404(Session, id=session_id)
    messages = ChatMessage.objects.filter(session=session).select_related("sender")
    return JsonResponse({"messages": [
        {"sender": m.sender.username, "message": m.message, "timestamp": m.timestamp.strftime("%H:%M:%S")}
        for m in messages
    ]})

@login_required
@safe_view
def send_message(request, session_id):
    body = json.loads(request.body)
    text = body.get("message")
    session = get_object_or_404(Session, id=session_id)
    if text:
        msg = ChatMessage.objects.create(session=session, sender=request.user, message=text)
        return JsonResponse({
            "sender": msg.sender.username,
            "message": msg.message,
            "timestamp": msg.timestamp.strftime("%H:%M:%S")
        })
    return JsonResponse({"error": "Message cannot be empty"}, status=400)

from django.http import JsonResponse
from django.views.decorators.http import require_POST
from django.contrib.auth.decorators import login_required
from django.utils import timezone
from django.shortcuts import get_object_or_404
from ..models import Session, Participant

@login_required
@require_POST
def record_stroke(request, session_id):
    session = get_object_or_404(Session, id=session_id)
    # Ensure user is participant
    participant = Participant.objects.filter(session=session, user=request.user).first()
    if not participant:
        return JsonResponse({"ok": False, "error": "not_participant"}, status=403)
    participant.strokes_count = (participant.strokes_count or 0) + 1
    participant.last_active = timezone.now()
    participant.save(update_fields=["strokes_count", "last_active"])
    return JsonResponse({"ok": True, "strokes": participant.strokes_count})
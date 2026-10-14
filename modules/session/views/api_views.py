from django.contrib.auth.decorators import login_required
from django.db.models import F
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.views.decorators.http import require_POST

from ..models import Session, Participant


@login_required
@require_POST
def record_stroke(request, session_id):
    """Count one finished stroke for the current participant (used by dashboards)."""
    session = get_object_or_404(Session, id=session_id)
    participant = Participant.objects.filter(session=session, user=request.user).first()
    if not participant:
        return JsonResponse({"ok": False, "error": "not_participant"}, status=403)
    if not participant.can_draw:
        return JsonResponse({"ok": False, "error": "view_only"}, status=403)
    Participant.objects.filter(pk=participant.pk).update(
        strokes_count=F("strokes_count") + 1, last_active=timezone.now()
    )
    return JsonResponse({"ok": True})

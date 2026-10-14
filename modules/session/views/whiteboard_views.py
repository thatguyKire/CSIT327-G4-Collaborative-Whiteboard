import logging

from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.shortcuts import render, get_object_or_404, redirect
from django.urls import reverse

from modules.core.decorators import safe_view
from ..models import Session, Participant

logger = logging.getLogger(__name__)


def _whiteboard_context(request, session, *, can_draw, title, back_url):
    return {
        "session": session,
        "session_title": title,
        "snapshot_url": session.snapshot_url or "",
        "can_draw": can_draw,
        "is_teacher": session.created_by == request.user,
        "back_url": back_url,
        "uploads": session.uploads.order_by("uploaded_at"),
    }


@login_required
@safe_view
def whiteboard_view(request, session_id):
    """Teacher (owner) whiteboard. Participants are sent to the student view."""
    session = get_object_or_404(Session, id=session_id)

    if session.created_by != request.user and not request.user.is_staff:
        if Participant.objects.filter(session=session, user=request.user).exists():
            return redirect(reverse("student_whiteboard", kwargs={"session_id": session.id}))
        messages.error(request, "You are not part of this session. Please join with the session code.")
        return redirect(reverse("join_session"))

    return render(request, "session/whiteboard.html", _whiteboard_context(
        request, session,
        can_draw=True,
        title=session.title,
        back_url=reverse("session_list"),
    ))


@login_required
@safe_view
def student_whiteboard_view(request, session_id):
    """Student whiteboard. Only users who joined the session may view it."""
    session = get_object_or_404(Session, id=session_id)

    if session.created_by == request.user:
        return redirect(reverse("whiteboard", kwargs={"session_id": session.id}))

    participant = Participant.objects.filter(session=session, user=request.user).first()
    if not participant:
        messages.error(request, "You are not part of this session. Please join first.")
        return redirect(reverse("join_session"))

    return render(request, "session/whiteboard.html", _whiteboard_context(
        request, session,
        can_draw=participant.can_draw,
        title=session.title,
        back_url=reverse("student_dashboard"),
    ))

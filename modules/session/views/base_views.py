import logging

from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.db import IntegrityError
from django.db.models import Q
from django.shortcuts import render, redirect
from django.urls import reverse
from django.utils import timezone

from modules.authentication.decorators import role_required
from modules.core.decorators import safe_view
from ..models import Session, Participant, generate_session_code

logger = logging.getLogger(__name__)

TITLE_MAX_LENGTH = Session._meta.get_field("title").max_length


@login_required
@role_required(["teacher", "admin"])
@safe_view
def session_list(request):
    """List sessions created by the current user, with optional ?q= search."""
    sessions = Session.objects.filter(created_by=request.user).order_by("-created_at")
    query = (request.GET.get("q") or "").strip()
    if query:
        sessions = sessions.filter(Q(title__icontains=query) | Q(code__icontains=query))
    return render(request, "session/session_list.html", {
        "sessions": sessions,
        "query": query,
    })


@login_required
@role_required(["teacher", "admin"])
@safe_view
def create_session(request):
    """Create a session from POST 'title' and open its whiteboard."""
    if request.method != "POST":
        return redirect(reverse("session_list"))

    title = (request.POST.get("title") or "").strip() or "Untitled Session"
    if len(title) > TITLE_MAX_LENGTH:
        messages.error(request, f"Session title must be at most {TITLE_MAX_LENGTH} characters.")
        return redirect(reverse("session_list"))

    if Session.objects.filter(created_by=request.user, title__iexact=title).exists():
        messages.error(request, f"You already have a session named '{title}'. Please choose a different name.")
        return redirect(reverse("session_list"))

    try:
        session = Session.objects.create(title=title, created_by=request.user, code=generate_session_code())
    except IntegrityError:
        messages.error(request, f"You already have a session named '{title}'. Please choose a different name.")
        return redirect(reverse("session_list"))
    return redirect(reverse("whiteboard", kwargs={"session_id": session.id}))


@login_required
@safe_view
def join_session(request):
    """Join an existing session by its code."""
    if request.method == "POST":
        code = (request.POST.get("code") or "").strip().upper()
        session = Session.objects.filter(code__iexact=code, is_archived=False).first() if code else None
        if not session:
            return render(request, "session/join_session.html", {"error": "Invalid session code", "code": code})
        if session.created_by == request.user:
            return redirect(reverse("whiteboard", kwargs={"session_id": session.id}))
        p, _ = Participant.objects.get_or_create(user=request.user, session=session)
        p.last_active = timezone.now()
        p.save(update_fields=["last_active"])
        return redirect(reverse("student_whiteboard", kwargs={"session_id": session.id}))
    return render(request, "session/join_session.html", {"code": (request.GET.get("code") or "").strip().upper()})


@login_required
@role_required(["teacher", "admin"])
@safe_view
def saved_sessions(request):
    """Sessions of the current teacher that have a saved snapshot."""
    sessions = (
        Session.objects
        .filter(created_by=request.user)
        .exclude(snapshot_url__isnull=True)
        .exclude(snapshot_url="")
        .order_by("-created_at")
    )
    items = [{"id": s.id, "title": s.title, "snapshot_url": s.snapshot_url, "created_at": s.created_at} for s in sessions]
    return render(request, "session/saved_sessions.html", {"items": items})

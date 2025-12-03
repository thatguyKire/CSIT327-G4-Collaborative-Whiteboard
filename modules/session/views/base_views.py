import logging
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.utils.crypto import get_random_string
from django.urls import reverse
from ..models import Session, Participant
from django.utils import timezone
from django.http import JsonResponse, HttpResponseBadRequest, HttpResponse, StreamingHttpResponse, FileResponse
from django.db.models import Q

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
def session_list(request):
    """
    List sessions created by the current user.
    Includes offline availability and live refresh of session states.
    """
    sessions = list(Session.objects.filter(created_by=request.user).order_by("-created_at"))

    # 🔁 Force refresh from DB to ensure new snapshot + offline flags are visible
    for s in sessions:
        s.refresh_from_db()

    # ✅ Optional search support
    query = request.GET.get("q")
    if query:
        sessions = [s for s in sessions if query.lower() in s.title.lower() or query.lower() in s.code.lower()]

    return render(request, "session/session_list.html", {
        "sessions": sessions,
        "query": query or "",
    })


@login_required
@safe_view
def create_session(request):
    """
    Create a new session. Expects POST with 'title'. Redirects to whiteboard on success.
    """
    if request.method == "POST":
        title = (request.POST.get("title") or "Untitled Session").strip()
        code = get_random_string(6).upper()
        try:
            session = Session.objects.create(title=title, created_by=request.user, code=code)
            return redirect(reverse("whiteboard", kwargs={"session_id": session.id}))
        except Exception as e:
            # Check if it's a duplicate title error
            if 'unique constraint' in str(e).lower() or 'already exists' in str(e).lower():
                from django.contrib import messages
                messages.error(request, f"A session with the name '{title}' already exists. Please choose a different name.")
                return redirect(reverse("session_list"))
            # Re-raise if it's a different error
            raise
    return render(request, "session/create_session.html")

@login_required
@safe_view
def join_session(request):
    """Join an existing session by code."""    
    if request.method == "POST":
        code = (request.POST.get("code") or "").strip().upper()
        session = Session.objects.filter(code__iexact=code).first()
        if session:
            p, created = Participant.objects.get_or_create(user=request.user, session=session)
            # Mark the participant as active now (joined or re-joined)
            p.last_active = timezone.now()
            # ensure joined_at is set on create (auto_now_add handles it)
            p.save(update_fields=["last_active"]) 
            return redirect(reverse("student_whiteboard", kwargs={"session_id": session.id}))
        return render(request, "session/join_session.html", {"error": "Invalid session code"})
    return render(request, "session/join_session.html")


@login_required
@safe_view
def saved_sessions(request):
    qs = Session.objects.filter(created_by=request.user).order_by("-id")
    items = []
    for s in qs:
        snap = getattr(s, "snapshot", None)
        snapshot_url = snap.url if snap else getattr(s, "snapshot_url", None)
        items.append({"id": s.id, "title": getattr(s, "title", f"Session {s.id}"), "snapshot_url": snapshot_url})
    return render(request, "session/saved_sessions.html", {"items": items})
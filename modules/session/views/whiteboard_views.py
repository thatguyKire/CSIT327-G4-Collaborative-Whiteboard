import io, time as systime, json, logging
from django.shortcuts import render, get_object_or_404
from django.http import JsonResponse, HttpResponseBadRequest, HttpResponse, StreamingHttpResponse, FileResponse
from django.contrib.auth.decorators import login_required
from django.conf import settings
from supabase import create_client
from ..models import Session, Participant
from django.urls import reverse
from django.contrib import messages
from django.shortcuts import get_object_or_404, redirect

# Use service role server-side only; never send to client
def _server_supabase():
    key = settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_ANON_KEY
    return create_client(settings.SUPABASE_URL, key)

# Remove any use of settings.SUPABASE_KEY; use the helper instead.
supabase = _server_supabase()
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
def whiteboard_view(request, session_id):
    """Display the collaborative whiteboard for a given session (Supabase-powered)."""
    session = get_object_or_404(Session, id=session_id)

    # Determine display title
    display_title = (
        getattr(session, "title", None)
        or getattr(session, "name", None)
        or getattr(session, "code", None)
        or str(session.id)
    )

    # Determine if user can draw
    participant = session.participants.filter(user=request.user).first()
    can_draw = participant.can_draw if participant else (session.created_by == request.user)

    # --- Get snapshot from Supabase Storage ---
    snapshot_url = None
    try:
        sb = _server_supabase()
        bucket = settings.SUPABASE_BUCKET
        file_path = f"{session_id}.png"
        objs = sb.storage.from_(bucket).list(path="")
        if any(obj.get("name") == file_path for obj in objs or []):
            snapshot_url = sb.storage.from_(bucket).get_public_url(file_path)

    except Exception:
        snapshot_url = None

    # Determine Back URL
    back_url = (
        reverse("session_list")
        if request.user == session.created_by
        else reverse("student_dashboard")
    )

    return render(
        request,
        "session/whiteboard.html",
        {
            "session": session,
            "session_title": display_title,
            "snapshot_url": snapshot_url,
            "can_draw": can_draw,
            "back_url": back_url,
            "SUPABASE_URL": settings.SUPABASE_URL,
            "SUPABASE_ANON_KEY": settings.SUPABASE_ANON_KEY,
        },
    )


@login_required
@safe_view
def student_whiteboard_view(request, session_id):
    """
    Student version of the whiteboard.
    Verifies that the user joined the session before granting access.
    """
    session = get_object_or_404(Session, id=session_id)

    # Make sure this user has joined
    participant = Participant.objects.filter(session=session, user=request.user).first()
    if not participant:
        messages.error(request, "You are not part of this session. Please join first.")
        return redirect("join_session")

    # Reuse the same template, but pass a flag
    return render(request, "session/whiteboard.html", {
        "session": session,
        "session_title": f"{session.title} (Student View)",
        "can_draw": participant.can_draw,
    })



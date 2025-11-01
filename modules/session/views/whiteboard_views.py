import io, time as systime, json, logging
from django.shortcuts import render, get_object_or_404
from django.http import JsonResponse, HttpResponseBadRequest, HttpResponse, StreamingHttpResponse, FileResponse
from django.contrib.auth.decorators import login_required
from django.conf import settings
from supabase import create_client
from ..models import Session, Participant
from django.urls import reverse
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib import messages

supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
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
        file_path = f"{session_id}.png"
        bucket = settings.SUPABASE_BUCKET

        # Try fetching the file list (checks if file exists)
        res = supabase.storage.from_(bucket).list(path="")
        if any(obj["name"] == file_path for obj in res):
            snapshot_url = supabase.storage.from_(bucket).get_public_url(file_path)

        # Add cache-buster to prevent old cache images
        if snapshot_url:
            snapshot_url = f"{snapshot_url.split('?')[0]}?v={int(systime.time())}"

    except Exception as e:
        logger.warning(f"⚠️ Snapshot lookup failed for session {session_id}: {e}")
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



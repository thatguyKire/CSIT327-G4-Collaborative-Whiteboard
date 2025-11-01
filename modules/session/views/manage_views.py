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
from django.views.decorators.http import require_POST

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
def delete_session(request, session_id):
    """
    Delete a session (POST). If the model supports soft-delete via is_active,
    mark inactive; otherwise perform hard delete. Enforce ownership/staff.
    """
    session = get_object_or_404(Session, id=session_id)

    # permission check
    if not (request.user == getattr(session, "created_by", None) or request.user.is_staff):
        messages.error(request, "You do not have permission to delete this session.")
        return redirect(reverse("session_list"))

    if request.method != "POST":
        messages.error(request, "Invalid request method.")
        return redirect(reverse("session_list"))

    try:
        # Prefer soft-delete if field exists
        if hasattr(session, "is_active"):
            session.is_active = False
            session.save()
            messages.success(request, f"Session '{getattr(session, 'title', session.id)}' marked inactive.")
        else:
            session.delete()
            messages.success(request, f"Session '{getattr(session, 'title', session.id)}' deleted.")
    except Exception as exc:
        logger.exception("Failed to delete session %s: %s", session_id, exc)
        messages.error(request, "Failed to delete session.")
    return redirect(reverse("session_list"))


@login_required
@require_POST
@safe_view
def toggle_draw_permission(request, user_id):
    """Teacher toggles whether a participant can draw."""
    try:
        data = json.loads(request.body)
        can_draw = data.get("can_draw", False)

        participant = Participant.objects.filter(
            user_id=user_id
        ).select_related("session").first()

        if not participant:
            return JsonResponse({"ok": False, "error": "participant_not_found"}, status=404)

        # ✅ Permission: only the session owner can change this
        if participant.session.created_by != request.user:
            return JsonResponse({"ok": False, "error": "unauthorized"}, status=403)

        participant.can_draw = can_draw
        participant.save(update_fields=["can_draw"])
        return JsonResponse({"ok": True})
    except Exception as e:
        logger.exception("toggle_draw_permission failed: %s", e)
        return JsonResponse({"ok": False, "error": str(e)}, status=500)
    

@login_required
@safe_view
def save_snapshot(request, session_id):
    """
    Uploads a uniquely named snapshot each time (avoids duplicate errors entirely)
    and marks the session as offline-available.
    """
    if request.method != "POST":
        return HttpResponseBadRequest("POST required")

    session = get_object_or_404(Session, id=session_id)

    # Only teacher or staff can save
    if request.user != session.created_by and not request.user.is_staff:
        return JsonResponse({"ok": False, "error": "permission"}, status=403)

    img_file = request.FILES.get("image")
    if not img_file:
        return JsonResponse({"ok": False, "error": "no_image"}, status=400)

    try:
        file_bytes = img_file.read()
        bucket = settings.SUPABASE_BUCKET
        storage = supabase.storage.from_(bucket)

        # ✅ Use unique filename each save
        timestamp = int(systime.time())
        file_path = f"{session_id}_{timestamp}.png"

        # Upload to Supabase
        storage.upload(file_path, file_bytes, {"content-type": "image/png"})

        public_url = storage.get_public_url(file_path)

        # ✅ Update session to point to the latest snapshot and enable offline
        session.snapshot_url = public_url
        session.is_saved = True
        session.is_offline_available = True
        session.save(update_fields=["snapshot_url", "is_saved", "is_offline_available"])

        logger.info(f"✅ Snapshot saved and marked offline: {file_path}")
        return JsonResponse({"ok": True, "url": public_url})

    except Exception as e:
        logger.exception(f"❌ Failed to upload snapshot for session {session_id}: {e}")
        return JsonResponse({"ok": False, "error": str(e)}, status=500)

@login_required
@safe_view
def export_session(request, session_id):
    """
    Example export endpoint. If you produce large binary data, stream it to avoid memory spikes.
    This implementation returns a small placeholder file if no real export exists.
    Replace `payload_bytes` with your actual export generation logic.
    """
    session = get_object_or_404(Session, id=session_id)

    # Placeholder export content (replace with real PNG bytes or other export)
    payload_bytes = (f"Session export for {getattr(session, 'title', session.id)}\n").encode("utf-8")

    def chunker(data, chunk_size=64 * 1024):
        try:
            for i in range(0, len(data), chunk_size):
                yield data[i : i + chunk_size]
        except BrokenPipeError:
            logger.info("Client disconnected while streaming export for session %s", session_id)
            return

    response = StreamingHttpResponse(chunker(payload_bytes), content_type="application/octet-stream")
    response["Content-Disposition"] = f'attachment; filename="session_{session_id}_export.txt"'
    return response

# Optional helper views (useful if you later add routes / templates)
@login_required
@safe_view
def session_detail(request, session_id):
    session = get_object_or_404(Session, id=session_id)
    return render(request, "session/detail.html", {"session": session})


@login_required
@safe_view
def session_manage(request, session_id):
    session = get_object_or_404(Session, id=session_id)
    # Add management logic (participants, settings) here
    return render(request, "session/manage.html", {"session": session})

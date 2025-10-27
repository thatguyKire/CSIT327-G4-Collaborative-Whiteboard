import logging
import io
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.utils.crypto import get_random_string
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.http import JsonResponse, HttpResponseBadRequest, HttpResponse, StreamingHttpResponse, FileResponse
from django.urls import reverse
from django.contrib import messages
from django.utils.text import slugify
from .models import Session, Participant
import time as systime
from django.conf import settings
from supabase import create_client
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
import json


supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)



# optional libs (install qrcode and pillow)
try:
    import qrcode
    from PIL import Image
except Exception:
    qrcode = None
    Image = None

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
    """List sessions created by the current user."""
    sessions = Session.objects.filter(created_by=request.user).order_by("-created_at")
    return render(request, "session/session_list.html", {"sessions": sessions})


@login_required
@safe_view
def create_session(request):
    """
    Create a new session. Expects POST with 'title'. Redirects to whiteboard on success.
    """
    if request.method == "POST":
        title = (request.POST.get("title") or "Untitled Session").strip()
        code = get_random_string(6).upper()
        session = Session.objects.create(title=title, created_by=request.user, code=code)
        return redirect(reverse("whiteboard", kwargs={"session_id": session.id}))
    # GET: show the create form (reuse session_list template or create dedicated form)
    return render(request, "session/create_session.html")


@login_required
@safe_view
def join_session(request):
    """Join an existing session by code."""
    if request.method == "POST":
        code = (request.POST.get("code") or "").strip().upper()
        session = Session.objects.filter(code__iexact=code).first()
        if session:
            Participant.objects.get_or_create(user=request.user, session=session)
            return redirect(reverse("student_whiteboard", kwargs={"session_id": session.id}))
        return render(request, "session/join_session.html", {"error": "Invalid session code"})
    return render(request, "session/join_session.html")



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


@login_required
@safe_view
def save_snapshot(request, session_id):
    """
    Uploads a uniquely named snapshot each time (avoids duplicate errors entirely).
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

        storage.upload(file_path, file_bytes, {"content-type": "image/png"})

        public_url = storage.get_public_url(file_path)

        # ✅ Update session to point to the latest snapshot
        session.snapshot_url = public_url
        session.save(update_fields=["snapshot_url"])

        logger.info(f"✅ Snapshot saved as new version: {file_path}")
        return JsonResponse({"ok": True, "url": public_url})

    except Exception as e:
        logger.exception(f"❌ Failed to upload snapshot for session {session_id}: {e}")
        return JsonResponse({"ok": False, "error": str(e)}, status=500)


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


def _is_owner_or_staff(request, session):
    """Small permission helper used by views below."""
    owner = getattr(session, "created_by", None) or getattr(session, "teacher", None)
    return request.user.is_staff or (owner == request.user)


@login_required
@safe_view
def session_qr(request, session_id):
    """Return QR PNG that encodes the join URL or session code (lazy import)."""
    session = get_object_or_404(Session, id=session_id)
    # prefer a join URL if available
    join_url = request.build_absolute_uri(reverse("whiteboard", kwargs={"session_id": session_id}))
    payload = getattr(session, "code", None) or join_url

    try:
        import qrcode
    except Exception:
        return HttpResponse("qrcode library not installed. Run: pip install qrcode", status=501)

    try:
        img = qrcode.make(payload)
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        buf.seek(0)
        return FileResponse(buf, content_type="image/png")
    except Exception:
        return HttpResponse("Failed to generate QR", status=500)


@login_required
@safe_view
def upload_attachment(request, session_id):
    """
    Accept attachments via POST (field 'file'). Saves under session_files/<session_id>/.
    Returns JSON with saved path/url.
    """
    if request.method != "POST":
        return JsonResponse({"ok": False, "error": "POST required"}, status=400)

    session = get_object_or_404(Session, id=session_id)
    if not _is_owner_or_staff(request, session):
        return JsonResponse({"ok": False, "error": "permission"}, status=403)

    fileobj = request.FILES.get("file")
    if not fileobj:
        return JsonResponse({"ok": False, "error": "no file"}, status=400)

    name = slugify(getattr(fileobj, "name", "attachment"))
    path = f"session_files/{session_id}/{name}"
    # ensure overwrite behaviour: remove if exists
    if default_storage.exists(path):
        default_storage.delete(path)
    saved = default_storage.save(path, ContentFile(fileobj.read()))
    return JsonResponse({"ok": True, "url": default_storage.url(saved)})


@login_required
@safe_view
def export_session_pdf(request, session_id):
    """
    Export the current saved snapshot (or canvas) to a simple PDF.
    Uses Pillow to convert PNG -> PDF. Returns PDF response.
    """
    session = get_object_or_404(Session, id=session_id)
    # use saved snapshot if exists
    path = f"session_snapshots/{session_id}.png"
    if not default_storage.exists(path) and not (hasattr(session, "snapshot") and getattr(session, "snapshot")):
        return HttpResponse("No snapshot available", status=404)

    try:
        if default_storage.exists(path):
            f = default_storage.open(path, "rb")
            img = Image.open(f)
        else:
            f = session.snapshot.open("rb")
            img = Image.open(f)
    except Exception:
        return HttpResponse("Failed to read snapshot", status=500)

    # ensure RGB then convert to PDF in memory
    if img.mode in ("RGBA", "LA"):
        bg = Image.new("RGB", img.size, (255, 255, 255))
        bg.paste(img, mask=img.split()[-1])
        img = bg
    else:
        img = img.convert("RGB")

    buf = io.BytesIO()
    img.save(buf, format="PDF")
    buf.seek(0)
    return FileResponse(buf, as_attachment=True, filename=f"session_{session_id}.pdf", content_type="application/pdf")


@login_required
@safe_view
def duplicate_session(request, session_id):
    """
    Duplicate session record (shallow): copies basic fields and generates new code.
    Copies attachments snapshot file if present.
    """
    session = get_object_or_404(Session, id=session_id)
    if not _is_owner_or_staff(request, session):
        messages.error(request, "You do not have permission to duplicate this session.")
        return redirect(reverse("session_list"))

    # perform shallow copy; adapt field names if your model differs
    data = {}
    for f in ["title", "description", "settings"]:
        if hasattr(session, f):
            data[f] = getattr(session, f)
    data["created_by"] = request.user
    data["code"] = get_random_string(6).upper()
    # create new instance (may need to adjust required fields)
    new = Session.objects.create(**data)

    # copy snapshot file if exists
    src = f"session_snapshots/{session_id}.png"
    dst = f"session_snapshots/{new.id}.png"
    try:
        if default_storage.exists(src):
            with default_storage.open(src, "rb") as sf:
                if default_storage.exists(dst):
                    default_storage.delete(dst)
                default_storage.save(dst, ContentFile(sf.read()))
    except Exception:
        logger.exception("Failed copying snapshot for duplicate session %s", session_id)

    messages.success(request, "Session duplicated.")
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
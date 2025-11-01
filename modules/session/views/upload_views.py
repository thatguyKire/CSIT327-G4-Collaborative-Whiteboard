import logging
import io
import os
from django.shortcuts import get_object_or_404, redirect
from django.contrib.auth.decorators import login_required
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.http import JsonResponse, HttpResponse, FileResponse
from django.urls import reverse
from django.utils.text import slugify
from django.utils.crypto import get_random_string
from django.contrib import messages
from ..models import Session, Participant
from django.conf import settings
from supabase import create_client
supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)


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
            return HttpResponse(status=204)
        except Exception:
            logger.exception("Unhandled exception in view %s", func.__name__)
            raise
    return wrapper


def _is_owner_or_staff(request, session):
    """Small permission helper used by views below."""
    owner = getattr(session, "created_by", None) or getattr(session, "teacher", None)
    return request.user.is_staff or (owner == request.user)


# ==========================
# 📂 FILE UPLOAD HANDLER
# ==========================


@login_required
@safe_view
def upload_attachment(request, session_id):
    """
    Accept attachments via POST (field 'file'). Saves under /media/session_files/<session_id>/
    Teachers can always upload.
    Students can upload only if they have drawing permission.
    """
    if request.method != "POST":
        return JsonResponse({"ok": False, "error": "POST required"}, status=400)

    session = get_object_or_404(Session, id=session_id)

    # ✅ Permission check
    if request.user != session.created_by and not request.user.is_staff:
        participant = session.participants.filter(user=request.user).first()
        if not participant or not participant.can_draw:
            return JsonResponse({"ok": False, "error": "permission_denied"}, status=403)

    fileobj = request.FILES.get("file")
    if not fileobj:
        return JsonResponse({"ok": False, "error": "no_file"}, status=400)

    try:
        # ✅ Ensure folder exists
        upload_dir = os.path.join(settings.MEDIA_ROOT, "session_files", str(session_id))
        os.makedirs(upload_dir, exist_ok=True)

        # ✅ Save file
        file_path = os.path.join("session_files", str(session_id), fileobj.name)
        saved_path = default_storage.save(file_path, ContentFile(fileobj.read()))
        file_url = default_storage.url(saved_path)

        return JsonResponse({"ok": True, "file_url": file_url})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({"ok": False, "error": str(e)}, status=500)


# ==========================
# 🧾 QR GENERATOR
# ==========================
@login_required
@safe_view
def session_qr(request, session_id):
    """Return QR PNG that encodes the join URL or session code (lazy import)."""
    session = get_object_or_404(Session, id=session_id)
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


# ==========================
# 📄 EXPORT SESSION AS PDF
# ==========================
@login_required
@safe_view
def export_session_pdf(request, session_id):
    """Export the saved snapshot to PDF (if available)."""
    session = get_object_or_404(Session, id=session_id)
    path = f"session_snapshots/{session_id}.png"

    if not default_storage.exists(path):
        return HttpResponse("No snapshot available", status=404)

    try:
        with default_storage.open(path, "rb") as f:
            img = Image.open(f)
            if img.mode in ("RGBA", "LA"):
                bg = Image.new("RGB", img.size, (255, 255, 255))
                bg.paste(img, mask=img.split()[-1])
                img = bg
            else:
                img = img.convert("RGB")
    except Exception:
        return HttpResponse("Failed to read snapshot", status=500)

    buf = io.BytesIO()
    img.save(buf, format="PDF")
    buf.seek(0)
    return FileResponse(buf, as_attachment=True, filename=f"session_{session_id}.pdf", content_type="application/pdf")


# ==========================
# 🌀 DUPLICATE SESSION
# ==========================
@login_required
@safe_view
def duplicate_session(request, session_id):
    """Duplicate session record (shallow): copies basic fields and generates new code."""
    session = get_object_or_404(Session, id=session_id)
    if not _is_owner_or_staff(request, session):
        messages.error(request, "You do not have permission to duplicate this session.")
        return redirect(reverse("session_list"))

    # Shallow copy
    data = {}
    for f in ["title", "description", "settings"]:
        if hasattr(session, f):
            data[f] = getattr(session, f)
    data["created_by"] = request.user
    data["code"] = get_random_string(6).upper()
    new = Session.objects.create(**data)

    # Copy snapshot if exists
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

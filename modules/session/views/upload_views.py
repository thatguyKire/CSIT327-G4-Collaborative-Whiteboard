import io
import logging
import os
import time as systime

from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.db.models import F
from django.http import JsonResponse, HttpResponse, FileResponse
from django.shortcuts import get_object_or_404, redirect
from django.urls import reverse
from django.utils import timezone
from django.utils.text import get_valid_filename
from django.conf import settings

from modules.core.decorators import safe_view
from ..models import Session, Participant, UploadedFile, generate_session_code

logger = logging.getLogger(__name__)

MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB
ALLOWED_UPLOAD_TYPES = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".pdf": "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
}
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".webp"}


def _is_owner_or_staff(request, session):
    return request.user.is_staff or session.created_by == request.user


def _storage_path(url):
    """Map a /media/... URL back to its storage path (None for other URLs)."""
    if url and url.startswith(settings.MEDIA_URL):
        return url[len(settings.MEDIA_URL):]
    return None


# ==========================
# 📂 FILE UPLOAD HANDLER
# ==========================
@login_required
@safe_view
def upload_attachment(request, session_id):
    """Accept one attachment via POST field 'file'.

    Teachers can always upload; students only while they have drawing
    permission. Files are stored in MEDIA_ROOT/session_files/<session_id>/.
    """
    if request.method != "POST":
        return JsonResponse({"ok": False, "error": "POST required"}, status=405)

    session = get_object_or_404(Session, id=session_id)

    participant = None
    if not _is_owner_or_staff(request, session):
        participant = session.participants.filter(user=request.user).first()
        if not participant or not participant.can_draw:
            return JsonResponse({"ok": False, "error": "permission_denied"}, status=403)

    fileobj = request.FILES.get("file")
    if not fileobj:
        return JsonResponse({"ok": False, "error": "no_file"}, status=400)
    if fileobj.size > MAX_UPLOAD_BYTES:
        return JsonResponse({"ok": False, "error": "File is larger than 10 MB."}, status=400)

    ext = os.path.splitext(fileobj.name)[1].lower()
    content_type = ALLOWED_UPLOAD_TYPES.get(ext)
    if not content_type:
        return JsonResponse({"ok": False, "error": "Unsupported file type."}, status=400)

    safe_name = get_valid_filename(os.path.basename(fileobj.name)) or f"upload{ext}"
    relative_path = f"session_files/{session_id}/{int(systime.time())}_{safe_name}"
    data = fileobj.read()

    try:
        saved_path = default_storage.save(relative_path, ContentFile(data))
        file_url = default_storage.url(saved_path)
    except Exception as e:
        logger.exception("Upload failed for session %s", session_id)
        return JsonResponse({"ok": False, "error": str(e)}, status=500)

    UploadedFile.objects.create(
        session=session,
        uploaded_by=request.user,
        file=saved_path,
        original_name=fileobj.name[:255],
        file_url=file_url,
    )
    if participant is not None:
        Participant.objects.filter(pk=participant.pk).update(
            uploads_count=F("uploads_count") + 1, last_active=timezone.now()
        )

    return JsonResponse({
        "ok": True,
        "file_url": file_url,
        "name": fileobj.name,
        "is_image": ext in IMAGE_EXTENSIONS,
    })


# ==========================
# 🧾 QR GENERATOR
# ==========================
@login_required
@safe_view
def session_qr(request, session_id):
    """PNG QR code that opens the join page with the session code pre-filled."""
    session = get_object_or_404(Session, id=session_id)
    if not _is_owner_or_staff(request, session):
        return HttpResponse(status=403)
    join_url = request.build_absolute_uri(f"{reverse('join_session')}?code={session.code}")

    try:
        import qrcode
    except ImportError:
        return HttpResponse("qrcode library not installed. Run: pip install qrcode", status=501)

    img = qrcode.make(join_url)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return FileResponse(buf, content_type="image/png")


# ==========================
# 📄 EXPORT SESSION AS PDF
# ==========================
@login_required
@safe_view
def export_session_pdf(request, session_id):
    """Convert the latest saved snapshot to a one-page PDF."""
    session = get_object_or_404(Session, id=session_id)
    if not _is_owner_or_staff(request, session):
        return HttpResponse(status=403)
    snapshot_path = _storage_path(session.snapshot_url)
    if not snapshot_path or not default_storage.exists(snapshot_path):
        return HttpResponse("No snapshot available", status=404)

    try:
        from PIL import Image

        with default_storage.open(snapshot_path, "rb") as f:
            img = Image.open(io.BytesIO(f.read()))
        if img.mode in ("RGBA", "LA"):
            bg = Image.new("RGB", img.size, (255, 255, 255))
            bg.paste(img, mask=img.split()[-1])
            img = bg
        else:
            img = img.convert("RGB")
    except Exception:
        logger.exception("Failed to read snapshot for PDF export (session %s)", session_id)
        return HttpResponse("Failed to read snapshot", status=500)

    buf = io.BytesIO()
    img.save(buf, format="PDF")
    buf.seek(0)
    return FileResponse(buf, as_attachment=True, filename=f"session_{session.code}.pdf", content_type="application/pdf")


# ==========================
# 🌀 DUPLICATE SESSION
# ==========================
@login_required
@safe_view
def duplicate_session(request, session_id):
    """Copy a session's title/settings/snapshot into a new session with a fresh code."""
    session = get_object_or_404(Session, id=session_id)
    if not _is_owner_or_staff(request, session):
        messages.error(request, "You do not have permission to duplicate this session.")
        return redirect(reverse("session_list"))
    if request.method != "POST":
        return redirect(reverse("session_list"))

    base = f"{session.title} (copy)"[:100]
    title, n = base, 2
    while Session.objects.filter(created_by=request.user, title=title).exists():
        suffix = f" (copy {n})"
        title = f"{session.title[:100 - len(suffix)]}{suffix}"
        n += 1

    Session.objects.create(
        title=title,
        created_by=request.user,
        code=generate_session_code(),
        chat_enabled=session.chat_enabled,
        snapshot_url=session.snapshot_url,
        is_saved=session.is_saved,
        is_offline_available=session.is_offline_available,
    )
    messages.success(request, f"Session duplicated as '{title}'.")
    return redirect(reverse("session_list"))

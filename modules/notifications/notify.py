import logging
from django.conf import settings
from django.db import IntegrityError, transaction
from .models import Notification

logger = logging.getLogger(__name__)

try:
    from supabase import create_client
    _sb = None
    SB_URL = getattr(settings, "SUPABASE_URL", None)
    SB_SERVICE_KEY = getattr(settings, "SUPABASE_SERVICE_ROLE_KEY", None)
    if SB_URL and SB_SERVICE_KEY:
        _sb = create_client(SB_URL, SB_SERVICE_KEY)
except Exception:
    _sb = None

def notify(user, content, *, session=None, urgent=False):
    if not user or not content:
        return None
    # Atomic get_or_create (uses unique_together to prevent race duplicates)
    try:
        with transaction.atomic():
            notif, created = Notification.objects.get_or_create(
                recipient=user,
                session=session,
                content=content,
                is_urgent=urgent,
            )
            if not created:
                logger.debug("notify(): duplicate suppressed (id=%s)", notif.id)
                return notif
    except IntegrityError:
        # Another thread created it; fetch existing
        notif = Notification.objects.filter(
            recipient=user, session=session, content=content, is_urgent=urgent
        ).order_by("-created_at").first()
        return notif

    logger.debug("notify(): created id=%s", notif.id)

    if _sb:
        try:
            payload = {
                "recipient_id": int(user.id),
                "content": str(content),
                "is_urgent": bool(urgent),
                "session_id": str(getattr(session, "id")) if session else None,
                "created_at": notif.created_at.isoformat(),
            }
            _sb.table("notifications_notification").insert(payload).execute()
        except Exception as e:
            logger.warning("Supabase mirror failed: %s", e)
    return notif
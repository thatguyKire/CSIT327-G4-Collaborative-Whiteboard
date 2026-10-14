import logging
from datetime import timedelta

from django.utils import timezone

from .models import Notification

logger = logging.getLogger(__name__)

# Identical notifications to the same user within this window are treated as
# accidental double-submits and suppressed.
DUPLICATE_WINDOW = timedelta(seconds=10)


def notify(user, content, *, session=None, urgent=False):
    """Create a notification for ``user`` and return it (or the recent duplicate)."""
    if not user or not content:
        return None

    recent = Notification.objects.filter(
        recipient=user,
        session=session,
        content=content,
        is_urgent=urgent,
        created_at__gte=timezone.now() - DUPLICATE_WINDOW,
    ).first()
    if recent:
        logger.debug("notify(): duplicate suppressed (id=%s)", recent.id)
        return recent

    notif = Notification.objects.create(recipient=user, session=session, content=content, is_urgent=urgent)
    logger.debug("notify(): created id=%s", notif.id)
    return notif

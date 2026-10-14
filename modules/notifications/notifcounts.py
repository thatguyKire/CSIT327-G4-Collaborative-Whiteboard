from .models import Notification


def notif_counts(request):
    user = getattr(request, "user", None)
    unread = 0
    if user and user.is_authenticated:
        unread = Notification.objects.filter(recipient=user, read_at__isnull=True).count()
    return {"notif_unread_count": unread}

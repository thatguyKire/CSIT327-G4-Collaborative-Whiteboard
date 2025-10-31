from django.shortcuts import render
from django.contrib.auth.decorators import login_required

@login_required
def notifications_view(request):
    return render(request, "notifications/notifications.html")

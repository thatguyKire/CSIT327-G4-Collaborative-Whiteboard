from django.shortcuts import render
from django.contrib.auth.decorators import login_required

@login_required
def settings_view(request):
    return render(request, "settings_app/settings.html")

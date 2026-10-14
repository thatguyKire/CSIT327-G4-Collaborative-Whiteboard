from django.shortcuts import redirect
from django.contrib.auth.forms import AuthenticationForm

def landing(request):
    # Redirect root to the login page
    return redirect("auth:login")

def home(request):
    # Legacy path → also go to login
    return redirect("auth:login")


def media(request, path):
    """Serve uploaded files and snapshots from MEDIA_ROOT (read per request)."""
    from django.conf import settings
    from django.views.static import serve
    return serve(request, path, document_root=settings.MEDIA_ROOT)

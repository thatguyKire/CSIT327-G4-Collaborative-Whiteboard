from django.shortcuts import redirect, render
from django.contrib.auth.forms import AuthenticationForm

def _redirect_user_by_role(user):
    role = getattr(user, "role", None)
    # Adjust these URL names to your actual dashboard views
    mapping = {
        "teacher": "teacher_dashboard",
        "admin": "admin_dashboard",
        "student": "student_dashboard",
    }
    target = mapping.get(role)
    if target:
        try:
            return redirect(target)
        except Exception:
            pass
    return redirect("auth:login")  # fallback

def home(request):
    # Legacy route; send to landing (root already serves landing)
    return redirect("landing")

def landing(request):
    if request.user.is_authenticated:
        return _redirect_user_by_role(request.user)
    # Fresh login form instance for modal
    return render(request, "core/landing_page.html", {"form": AuthenticationForm()})
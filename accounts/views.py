import logging
from django.shortcuts import render, redirect
from django.contrib import messages
from django.contrib.auth import login, logout
from django.contrib.auth.decorators import login_required
from django.contrib.auth.views import LoginView, LogoutView
from .decorators import role_required
from django.db import IntegrityError

from .models import CustomUser
from .forms import CustomSignupForm
from session.models import Participant

logger = logging.getLogger(__name__)

# Attempt to import Session model from the session app (defensive)
try:
    from session.models import Session
except Exception:
    Session = None


def signup_view(request):
    if request.method == "POST":
        form = CustomSignupForm(request.POST)
        if form.is_valid():
            email = form.cleaned_data.get("email")
            student_id = form.cleaned_data.get("student_id")
            role = form.cleaned_data.get("role")

            # Student must provide an ID
            if role == "student" and not student_id:
                messages.error(request, "⚠️ Student ID is required for students.")
                return render(request, "accounts/signup.html", {"form": form})

            try:
                user = form.save()
                login(request, user)
                messages.success(request, f"✅ Welcome, {user.email}! Your account has been created.")
                return redirect("redirect_dashboard")

            except IntegrityError:
                messages.error(request, "⚠️ That Student ID or email is already in use.")
                return render(request, "accounts/signup.html", {"form": form})
        else:
            messages.error(request, "⚠️ Please correct the errors below.")
    else:
        form = CustomSignupForm()

    return render(request, "accounts/signup.html", {"form": form})

class CustomLoginView(LoginView):
    template_name = "accounts/login.html"

    def form_invalid(self, form):
        messages.error(self.request, "⚠️ Invalid credentials. Please try again.")
        return super().form_invalid(form)


class CustomLogoutView(LogoutView):
    """
    Logs out the user and redirects to login page automatically.
    """
    next_page = "login"


# ---------- REDIRECT ----------
@login_required
def redirect_dashboard(request):
    """Redirect users based on their assigned role."""
    role = getattr(request.user, "role", None)
    if role == "student":
        return redirect("student_dashboard")
    elif role == "teacher":
        return redirect("teacher_dashboard")
    elif role == "admin":
        return redirect("admin_dashboard")
    else:
        return redirect("login")


# ---------- DASHBOARDS ----------
@login_required
def student_dashboard(request):
    joined_sessions = Participant.objects.filter(user=request.user).select_related('session')
    return render(request, 'accounts/student_dashboard.html', {
        'joined_sessions': joined_sessions
    })


@login_required
@role_required(['teacher'])
def teacher_dashboard(request):
    """
    Render teacher dashboard and include recent open sessions (if Session model is available)
    and a live count of active classes. The code tries several common Class/Course model names,
    and falls back to counting sessions if no class model is found.
    """
    open_sessions = []
    active_classes_count = 0

    # Try to compute active classes count from common app/model names (defensive)
    class_attempts = [
        ("classes.models", "Class"),
        ("courses.models", "Course"),
        ("classroom.models", "Classroom"),
        ("school.models", "SchoolClass"),
        ("courses.models", "CourseClass"),
    ]
    class_found = False
    for module_path, model_name in class_attempts:
        try:
            module = __import__(module_path, fromlist=[model_name])
            Model = getattr(module, model_name, None)
            if Model is None:
                continue
            # Prefer an 'is_active' filter, otherwise filter by teacher/owner fields
            qs = Model.objects.all()
            if hasattr(Model, "teacher"):
                qs = qs.filter(teacher=request.user)
            elif hasattr(Model, "owner"):
                qs = qs.filter(owner=request.user)
            elif hasattr(Model, "created_by"):
                qs = qs.filter(created_by=request.user)
            # apply is_active if present
            if hasattr(Model, "is_active"):
                qs = qs.filter(is_active=True)
            active_classes_count = qs.count()
            class_found = True
            break
        except Exception:
            continue

    # Fallback: if no Class model found, count sessions owned by the teacher (if Session exists)
    if not class_found and Session is not None:
        try:
            qs = Session.objects.all()
            # try to guess owner field name on Session
            if hasattr(Session, "created_by"):
                qs = qs.filter(created_by=request.user)
            elif hasattr(Session, "teacher"):
                qs = qs.filter(teacher=request.user)
            if hasattr(Session, "is_active"):
                qs = qs.filter(is_active=True)
            active_classes_count = qs.count()
        except Exception:
            active_classes_count = 0

    # Fetch open sessions defensively as before
    if Session is not None:
        try:
            qs = Session.objects.all()

            # try to detect owner field and filter by current user
            owner_fields = ["created_by", "creator", "teacher", "owner", "user"]
            for f in owner_fields:
                if hasattr(Session, f):
                    try:
                        qs = qs.filter(**{f: request.user})
                        break
                    except Exception:
                        continue

            # apply is_active filter if field exists
            if hasattr(Session, "is_active"):
                try:
                    qs = qs.filter(is_active=True)
                except Exception:
                    pass

            # pick sensible ordering field
            if hasattr(Session, "updated_at"):
                order_by = "-updated_at"
            elif hasattr(Session, "created_at"):
                order_by = "-created_at"
            else:
                order_by = "-id"

            open_sessions = qs.order_by(order_by)[:10]
        except Exception:
            logger.exception("Failed to fetch open sessions for teacher dashboard")
            try:
                open_sessions = Session.objects.all()[:10]
            except Exception:
                open_sessions = []

    context = {
        "open_sessions": open_sessions,
        "active_classes_count": active_classes_count,
    }
    return render(request, "accounts/teacher_dashboard.html", context)


@login_required
@role_required(['admin'])
def admin_dashboard(request):
    return render(request, "accounts/admin_dashboard.html")


# ---------- COMMON PAGES ----------
@login_required
def profile_view(request):
    return render(request, "accounts/profile.html")


@login_required
def edit_profile(request):
    user = request.user

    if request.method == "POST":
        user.username = request.POST.get("username")
        user.email = request.POST.get("email")

        # Only update student_id if role is NOT student AND field is present
        if user.role != "student" and "student_id" in request.POST:
            user.student_id = request.POST.get("student_id")


        user.save()
        messages.success(request, "✅ Profile updated successfully.")
        return redirect("profile")

    return render(request, "accounts/edit_profile.html")



@login_required
def notifications_view(request):
    return render(request, "accounts/notifications.html")


@login_required
def settings_view(request):
    return render(request, "accounts/settings.html")


@login_required
def help_view(request):
    return render(request, "accounts/help.html")
import logging
from django.shortcuts import render, redirect
from django.contrib.auth.decorators import login_required
from modules.authentication.decorators import role_required  # ✅ adjust path if needed


logger = logging.getLogger(__name__)

# Attempt to import Session model from session app
from modules.session.models import Participant
try:
    from modules.session.models import Session
except Exception:
    Session = None





# ---------- STUDENT DASHBOARD ----------
@login_required
def student_dashboard(request):
    """
    Displays sessions joined by the student.
    """
    joined_sessions = Participant.objects.filter(user=request.user).select_related('session')
    return render(request, "dashboard/student_dashboard.html", {
        'joined_sessions': joined_sessions
    })


# ---------- TEACHER DASHBOARD ----------
@login_required
@role_required(['teacher'])
def teacher_dashboard(request):
    """
    Displays the teacher dashboard.
    Shows open sessions and total active classes (if Session model exists).
    """
    open_sessions = []
    active_classes_count = 0

    # Count active classes based on available models
    class_attempts = [
        ("classes.models", "Class"),
        ("courses.models", "Course"),
        ("classroom.models", "Classroom"),
        ("school.models", "SchoolClass"),
        ("courses.models", "CourseClass"),
    ]

    for module_path, model_name in class_attempts:
        try:
            module = __import__(module_path, fromlist=[model_name])
            Model = getattr(module, model_name)
            qs = Model.objects.all()

            if hasattr(Model, "teacher"):
                qs = qs.filter(teacher=request.user)
            elif hasattr(Model, "owner"):
                qs = qs.filter(owner=request.user)
            elif hasattr(Model, "created_by"):
                qs = qs.filter(created_by=request.user)

            if hasattr(Model, "is_active"):
                qs = qs.filter(is_active=True)

            active_classes_count = qs.count()
            break
        except Exception:
            continue

    # Fallback to sessions if no other class model found
    if active_classes_count == 0 and Session is not None:
        try:
            qs = Session.objects.all()
            if hasattr(Session, "created_by"):
                qs = qs.filter(created_by=request.user)
            elif hasattr(Session, "teacher"):
                qs = qs.filter(teacher=request.user)
            if hasattr(Session, "is_active"):
                qs = qs.filter(is_active=True)
            active_classes_count = qs.count()
        except Exception:
            active_classes_count = 0

    # Fetch open sessions (most recent)
    if Session is not None:
        try:
            qs = Session.objects.all()
            owner_fields = ["created_by", "creator", "teacher", "owner", "user"]
            for f in owner_fields:
                if hasattr(Session, f):
                    qs = qs.filter(**{f: request.user})
                    break

            if hasattr(Session, "is_active"):
                qs = qs.filter(is_active=True)

            order_by = "-updated_at" if hasattr(Session, "updated_at") else "-created_at" if hasattr(Session, "created_at") else "-id"
            open_sessions = qs.order_by(order_by)[:10]
        except Exception:
            logger.exception("Failed to fetch open sessions for teacher dashboard")

    context = {
        "open_sessions": open_sessions,
        "active_classes_count": active_classes_count,
    }
    return render(request, "dashboard/teacher_dashboard.html", context)


# ---------- ADMIN DASHBOARD ----------
@login_required
@role_required(['admin'])
def admin_dashboard(request):
    """
    Simple admin dashboard (extend later as needed).
    """
    return render(request, "dashboard/admin_dashboard.html")


# ---------- REDIRECT DASHBOARD ----------
@login_required
def redirect_dashboard(request):
    """
    Redirect users to their role-based dashboard.
    """
    role = getattr(request.user, "role", None)
    if role == "student":
        return redirect("student_dashboard")
    elif role == "teacher":
        return redirect("teacher_dashboard")
    elif role == "admin":
        return redirect("admin_dashboard")
    return redirect("login")

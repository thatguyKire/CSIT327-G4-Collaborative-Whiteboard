import logging
from django.shortcuts import render, redirect
from django.contrib.auth.decorators import login_required
from modules.authentication.decorators import role_required  # ✅ adjust path if needed
from django.utils import timezone
from django.db.models import Count, Max
from django.db import ProgrammingError
from modules.session.models import Participant, UploadedFile, ChatMessage, Session

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
    joined = Participant.objects.filter(user=request.user).select_related("session")
    sessions = [p.session for p in joined]
    uploads_map = {
        r["session_id"]: r["cnt"]
        for r in UploadedFile.objects.filter(session__in=sessions)
              .values("session_id").annotate(cnt=Count("id"))
    }
    performance_chart = {
        "labels": [p.session.title or "Session" for p in joined],
        "strokes": [p.strokes_count for p in joined],
        "uploads": [uploads_map.get(p.session_id, 0) for p in joined],
    }
    return render(request, "dashboard/student_dashboard.html", {
        "joined_sessions": joined,
        "student_perf_chart": performance_chart,
    })


# ---------- TEACHER DASHBOARD ----------
@login_required
@role_required(['teacher'])
def teacher_dashboard(request):
    """
    Teacher dashboard with performance metrics.
    """
    user = request.user

    # Sessions owned by teacher
    sessions_qs = Session.objects.filter(created_by=user)

    # Open sessions subset (recent)
    order_by = "-created_at"
    open_sessions = sessions_qs.order_by(order_by)[:10]

    active_classes_count = sessions_qs.count()

    # Participants across teacher sessions
    participants_qs = Participant.objects.filter(session__in=sessions_qs).select_related("user")

    # Per-user uploads
    try:
        uploads_agg = UploadedFile.objects.filter(session__in=sessions_qs) \
            .values("uploaded_by_id").annotate(upload_count=Count("id"), last_upload=Max("uploaded_at"))
    except ProgrammingError:
        uploads_agg = []
    uploads_map = {u["uploaded_by_id"]: u for u in uploads_agg}

    # Per-user messages
    msgs_agg = ChatMessage.objects.filter(session__in=sessions_qs) \
        .values("sender_id").annotate(msg_count=Count("id"), last_msg=Max("timestamp"))

    msgs_map = {m["sender_id"]: m for m in msgs_agg}

    today = timezone.now().date()

    performance_rows = []
    for p in participants_qs:
        uid = p.user_id
        up = uploads_map.get(uid)
        ms = msgs_map.get(uid)

        uploads_count = up["upload_count"] if up else 0
        messages_count = ms["msg_count"] if ms else 0

        # Placeholder strokes (not tracked yet)
        strokes_count = 0

        last_active_candidates = [
            up["last_upload"] if up else None,
            ms["last_msg"] if ms else None,
            p.joined_at
        ]
        last_active = max([d for d in last_active_candidates if d is not None], default=p.joined_at)

        performance_rows.append({
            "username": p.user.username,
            "strokes": strokes_count,
            "uploads": uploads_count,
            "messages": messages_count,
            "last_active": last_active,
        })

    total_students = participants_qs.values("user_id").distinct().count()
    total_uploads = sum(r["uploads"] for r in performance_rows)
    total_messages = sum(r["messages"] for r in performance_rows)
    # Active today: any upload or message today
    active_today = sum(
        1 for r in performance_rows
        if (r["last_active"] and r["last_active"].date() == today)
    )

    performance_totals = {
        "total_students": total_students,
        "active_today": active_today,
        "total_strokes": sum(r["strokes"] for r in performance_rows),
        "total_uploads": total_uploads,
        "total_messages": total_messages,
    }

    performance_chart = {
        "labels": [r["username"] for r in performance_rows],
        "uploads": [r["uploads"] for r in performance_rows],
        "messages": [r["messages"] for r in performance_rows],
        "strokes": [r["strokes"] for r in performance_rows],
    }

    context = {
        "open_sessions": open_sessions,
        "active_classes_count": active_classes_count,
        "performance_rows": performance_rows,
        "performance_totals": performance_totals,
        "performance_chart": performance_chart,
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

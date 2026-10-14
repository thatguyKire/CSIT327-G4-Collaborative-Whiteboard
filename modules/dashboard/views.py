import logging
from django.shortcuts import render, redirect
from django.contrib.auth.decorators import login_required
from modules.authentication.decorators import role_required
from django.utils import timezone
from django.db.models import Count, Max
from modules.authentication.models import CustomUser
from modules.chat.models import Message
from modules.session.models import Participant, UploadedFile, Session

logger = logging.getLogger(__name__)


# ---------- STUDENT DASHBOARD ----------
@login_required
def student_dashboard(request):
    """
    Displays sessions joined by the student.
    """
    joined = list(
        Participant.objects.filter(user=request.user)
        .select_related("session")
        .order_by("-joined_at")
    )
    performance_chart = {
        "labels": [p.session.title or "Session" for p in joined],
        "strokes": [p.strokes_count for p in joined],
        "uploads": [p.uploads_count for p in joined],
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
    open_sessions = sessions_qs.order_by("-created_at")[:10]
    active_classes_count = sessions_qs.count()

    # Participants across teacher sessions
    participants_qs = Participant.objects.filter(session__in=sessions_qs).select_related("user")

    # Per-user uploads
    uploads_agg = UploadedFile.objects.filter(session__in=sessions_qs) \
        .values("uploaded_by_id").annotate(upload_count=Count("id"), last_upload=Max("uploaded_at"))
    uploads_map = {u["uploaded_by_id"]: u for u in uploads_agg}

    # Per-user chat messages (live chat lives in modules.chat)
    msgs_agg = Message.objects.filter(room__session__in=sessions_qs) \
        .values("sender_id").annotate(msg_count=Count("id"), last_msg=Max("timestamp"))
    msgs_map = {m["sender_id"]: m for m in msgs_agg}

    today = timezone.localdate()

    # One row per student, summed across all of this teacher's sessions.
    rows_by_user = {}
    for p in participants_qs:
        row = rows_by_user.get(p.user_id)
        if row is None:
            up = uploads_map.get(p.user_id)
            ms = msgs_map.get(p.user_id)
            row = rows_by_user[p.user_id] = {
                "username": p.user.username,
                "strokes": 0,
                "uploads": up["upload_count"] if up else 0,
                "messages": ms["msg_count"] if ms else 0,
                "last_active": max(
                    [d for d in (up["last_upload"] if up else None, ms["last_msg"] if ms else None) if d],
                    default=None,
                ),
            }
        row["strokes"] += p.strokes_count
        seen = [d for d in (row["last_active"], p.last_active, p.joined_at) if d]
        row["last_active"] = max(seen) if seen else None
    performance_rows = sorted(rows_by_user.values(), key=lambda r: r["username"].lower())

    # Active today: any activity (join, stroke, upload, message) today
    active_today = sum(
        1 for r in performance_rows
        if r["last_active"] and timezone.localtime(r["last_active"]).date() == today
    )

    performance_totals = {
        "total_students": len(performance_rows),
        "active_today": active_today,
        "total_strokes": sum(r["strokes"] for r in performance_rows),
        "total_uploads": sum(r["uploads"] for r in performance_rows),
        "total_messages": sum(r["messages"] for r in performance_rows),
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
    Platform-wide counts for administrators.
    """
    role_counts = dict(CustomUser.objects.values_list("role").annotate(n=Count("id")))
    context = {
        "student_count": role_counts.get("student", 0),
        "teacher_count": role_counts.get("teacher", 0),
        "admin_count": role_counts.get("admin", 0),
        "session_count": Session.objects.count(),
        "participant_count": Participant.objects.count(),
        "upload_count": UploadedFile.objects.count(),
        "message_count": Message.objects.count(),
        "recent_sessions": Session.objects.select_related("created_by").order_by("-created_at")[:10],
    }
    return render(request, "dashboard/admin_dashboard.html", context)


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
    return redirect("auth:login")

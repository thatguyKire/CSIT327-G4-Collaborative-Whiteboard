from django.urls import path
from . import views

app_name = "notifications"

urlpatterns = [
    path("", views.notifications_view, name="notifications"),
    path("unread-count/", views.unread_count, name="unread_count"),
    path("mark-all-read/", views.mark_all_read, name="mark_all_read"),
    path("<int:pk>/read/", views.mark_read, name="mark_read"),
    path("latest/", views.latest_json, name="latest_json"),
    path("announce/<uuid:session_id>/", views.send_announcement, name="send_announcement"),
    path("session/<uuid:session_id>/list/", views.session_announcements_json, name="session_announcements_json"),
    path("session/<uuid:session_id>/mine/", views.session_student_announcements_json, name="session_student_announcements_json"),  # NEW
]

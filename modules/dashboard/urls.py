from django.urls import path
from . import views

urlpatterns = [
    path("student/", views.student_dashboard, name="student_dashboard"),
    path("teacher/", views.teacher_dashboard, name="teacher_dashboard"),
    path("admin/", views.admin_dashboard, name="admin_dashboard"),
    path("redirect/", views.redirect_dashboard, name="redirect_dashboard"),
]

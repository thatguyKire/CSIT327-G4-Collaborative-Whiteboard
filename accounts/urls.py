from django.urls import path
from django.contrib.auth import views as auth_views
from . import views

urlpatterns = [
    # Authentication
    path("signup/", views.signup_view, name="signup"),
    path("login/", auth_views.LoginView.as_view(template_name="accounts/login.html"), name="login"),
    path("logout/", auth_views.LogoutView.as_view(), name="logout"),

    # Dashboard redirect
    path("redirect/", views.redirect_dashboard, name="redirect_dashboard"),

    # Dashboards
    path("student/dashboard/", views.student_dashboard, name="student_dashboard"),
    path("teacher/dashboard/", views.teacher_dashboard, name="teacher_dashboard"),
    path("admin/dashboard/", views.admin_dashboard, name="admin_dashboard"),

    # Other pages
    path("profile/", views.profile_view, name="profile"),
    path("profile/edit/", views.edit_profile, name="edit_profile"),
    path("notifications/", views.notifications_view, name="notifications"),
    path("settings/", views.settings_view, name="settings"),
    path("help/", views.help_view, name="help"),
]

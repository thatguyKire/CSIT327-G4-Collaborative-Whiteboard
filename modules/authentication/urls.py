from django.urls import path
from django.contrib.auth import views as auth_views
from django.urls import reverse_lazy  # added
from . import views

app_name = "authentication"  # app namespace inside this module

urlpatterns = [
    # -----------------------------
    # 🔐 AUTHENTICATION
    # -----------------------------
    path("signup/", views.signup_view, name="signup"),
    path(
        "login/",
        views.CustomLoginView.as_view(),
        name="login",
    ),
    path(
        "logout/",
        auth_views.LogoutView.as_view(
            template_name="authentication/logout.html",
            next_page=reverse_lazy("landing"),  # send users to landing page after logout
        ),
        name="logout",
    ),

    # -----------------------------
    # 🔑 PASSWORD MANAGEMENT
    # -----------------------------
    path(
        "password_change/",
        auth_views.PasswordChangeView.as_view(
            template_name="authentication/password_change.html",
            success_url=reverse_lazy("auth:password_change_done"),
        ),
        name="password_change",
    ),
    path(
        "password_change_done/",
        auth_views.PasswordChangeDoneView.as_view(
            template_name="authentication/password_change_done.html"
        ),
        name="password_change_done",
    ),

    # -----------------------------
    # 📨 PASSWORD RESET FLOW (Forgot Password)
    # -----------------------------
    path(
        "password_reset/",
        auth_views.PasswordResetView.as_view(
            template_name="authentication/password_reset.html",
            email_template_name="authentication/password_reset_email.html",
            success_url=reverse_lazy("auth:password_reset_done"),
        ),
        name="password_reset",
    ),
    path(
        "password_reset_done/",
        auth_views.PasswordResetDoneView.as_view(
            template_name="authentication/password_reset_done.html"
        ),
        name="password_reset_done",
    ),
    path(
        "reset/<uidb64>/<token>/",
        auth_views.PasswordResetConfirmView.as_view(
            template_name="authentication/password_reset_confirm.html",
            success_url=reverse_lazy("auth:password_reset_complete"),
        ),
        name="password_reset_confirm",
    ),
    path(
        "password_reset_complete/",
        auth_views.PasswordResetCompleteView.as_view(
            template_name="authentication/password_reset_complete.html"
        ),
        name="password_reset_complete",
    ),
]

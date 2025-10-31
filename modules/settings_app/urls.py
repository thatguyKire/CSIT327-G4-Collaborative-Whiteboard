from django.urls import path
from django.contrib.auth import views as auth_views
from . import views

urlpatterns = [
    path("", views.settings_view, name="settings"),

    # Password change
    path(
        "password_change/",
        auth_views.PasswordChangeView.as_view(
            template_name="settings_app/password_change.html",
            success_url="/settings/password_change_done/",
        ),
        name="password_change",
    ),
    path(
        "password_change_done/",
        auth_views.PasswordChangeDoneView.as_view(
            template_name="settings_app/password_change_done.html"
        ),
        name="password_change_done",
    ),
]

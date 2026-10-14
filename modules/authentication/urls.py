from django.urls import path
from django.contrib.auth import views as auth_views
from django.urls import reverse_lazy
from . import views

app_name = "authentication"  # app namespace inside this module

# Password change lives in modules.settings_app (/settings/password_change/).
# Password reset by email is not offered yet (no email backend configured).
urlpatterns = [
    path("signup/", views.signup_view, name="signup"),
    path("login/", views.CustomLoginView.as_view(), name="login"),
    path(
        "logout/",
        auth_views.LogoutView.as_view(
            template_name="authentication/logout.html",
            next_page=reverse_lazy("landing"),  # send users to landing page after logout
        ),
        name="logout",
    ),
]

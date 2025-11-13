import logging
from django.shortcuts import render, redirect
from django.contrib import messages
from django.contrib.auth import login
from django.contrib.auth.views import LoginView, LogoutView
from django.db import IntegrityError
from django.urls import reverse_lazy

from modules.authentication.models import CustomUser  # ✅ correct
from .forms import CustomSignupForm

logger = logging.getLogger(__name__)

def signup_view(request):
    """Handles user registration."""
    if request.method == "POST":
        form = CustomSignupForm(request.POST)
        if form.is_valid():
            try:
                user = form.save()
                login(request, user)
                messages.success(request, f"✅ Welcome, {user.username}!")
                return redirect("redirect_dashboard")  # adjust to your dashboard route
            except IntegrityError:
                messages.error(request, "⚠️ That Student ID or email is already in use.")
        else:
            messages.error(request, "⚠️ Please correct the errors below.")
    else:
        form = CustomSignupForm()

    return render(request, "authentication/signup.html", {"form": form})


class CustomLoginView(LoginView):
    template_name = "authentication/login.html"

    def form_invalid(self, form):
        messages.error(self.request, "⚠️ Invalid credentials. Please try again.")
        return super().form_invalid(form)


class CustomLogoutView(LogoutView):
    """Logs out the user and redirects to landing page."""
    next_page = reverse_lazy("landing")

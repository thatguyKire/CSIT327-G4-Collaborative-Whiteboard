import logging
from django.shortcuts import render, redirect
from django.contrib import messages
from django.contrib.auth import login
from django.contrib.auth.views import LoginView, LogoutView
from django.db import IntegrityError
from django.urls import reverse_lazy

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
                return redirect("landing")
            except IntegrityError:
                messages.error(request, "⚠️ That Student ID or email is already in use.")
        else:
            messages.error(request, "⚠️ Please correct the errors below.")
    else:
        form = CustomSignupForm()

    return render(request, "authentication/signup.html", {"form": form})


class CustomLoginView(LoginView):
    template_name = "authentication/login.html"
    # When users log in, always send them to their role-based dashboard
    # instead of honoring a `next` query parameter that may point back
    # to a previously accessed session URL.
    redirect_authenticated_user = True

    def get_success_url(self):
        # Ignore any `next` parameter and always redirect to the
        # dashboard redirector which will send students/teachers/admins
        # to their appropriate dashboard.
        from django.urls import reverse_lazy
        return reverse_lazy("redirect_dashboard")

    def form_invalid(self, form):
        messages.error(self.request, "⚠️ Invalid credentials. Please try again.")
        return super().form_invalid(form)


class CustomLogoutView(LogoutView):
    """Logs out the user and redirects to landing page."""
    next_page = reverse_lazy("landing")

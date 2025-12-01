from django.shortcuts import render
from django.contrib.auth.decorators import login_required
from django.contrib.auth import views as auth_views
from django.contrib.auth import update_session_auth_hash


class CustomPasswordChangeView(auth_views.PasswordChangeView):
    """Ensure the session auth hash is updated so users remain logged in
    after changing their password. This prevents unexpected logout when
    redirecting back to profile."""

    def form_valid(self, form):
        response = super().form_valid(form)
        # Update the session with the new auth hash
        update_session_auth_hash(self.request, form.user)
        return response

@login_required
def settings_view(request):
    return render(request, "settings_app/settings.html")

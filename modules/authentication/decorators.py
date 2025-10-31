# modules/authentication/decorators.py
from django.shortcuts import redirect
from django.contrib import messages
from functools import wraps

def role_required(allowed_roles):
    """
    Restrict access based on user.role.
    Usage:
        @role_required(['teacher'])
    """
    def decorator(view_func):
        @wraps(view_func)
        def wrapper(request, *args, **kwargs):
            if not request.user.is_authenticated:
                messages.error(request, "⚠️ You must be logged in to access this page.")
                return redirect("login")

            if getattr(request.user, "role", None) not in allowed_roles:
                messages.error(request, "🚫 You do not have permission to access this page.")
                return redirect("redirect_dashboard")

            return view_func(request, *args, **kwargs)
        return wrapper
    return decorator

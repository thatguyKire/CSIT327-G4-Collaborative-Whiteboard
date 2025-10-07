from django.shortcuts import redirect
from django.contrib import messages

def role_required(allowed_roles):
    """
    Decorator that restricts view access based on user.role
    Usage: @role_required(['student'])
    """
    def decorator(view_func):
        def wrapper(request, *args, **kwargs):
            if not hasattr(request.user, 'role'):
                messages.error(request, "You must be logged in to access this page.")
                return redirect('login')

            if request.user.role not in allowed_roles:
                messages.error(request, "🚫 You do not have permission to access this page.")
                return redirect('redirect_dashboard')

            return view_func(request, *args, **kwargs)
        return wrapper
    return decorator

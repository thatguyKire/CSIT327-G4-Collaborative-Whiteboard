from django.shortcuts import render, redirect
from django.contrib import messages
from django.contrib.auth import login, logout
from django.contrib.auth.decorators import login_required
from django.contrib.auth.views import LoginView, LogoutView
from .decorators import role_required


from .models import CustomUser
from .forms import CustomSignupForm


# ---------- AUTH ----------
def signup_view(request):
    """
    Handles new user registration with validation for duplicate emails,
    student ID enforcement, and login after signup.
    """
    if request.method == "POST":
        form = CustomSignupForm(request.POST)
        if form.is_valid():
            email = form.cleaned_data.get("email")
            student_id = form.cleaned_data.get("student_id")
            role = form.cleaned_data.get("role")

            # Duplicate email check
            if CustomUser.objects.filter(email=email).exists():
                messages.error(request, "⚠️ This email is already registered.")
                return render(request, "accounts/signup.html", {"form": form})

            # Duplicate Student ID (for students)
            if role == "student" and CustomUser.objects.filter(student_id=student_id).exists():
                messages.error(request, "⚠️ This Student ID is already in use.")
                return render(request, "accounts/signup.html", {"form": form})

            # Missing Student ID
            if role == "student" and not student_id:
                messages.error(request, "⚠️ Student ID is required for students.")
                return render(request, "accounts/signup.html", {"form": form})

            # Save and login the user
            user = form.save()
            login(request, user)
            messages.success(request, f"✅ Welcome, {user.email}! Your account has been created successfully.")
            return redirect("redirect_dashboard")

        else:
            # Validation errors (password mismatch, etc.)
            messages.error(request, "⚠️ Please correct the errors below.")
    else:
        form = CustomSignupForm()

    return render(request, "accounts/signup.html", {"form": form})


class CustomLoginView(LoginView):
    template_name = "accounts/login.html"

    def form_invalid(self, form):
        messages.error(self.request, "⚠️ Invalid credentials. Please try again.")
        return super().form_invalid(form)


class CustomLogoutView(LogoutView):
    """
    Logs out the user and redirects to login page automatically.
    """
    next_page = "login"  # Redirect to login after logout


# ---------- REDIRECT ----------
@login_required
def redirect_dashboard(request):
    """Redirect users based on their assigned role."""
    role = getattr(request.user, "role", None)
    if role == "student":
        return redirect("student_dashboard")
    elif role == "teacher":
        return redirect("teacher_dashboard")
    elif role == "admin":
        return redirect("admin_dashboard")
    else:
        return redirect("login")


# ---------- DASHBOARDS ----------
@login_required
@role_required(['student'])
def student_dashboard(request):
    return render(request, "accounts/student_dashboard.html")


@login_required
@role_required(['teacher'])
def teacher_dashboard(request):
    return render(request, "accounts/teacher_dashboard.html")


@login_required
@role_required(['admin'])
def admin_dashboard(request):
    return render(request, "accounts/admin_dashboard.html")

# ---------- COMMON PAGES ----------
@login_required
def profile_view(request):
    return render(request, "accounts/profile.html")


@login_required
def edit_profile(request):
    if request.method == "POST":
        user = request.user
        user.username = request.POST.get("username")
        user.email = request.POST.get("email")
        if user.role == "student":
            user.student_id = request.POST.get("student_id")
        user.save()
        messages.success(request, "✅ Profile updated successfully!")
        return redirect("profile")
    return render(request, "accounts/edit_profile.html")


@login_required
def notifications_view(request):
    return render(request, "accounts/notifications.html")


@login_required
def settings_view(request):
    return render(request, "accounts/settings.html")


@login_required
def help_view(request):
    return render(request, "accounts/help.html")

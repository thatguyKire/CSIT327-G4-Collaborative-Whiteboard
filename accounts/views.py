from django.shortcuts import render, redirect
from django.contrib.auth.decorators import login_required
from django.contrib.auth import login
from django.contrib.auth.views import LoginView, LogoutView

from .forms import CustomSignupForm  # import our custom signup form


# ---------- Auth ----------
def signup_view(request):
    if request.method == "POST":
        form = CustomSignupForm(request.POST)
        if form.is_valid():
            user = form.save(commit=False)

            # Extra validation: student must provide student_id
            if user.role == "student" and not form.cleaned_data.get("student_id"):
                form.add_error("student_id", "Student ID is required for students.")
                return render(request, "accounts/signup.html", {"form": form})

            user.save()
            login(request, user)  # log the user in right after signup
            return redirect("redirect_dashboard")
    else:
        form = CustomSignupForm()
    return render(request, "accounts/signup.html", {"form": form})


class CustomLoginView(LoginView):
    template_name = "accounts/login.html"


class CustomLogoutView(LogoutView):
    template_name = "accounts/logout.html"


# ---------- Redirect ----------
@login_required
def redirect_dashboard(request):
    """
    Redirect users to their dashboard based on role.
    """
    if hasattr(request.user, "role"):
        if request.user.role == "student":
            return redirect("student_dashboard")
        elif request.user.role == "teacher":
            return redirect("teacher_dashboard")
        elif request.user.role == "admin":
            return redirect("admin_dashboard")
    return redirect("login")  # fallback if no role


# ---------- Dashboards ----------
#@login_required  # for debugging
def student_dashboard(request):
    return render(request, "accounts/student_dashboard.html")


@login_required
def teacher_dashboard(request):
    return render(request, "accounts/teacher_dashboard.html")


@login_required
def admin_dashboard(request):
    return render(request, "accounts/admin_dashboard.html")


# ---------- Common Pages ----------
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
        return redirect("profile")
    return render(request, "accounts/edit_profile.html")

@login_required
def notifications_view(request):
    return render(request, "accounts/notifications.html")


#@login_required #for debugging only
def settings_view(request):
    return render(request, "accounts/settings.html")


@login_required
def help_view(request):
    return render(request, "accounts/help.html")

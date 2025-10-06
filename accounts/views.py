from django.shortcuts import render, redirect
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.contrib.auth import login
from django.contrib.auth.views import LoginView, LogoutView

from .models import CustomUser
from .forms import CustomSignupForm


# ---------- Auth ----------
def signup_view(request):
    if request.method == "POST":
        form = CustomSignupForm(request.POST)
        if form.is_valid():
            email = form.cleaned_data.get("email")
            student_id = form.cleaned_data.get("student_id")
            role = form.cleaned_data.get("role")

            # Check for duplicate email
            if CustomUser.objects.filter(email=email).exists():
                messages.error(request, "This email is already registered.")
                return render(request, "accounts/signup.html", {"form": form})

            # Check for duplicate student ID (only for students)
            if role == "student" and CustomUser.objects.filter(student_id=student_id).exists():
                messages.error(request, "This Student ID is already in use.")
                return render(request, "accounts/signup.html", {"form": form})

            # Student must provide student_id
            if role == "student" and not student_id:
                messages.error(request, "Student ID is required for students.")
                return render(request, "accounts/signup.html", {"form": form})

            # Save and log in
            user = form.save()
            login(request, user)
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
    if hasattr(request.user, "role"):
        if request.user.role == "student":
            return redirect("student_dashboard")
        elif request.user.role == "teacher":
            return redirect("teacher_dashboard")
        elif request.user.role == "admin":
            return redirect("admin_dashboard")
    return redirect("login")


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

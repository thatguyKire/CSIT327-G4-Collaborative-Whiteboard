from django.shortcuts import render, redirect
from django.contrib.auth.decorators import login_required
from django.contrib import messages

@login_required
def profile_view(request):
    return render(request, "profiles/profile.html")

@login_required
def edit_profile(request):
    user = request.user
    if request.method == "POST":
        user.username = request.POST.get("username")
        user.email = request.POST.get("email")

        if user.role != "student" and "student_id" in request.POST:
            user.student_id = request.POST.get("student_id")

        user.save()
        messages.success(request, "✅ Profile updated successfully.")
        return redirect("profile")

    return render(request, "profiles/edit_profile.html")

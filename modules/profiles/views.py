from django.shortcuts import render, redirect
from django.contrib.auth import get_user_model
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.core.exceptions import ValidationError
from django.core.validators import validate_email


@login_required
def profile_view(request):
    return render(request, "profiles/profile.html")


@login_required
def edit_profile(request):
    """Let users update their email. Username and Student ID are fixed after signup."""
    user = request.user
    if request.method == "POST":
        new_email = (request.POST.get("email") or "").strip().lower()
        try:
            validate_email(new_email)
        except ValidationError:
            messages.error(request, "Please enter a valid email address.")
            return render(request, "profiles/edit_profile.html", {"email": new_email})

        if new_email != user.email:
            if get_user_model().objects.filter(email__iexact=new_email).exclude(pk=user.pk).exists():
                messages.error(request, "That email address is already used by another account.")
                return render(request, "profiles/edit_profile.html", {"email": new_email})
            user.email = new_email
            user.save(update_fields=["email"])

        messages.success(request, "✅ Profile updated successfully.")
        return redirect("profile")

    return render(request, "profiles/edit_profile.html", {"email": user.email})

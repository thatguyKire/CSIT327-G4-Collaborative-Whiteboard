# modules/authentication/forms.py
from django import forms
from django.contrib.auth.forms import UserCreationForm
from modules.authentication.models import CustomUser  # ✅ updated import path

class CustomSignupForm(UserCreationForm):
    student_id = forms.CharField(
        required=False,
        max_length=20,
        widget=forms.TextInput(attrs={"placeholder": "Student ID (if Student)"})
    )
    role = forms.ChoiceField(
        choices=[("student", "Student"), ("teacher", "Teacher"), ("admin", "Admin")],
        widget=forms.Select()
    )

    class Meta(UserCreationForm.Meta):
        model = CustomUser
        fields = ["username", "email", "student_id", "role", "password1", "password2"]

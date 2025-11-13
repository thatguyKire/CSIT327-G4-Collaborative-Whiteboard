# modules/authentication/forms.py
from django import forms
from django.contrib.auth.forms import UserCreationForm
from modules.authentication.models import CustomUser  # ✅ updated import path

class CustomSignupForm(UserCreationForm):
    # Make email explicit and autofill-friendly
    email = forms.EmailField(
        required=True,
        widget=forms.EmailInput(attrs={
            "autocomplete": "email",
            "inputmode": "email",
        })
    )
    student_id = forms.CharField(
        required=False,
        max_length=20,
        widget=forms.TextInput(attrs={
            "placeholder": "Student ID (if Student)",
            "autocomplete": "off",
            "inputmode": "text",
        })
    )
    role = forms.ChoiceField(
        choices=[("student", "Student"), ("teacher", "Teacher"), ("admin", "Admin")],
        widget=forms.Select(attrs={"autocomplete": "off"})
    )

    class Meta(UserCreationForm.Meta):
        model = CustomUser
        fields = ["username", "email", "student_id", "role", "password1", "password2"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Accessible/autofill-friendly attributes
        self.fields["username"].widget.attrs.update({
            "autocomplete": "username",
            "autocapitalize": "none",
            "spellcheck": "false",
        })
        self.fields["password1"].widget.attrs.update({
            "autocomplete": "new-password",
        })
        self.fields["password2"].widget.attrs.update({
            "autocomplete": "new-password",
        })

    def clean(self):
        cleaned = super().clean()
        role = (cleaned.get("role") or "").lower()
        sid = (cleaned.get("student_id") or "").strip()

        if role == "student":
            if not sid:
                self.add_error("student_id", "Student ID is required for students.")
            # ensure model-level unique validation uses the normalized value
            cleaned["student_id"] = sid or None
            self.instance.student_id = sid or None
        else:
            # critical: avoid unique '' collisions for teachers/admins
            cleaned["student_id"] = None
            self.instance.student_id = None

        return cleaned

    def save(self, commit=True):
        user = super().save(commit=False)
        user.email = (self.cleaned_data.get("email") or "").strip().lower()
        user.role = (self.cleaned_data.get("role") or "").lower()
        # already normalized by clean()
        user.student_id = self.cleaned_data.get("student_id")
        if commit:
            user.save()
        return user

# modules/authentication/forms.py
from django import forms
from django.contrib.auth.forms import UserCreationForm
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
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
        # Friendlier labels (avoid showing 'password1' / 'password2')
        self.fields["password1"].label = "Password"
        self.fields["password2"].label = "Confirm password"

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

        # Ensure any password validator errors are not attached to the
        # `password2` field (we surface them as non-field errors).
        if hasattr(self, "_errors") and self._errors is not None:
            if "password2" in self._errors:
                del self._errors["password2"]

        return cleaned

    def clean_email(self):
        """Ensure email is unique (case-insensitive) at signup.

        The model doesn't currently enforce email uniqueness at the database
        level, so we validate here and raise a friendly form error.
        """
        email = (self.cleaned_data.get("email") or "").strip().lower()
        if not email:
            raise forms.ValidationError("Enter a valid email address.")
        # check for existing users with same email (case-insensitive)
        if CustomSignupForm.Meta.model.objects.filter(email__iexact=email).exists():
            raise forms.ValidationError("A user with that email address already exists.")
        return email

    # Use Django's built-in password validation (AUTH_PASSWORD_VALIDATORS)
    # by relying on UserCreationForm's built-in validation. Do not override
    # clean_password2 here so validators configured in settings.py are applied.

    def clean_password2(self):
        """Validate password and surface validator messages as form-level errors.

        Django's UserCreationForm attaches validator errors to `password2` by
        default which can render as the field name `Password2` in some
        templates. To avoid exposing `password1`/`password2` internals in the
        UI, capture validator errors and add them as non-field (form-level)
        errors instead.
        """
        password1 = self.cleaned_data.get("password1")
        password2 = self.cleaned_data.get("password2")
        # Preserve the standard password match check but show it as a
        # non-field/form-level error so the UI doesn't expose `password2`.
        if password1 and password2 and password1 != password2:
            self.add_error(None, "The two password fields didn't match.")
            # Ensure no field-level password2 errors remain
            if hasattr(self, "_errors") and self._errors is not None:
                if "password2" in self._errors:
                    del self._errors["password2"]
            return password2

        # Run Django's password validators and attach any messages to the
        # form's non-field errors so the template shows them without a
        # `Password2:` label prefix.
        if password1:
            try:
                validate_password(password1, self.instance)
            except DjangoValidationError as e:
                for msg in e.messages:
                    self.add_error(None, msg)

        # Remove any validator messages that may have been attached to the
        # `password2` field by other code paths to avoid duplicate messages
        # (we already surfaced them as non-field errors above).
        if hasattr(self, "_errors") and self._errors is not None:
            if "password2" in self._errors:
                del self._errors["password2"]

        return password2

    def full_clean(self):
        """Run full validation then remove any `password2` field errors.

        Overriding `full_clean` is the most reliable place to clear out
        `password2` errors because it runs after all field and form
        validators have executed. This prevents duplicate/inlined
        `password2` messages from appearing in the template while keeping
        the single, form-level validator messages we added earlier.
        """
        super().full_clean()
        if hasattr(self, "_errors") and self._errors is not None:
            if "password2" in self._errors:
                del self._errors["password2"]

    def save(self, commit=True):
        user = super().save(commit=False)
        user.email = (self.cleaned_data.get("email") or "").strip().lower()
        user.role = (self.cleaned_data.get("role") or "").lower()
        # already normalized by clean()
        user.student_id = self.cleaned_data.get("student_id")
        if commit:
            user.save()
        return user

from django.core.exceptions import ValidationError
from django.utils.translation import gettext as _
import re


class ComplexPasswordValidator:
    """Require at least one uppercase letter, one digit and one special char.

    Plug this into `AUTH_PASSWORD_VALIDATORS` to enforce complexity across
    the project (signup, admin, password changes).
    """

    def validate(self, password, user=None):
        if not re.search(r"[A-Z]", password):
            raise ValidationError(
                _("This password must contain at least one uppercase letter."),
                code='password_no_upper',
            )
        if not re.search(r"\d", password):
            raise ValidationError(
                _("This password must contain at least one digit."),
                code='password_no_digit',
            )
        if not re.search(r"[^A-Za-z0-9]", password):
            raise ValidationError(
                _("This password must contain at least one special character (e.g. !@#$%)."),
                code='password_no_special',
            )

    def get_help_text(self):
        return _(
            "Your password must contain at least one uppercase letter, one digit, and one special character."
        )

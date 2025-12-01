import re
from django.core.exceptions import ValidationError
from django.utils.translation import gettext as _


class ComplexPasswordValidator:
    """Require at least one uppercase letter, one digit, and one special character.

    This validator is deliberately simple and covers the common constraints
    requested by the user.
    """

    def validate(self, password, user=None):
        errors = []
        if not re.search(r"[A-Z]", password):
            errors.append(_('The password must contain at least one uppercase letter.'))
        if not re.search(r"\d", password):
            errors.append(_('The password must contain at least one digit.'))
        if not re.search(r"[^A-Za-z0-9]", password):
            errors.append(_('The password must contain at least one special character.'))

        if errors:
            raise ValidationError(errors)

    def get_help_text(self):
        return _(
            "Your password must contain at least one uppercase letter, one digit, and one special character."
        )

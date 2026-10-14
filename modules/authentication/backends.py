from django.contrib.auth import get_user_model
from django.contrib.auth.backends import ModelBackend


class EmailOrUsernameModelBackend(ModelBackend):
    """Authenticate with either the username or the email address.

    The login page asks for "Username / Institutional Email", so both must work.
    """

    def authenticate(self, request, username=None, password=None, **kwargs):
        if username is None or password is None:
            return None
        User = get_user_model()
        identifier = username.strip()
        if "@" in identifier:
            # Emails are stored lower-cased at signup; fall back to username
            # in case someone registered a username containing "@".
            user = User.objects.filter(email__iexact=identifier).order_by("id").first()
            if user is None:
                user = User.objects.filter(username=identifier).first()
        else:
            user = User.objects.filter(username=identifier).first()

        if user is None:
            # Run the hasher anyway to reduce timing differences.
            User().set_password(password)
            return None
        if user.check_password(password) and self.user_can_authenticate(user):
            return user
        return None

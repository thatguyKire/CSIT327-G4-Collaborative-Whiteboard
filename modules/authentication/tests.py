from django.urls import reverse

from modules.authentication.models import CustomUser
from modules.core.testing import CollaboardTestCase, TEST_PASSWORD


class SignupTests(CollaboardTestCase):
    def signup(self, **overrides):
        data = {
            "username": "newstudent",
            "email": "NewStudent@cit.edu",
            "student_id": "2024-9999",
            "role": "student",
            "password1": "An0ther!Pass",
            "password2": "An0ther!Pass",
        }
        data.update(overrides)
        return self.client.post(reverse("auth:signup"), data)

    def test_student_signup_logs_in_and_goes_to_dashboard(self):
        resp = self.signup()
        self.assertRedirects(resp, reverse("redirect_dashboard"), target_status_code=302)
        user = CustomUser.objects.get(username="newstudent")
        self.assertEqual(user.email, "newstudent@cit.edu")
        self.assertEqual(user.role, "student")

    def test_student_requires_student_id(self):
        resp = self.signup(student_id="")
        self.assertEqual(resp.status_code, 200)
        self.assertFalse(CustomUser.objects.filter(username="newstudent").exists())

    def test_teachers_do_not_collide_on_empty_student_id(self):
        self.signup(username="t1", email="t1@cit.edu", role="teacher", student_id="")
        self.signup(username="t2", email="t2@cit.edu", role="teacher", student_id="")
        self.assertEqual(CustomUser.objects.filter(username__in=["t1", "t2"], student_id__isnull=True).count(), 2)

    def test_cannot_sign_up_as_admin(self):
        self.signup(role="admin")
        self.assertFalse(CustomUser.objects.filter(username="newstudent").exists())

    def test_weak_password_rejected_once_per_rule(self):
        resp = self.signup(password1="weakpassword1", password2="weakpassword1")
        self.assertEqual(resp.status_code, 200)
        errors = resp.context["form"].non_field_errors()
        upper_msgs = [e for e in errors if "uppercase" in e]
        self.assertEqual(len(upper_msgs), 1)  # duplicate validator removed

    def test_duplicate_email_rejected(self):
        resp = self.signup(email="STUDENT1@cit.edu")
        self.assertEqual(resp.status_code, 200)
        self.assertIn("email", resp.context["form"].errors)


class LoginTests(CollaboardTestCase):
    def test_login_with_username(self):
        resp = self.client.post(reverse("auth:login"), {"username": "teacher1", "password": TEST_PASSWORD})
        self.assertRedirects(resp, reverse("redirect_dashboard"), fetch_redirect_response=False)

    def test_login_with_email_case_insensitive(self):
        resp = self.client.post(reverse("auth:login"), {"username": "Teacher1@CIT.edu", "password": TEST_PASSWORD})
        self.assertRedirects(resp, reverse("redirect_dashboard"), fetch_redirect_response=False)

    def test_wrong_password(self):
        resp = self.client.post(reverse("auth:login"), {"username": "teacher1@cit.edu", "password": "nope"})
        self.assertEqual(resp.status_code, 200)
        self.assertNotIn("_auth_user_id", self.client.session)

    def test_role_redirects(self):
        for user, target in [(self.teacher, "teacher_dashboard"), (self.student, "student_dashboard")]:
            self.client.force_login(user)
            resp = self.client.get(reverse("redirect_dashboard"))
            self.assertRedirects(resp, reverse(target))

    def test_superuser_becomes_admin(self):
        admin = CustomUser.objects.create_superuser("root", "root@cit.edu", TEST_PASSWORD)
        self.assertEqual(admin.role, "admin")
        self.client.force_login(admin)
        self.assertRedirects(self.client.get(reverse("redirect_dashboard")), reverse("admin_dashboard"))

    def test_logout_is_post(self):
        self.client.force_login(self.student)
        resp = self.client.post(reverse("auth:logout"))
        self.assertEqual(resp.status_code, 302)
        self.assertNotIn("_auth_user_id", self.client.session)

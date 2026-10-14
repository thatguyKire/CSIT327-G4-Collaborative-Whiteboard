"""Shared helpers for the test suite."""
import shutil
import tempfile

from django.test import TestCase, override_settings

from modules.authentication.models import CustomUser
from modules.session.models import Session, Participant, generate_session_code

TEST_PASSWORD = "Str0ng!Pass"

_TEMP_MEDIA = tempfile.mkdtemp(prefix="collaboard-test-media-")


@override_settings(
    # Templates use {% static %}; the manifest storage needs collectstatic first.
    STORAGES={
        "default": {"BACKEND": "django.core.files.storage.FileSystemStorage",
                    "OPTIONS": {"location": _TEMP_MEDIA, "base_url": "/media/"}},
        "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"},
    },
    MEDIA_ROOT=_TEMP_MEDIA,
)
class CollaboardTestCase(TestCase):
    """Creates a teacher, two students and one session owned by the teacher."""

    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(_TEMP_MEDIA, ignore_errors=True)

    @classmethod
    def setUpTestData(cls):
        cls.teacher = cls.make_user("teacher1", "teacher")
        cls.student = cls.make_user("student1", "student", student_id="2024-0001")
        cls.other_student = cls.make_user("student2", "student", student_id="2024-0002")
        cls.session = Session.objects.create(title="Algebra", created_by=cls.teacher, code=generate_session_code())

    @staticmethod
    def make_user(username, role, **extra):
        return CustomUser.objects.create_user(
            username=username, email=f"{username}@cit.edu", password=TEST_PASSWORD, role=role, **extra
        )

    def join(self, user, session=None, can_draw=False):
        return Participant.objects.create(user=user, session=session or self.session, can_draw=can_draw)

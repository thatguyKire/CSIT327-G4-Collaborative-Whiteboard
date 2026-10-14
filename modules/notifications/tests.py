from django.urls import reverse

from modules.core.testing import CollaboardTestCase
from modules.notifications.models import Notification


class AnnouncementTests(CollaboardTestCase):
    def announce(self, text, urgent=False):
        return self.client.post(
            reverse("notifications:send_announcement", args=[self.session.id]),
            {"message": text, "urgent": "1" if urgent else ""},
        )

    def test_announcement_reaches_participants_only(self):
        self.join(self.student)
        self.client.force_login(self.teacher)
        self.assertEqual(self.announce("Quiz at 3pm").json()["sent"], 1)
        self.assertTrue(Notification.objects.filter(recipient=self.student, content="Quiz at 3pm").exists())
        self.assertFalse(Notification.objects.filter(recipient=self.other_student).exists())

    def test_double_submit_is_suppressed_but_later_repeat_allowed(self):
        self.join(self.student)
        self.client.force_login(self.teacher)
        self.announce("Submit your work")
        self.announce("Submit your work")
        self.assertEqual(Notification.objects.count(), 1)
        Notification.objects.update(created_at="2020-01-01T00:00:00Z")
        self.announce("Submit your work")
        self.assertEqual(Notification.objects.count(), 2)

    def test_students_cannot_announce(self):
        self.join(self.student)
        self.client.force_login(self.student)
        self.assertEqual(self.announce("hi").status_code, 403)

    def test_student_sees_own_session_announcements(self):
        self.join(self.student)
        self.client.force_login(self.teacher)
        self.announce("Read chapter 2")
        self.client.force_login(self.student)
        items = self.client.get(
            reverse("notifications:session_student_announcements_json", args=[self.session.id])
        ).json()["items"]
        self.assertEqual([i["content"] for i in items], ["Read chapter 2"])


class ReadStateTests(CollaboardTestCase):
    def test_mark_all_read_requires_post(self):
        Notification.objects.create(recipient=self.student, content="x")
        self.client.force_login(self.student)
        self.assertEqual(self.client.get(reverse("notifications:mark_all_read")).status_code, 405)
        self.client.post(reverse("notifications:mark_all_read"))
        self.assertEqual(self.client.get(reverse("notifications:unread_count")).json()["count"], 0)

    def test_cannot_mark_someone_elses(self):
        n = Notification.objects.create(recipient=self.other_student, content="x")
        self.client.force_login(self.student)
        self.assertEqual(self.client.post(reverse("notifications:mark_read", args=[n.id])).status_code, 404)

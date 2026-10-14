import json

from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse

from modules.core.testing import CollaboardTestCase
from modules.session.models import Session, Participant, UploadedFile, SESSION_CODE_ALPHABET

def _png_bytes():
    import io
    from PIL import Image
    buf = io.BytesIO()
    Image.new("RGBA", (4, 4), (255, 0, 0, 128)).save(buf, format="PNG")
    return buf.getvalue()


PNG_1x1 = _png_bytes()


class SessionManagementTests(CollaboardTestCase):
    def test_create_session_generates_readable_code(self):
        self.client.force_login(self.teacher)
        resp = self.client.post(reverse("create_session"), {"title": "Geometry"})
        session = Session.objects.get(title="Geometry")
        self.assertRedirects(resp, reverse("whiteboard", args=[session.id]))
        self.assertEqual(len(session.code), 6)
        self.assertTrue(set(session.code) <= set(SESSION_CODE_ALPHABET))

    def test_duplicate_title_rejected_for_same_teacher_only(self):
        self.client.force_login(self.teacher)
        self.client.post(reverse("create_session"), {"title": "algebra"})  # case-insensitive clash
        self.assertEqual(Session.objects.filter(created_by=self.teacher).count(), 1)

        other_teacher = self.make_user("teacher2", "teacher")
        self.client.force_login(other_teacher)
        self.client.post(reverse("create_session"), {"title": "Algebra"})
        self.assertTrue(Session.objects.filter(created_by=other_teacher, title="Algebra").exists())

    def test_title_too_long(self):
        self.client.force_login(self.teacher)
        self.client.post(reverse("create_session"), {"title": "x" * 101})
        self.assertEqual(Session.objects.count(), 1)

    def test_create_get_redirects_to_list(self):
        self.client.force_login(self.teacher)
        self.assertRedirects(self.client.get(reverse("create_session")), reverse("session_list"))

    def test_students_cannot_manage_sessions(self):
        self.client.force_login(self.student)
        resp = self.client.post(reverse("create_session"), {"title": "Hack"})
        self.assertFalse(Session.objects.filter(title="Hack").exists())
        self.assertEqual(resp.status_code, 302)

    def test_duplicate_session(self):
        self.client.force_login(self.teacher)
        self.client.post(reverse("duplicate_session", args=[self.session.id]))
        self.client.post(reverse("duplicate_session", args=[self.session.id]))
        titles = set(Session.objects.filter(created_by=self.teacher).values_list("title", flat=True))
        self.assertEqual(titles, {"Algebra", "Algebra (copy)", "Algebra (copy 2)"})

    def test_delete_requires_owner(self):
        self.client.force_login(self.student)
        self.client.post(reverse("delete_session", args=[self.session.id]))
        self.assertTrue(Session.objects.filter(id=self.session.id).exists())
        self.client.force_login(self.teacher)
        self.client.post(reverse("delete_session", args=[self.session.id]))
        self.assertFalse(Session.objects.filter(id=self.session.id).exists())

    def test_search(self):
        Session.objects.create(title="Biology", created_by=self.teacher, code="BIO234")
        self.client.force_login(self.teacher)
        resp = self.client.get(reverse("session_list"), {"q": "bio"})
        self.assertEqual([s.title for s in resp.context["sessions"]], ["Biology"])

    def test_qr_points_to_join_page(self):
        self.client.force_login(self.teacher)
        resp = self.client.get(reverse("session_qr", args=[self.session.id]))
        self.assertEqual(resp["Content-Type"], "image/png")


class JoinAndAccessTests(CollaboardTestCase):
    def test_join_with_code_case_insensitive(self):
        self.client.force_login(self.student)
        resp = self.client.post(reverse("join_session"), {"code": self.session.code.lower()})
        self.assertRedirects(resp, reverse("student_whiteboard", args=[self.session.id]))
        p = Participant.objects.get(user=self.student, session=self.session)
        self.assertFalse(p.can_draw)
        self.assertIsNotNone(p.last_active)

    def test_rejoin_does_not_duplicate(self):
        self.client.force_login(self.student)
        for _ in range(2):
            self.client.post(reverse("join_session"), {"code": self.session.code})
        self.assertEqual(Participant.objects.filter(user=self.student).count(), 1)

    def test_invalid_code(self):
        self.client.force_login(self.student)
        resp = self.client.post(reverse("join_session"), {"code": "NOPE99"})
        self.assertContains(resp, "Invalid session code")

    def test_join_prefills_code_from_qr_link(self):
        self.client.force_login(self.student)
        resp = self.client.get(reverse("join_session"), {"code": "abc234"})
        self.assertContains(resp, 'value="ABC234"')

    def test_outsider_cannot_open_whiteboard(self):
        self.client.force_login(self.student)
        self.assertRedirects(self.client.get(reverse("whiteboard", args=[self.session.id])), reverse("join_session"))
        self.assertRedirects(
            self.client.get(reverse("student_whiteboard", args=[self.session.id])), reverse("join_session")
        )

    def test_participant_is_routed_to_student_view(self):
        self.join(self.student)
        self.client.force_login(self.student)
        resp = self.client.get(reverse("whiteboard", args=[self.session.id]))
        self.assertRedirects(resp, reverse("student_whiteboard", args=[self.session.id]))
        resp = self.client.get(reverse("student_whiteboard", args=[self.session.id]))
        self.assertEqual(resp.status_code, 200)
        self.assertFalse(resp.context["can_draw"])
        self.assertFalse(resp.context["is_teacher"])
        self.assertContains(resp, "studentAnnouncementBox")

    def test_teacher_view(self):
        self.client.force_login(self.teacher)
        resp = self.client.get(reverse("whiteboard", args=[self.session.id]))
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.context["is_teacher"])
        self.assertContains(resp, "participantsList")


class WhiteboardApiTests(CollaboardTestCase):
    def test_toggle_draw_permission_owner_only(self):
        self.join(self.student)
        url = reverse("toggle_draw_permission", args=[self.session.id, self.student.id])
        self.client.force_login(self.other_student)
        self.assertEqual(self.client.post(url, json.dumps({"can_draw": True}), content_type="application/json").status_code, 403)
        self.client.force_login(self.teacher)
        resp = self.client.post(url, json.dumps({"can_draw": True}), content_type="application/json")
        self.assertTrue(resp.json()["can_draw"])
        self.assertTrue(Participant.objects.get(user=self.student).can_draw)

    def test_presence_sync_with_nobody_present(self):
        """Regression: this used to crash (NameError) when the teacher left the page."""
        self.join(self.student, can_draw=True)
        self.client.force_login(self.teacher)
        resp = self.client.post(
            reverse("presence_sync", args=[self.session.id]),
            json.dumps({"present_user_ids": []}), content_type="application/json",
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["updated_count"], 1)
        self.assertFalse(Participant.objects.get(user=self.student).can_draw)

    def test_presence_sync_keeps_present_users(self):
        self.join(self.student, can_draw=True)
        self.join(self.other_student, can_draw=True)
        self.client.force_login(self.teacher)
        resp = self.client.post(
            reverse("presence_sync", args=[self.session.id]),
            json.dumps({"present_user_ids": [self.student.id, "junk"]}), content_type="application/json",
        )
        data = resp.json()
        self.assertEqual(data["present"], [self.student.id])
        self.assertEqual(data["absent"], [self.other_student.id])
        self.assertTrue(Participant.objects.get(user=self.student).can_draw)
        self.assertFalse(Participant.objects.get(user=self.other_student).can_draw)

    def test_record_stroke(self):
        self.join(self.student, can_draw=True)
        self.client.force_login(self.student)
        url = reverse("record_stroke", args=[self.session.id])
        self.client.post(url)
        self.client.post(url)
        self.assertEqual(Participant.objects.get(user=self.student).strokes_count, 2)

    def test_record_stroke_view_only_rejected(self):
        self.join(self.student, can_draw=False)
        self.client.force_login(self.student)
        self.assertEqual(self.client.post(reverse("record_stroke", args=[self.session.id])).status_code, 403)

    def test_toggle_chat(self):
        self.client.force_login(self.teacher)
        resp = self.client.post(reverse("toggle_chat", args=[self.session.id]))
        self.assertFalse(resp.json()["chat_enabled"])

    def test_save_snapshot_then_export_pdf(self):
        self.client.force_login(self.teacher)
        resp = self.client.post(
            reverse("save_snapshot", args=[self.session.id]),
            {"image": SimpleUploadedFile("s.png", PNG_1x1, "image/png")},
        )
        self.assertTrue(resp.json()["ok"])
        url = resp.json()["url"]
        self.assertTrue(url.startswith("/media/snapshots/"))
        self.session.refresh_from_db()
        self.assertEqual(self.session.snapshot_url, url)
        self.assertTrue(self.session.is_saved)

        # The file is served by the app (works with DEBUG=False too)
        served = self.client.get(url)
        self.assertEqual(served.status_code, 200)
        self.assertEqual(b"".join(served.streaming_content)[:8], PNG_1x1[:8])

        pdf = self.client.get(reverse("export_session_pdf", args=[self.session.id]))
        self.assertEqual(pdf["Content-Type"], "application/pdf")
        self.assertEqual(b"".join(pdf.streaming_content)[:5], b"%PDF-")

    def test_snapshot_must_be_png(self):
        self.client.force_login(self.teacher)
        resp = self.client.post(
            reverse("save_snapshot", args=[self.session.id]),
            {"image": SimpleUploadedFile("s.png", b"<html>nope</html>", "image/png")},
        )
        self.assertEqual(resp.status_code, 400)

    def test_snapshot_owner_only(self):
        self.join(self.student, can_draw=True)
        self.client.force_login(self.student)
        resp = self.client.post(
            reverse("save_snapshot", args=[self.session.id]),
            {"image": SimpleUploadedFile("s.png", PNG_1x1, "image/png")},
        )
        self.assertEqual(resp.status_code, 403)

    def test_pdf_without_snapshot(self):
        self.client.force_login(self.teacher)
        self.assertEqual(self.client.get(reverse("export_session_pdf", args=[self.session.id])).status_code, 404)

    def test_attendance_csv(self):
        self.join(self.student)
        self.client.force_login(self.teacher)
        resp = self.client.get(reverse("attendance", args=[self.session.id]), {"export": "csv"})
        self.assertEqual(resp["Content-Type"], "text/csv")
        self.assertIn("student1", resp.content.decode())
        self.client.force_login(self.student)
        self.assertEqual(self.client.get(reverse("attendance_json", args=[self.session.id])).status_code, 403)


class UploadTests(CollaboardTestCase):
    def upload(self, name, content, content_type):
        return self.client.post(
            reverse("upload_attachment", args=[self.session.id]),
            {"file": SimpleUploadedFile(name, content, content_type)},
        )

    def test_teacher_upload_is_recorded(self):
        self.client.force_login(self.teacher)
        resp = self.upload("diagram.png", PNG_1x1, "image/png")
        data = resp.json()
        self.assertTrue(data["ok"])
        self.assertTrue(data["is_image"])
        f = UploadedFile.objects.get()
        self.assertEqual(f.original_name, "diagram.png")
        self.assertEqual(f.uploaded_by, self.teacher)

    def test_pdf_is_not_an_image(self):
        self.client.force_login(self.teacher)
        self.assertFalse(self.upload("notes.pdf", b"%PDF-1.4", "application/pdf").json()["is_image"])

    def test_student_needs_draw_permission(self):
        p = self.join(self.student, can_draw=False)
        self.client.force_login(self.student)
        self.assertEqual(self.upload("a.png", PNG_1x1, "image/png").status_code, 403)
        p.can_draw = True
        p.save()
        self.assertEqual(self.upload("a.png", PNG_1x1, "image/png").status_code, 200)
        self.assertEqual(Participant.objects.get(pk=p.pk).uploads_count, 1)

    def test_rejects_unsupported_type(self):
        self.client.force_login(self.teacher)
        resp = self.upload("evil.exe", b"MZ", "application/octet-stream")
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(UploadedFile.objects.count(), 0)

from django.contrib.auth.models import AbstractUser
from django.db import models

class CustomUser(AbstractUser):
    role = models.CharField(
        max_length=10,
        choices=[("student", "Student"), ("teacher", "Teacher"), ("admin", "Admin")],
        default="student"
    )
    student_id = models.CharField(max_length=20, blank=True, null=True)

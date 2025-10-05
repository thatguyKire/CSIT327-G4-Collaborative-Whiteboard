from django.contrib.auth.models import AbstractUser
from django.db import models

class CustomUser(AbstractUser):
    ROLE_CHOICES = (
        ('student', 'Student'),
        ('teacher', 'Teacher'),
        ('admin', 'Admin'),
    )
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='student')
    student_id = models.CharField(max_length=50, blank=True, null=True)

    def save(self, *args, **kwargs):
        # Automatically assign admin role for superusers
        if self.is_superuser:
            self.role = 'admin'
        super().save(*args, **kwargs)


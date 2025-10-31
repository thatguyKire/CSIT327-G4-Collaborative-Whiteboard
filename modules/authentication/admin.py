# modules/authentication/admin.py
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from modules.authentication.models import CustomUser  # ✅ updated path

@admin.register(CustomUser)
class CustomUserAdmin(UserAdmin):
    list_display = ('email', 'username', 'role', 'student_id', 'is_active', 'is_staff')
    search_fields = ('email', 'username', 'student_id')
    list_filter = ('role', 'is_staff', 'is_active')
    ordering = ('email',)

    fieldsets = (
        (None, {'fields': ('email', 'username', 'password')}),
        ('Personal Info', {'fields': ('student_id',)}),
        ('Permissions', {'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
        ('Role', {'fields': ('role',)}),
    )

    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'username', 'role', 'student_id', 'password1', 'password2'),
        }),
    )

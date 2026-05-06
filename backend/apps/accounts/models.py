"""Authentication & authorisation models.

User       : extends Django's AbstractUser with hospital + employee profile fields
Role       : code (e.g. DOCTOR, NURSE) + permissions M2M
Permission : code (e.g. opd.view) + module label
UserRole   : through-table allowing role + optional department scope
"""
from __future__ import annotations
from django.contrib.auth.models import AbstractUser
from django.db import models


class Permission(models.Model):
    """Format: 'module.action', e.g. 'opd.view', 'pharmacy.dispense'."""
    code = models.CharField(max_length=100, unique=True)
    description = models.CharField(max_length=255)
    module = models.CharField(max_length=50, db_index=True)

    class Meta:
        ordering = ["module", "code"]

    def __str__(self):
        return self.code


class Role(models.Model):
    """Per-hospital role. SUPER_ADMIN is global (hospital nullable)."""
    hospital = models.ForeignKey(
        "core.Hospital",
        on_delete=models.CASCADE,
        related_name="roles",
        null=True, blank=True,
    )
    code = models.CharField(max_length=30)
    name = models.CharField(max_length=80)
    description = models.TextField(blank=True)
    permissions = models.ManyToManyField(Permission, related_name="roles", blank=True)
    is_system = models.BooleanField(default=False, help_text="Cannot be edited/deleted from UI")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [("hospital", "code")]
        ordering = ["code"]

    def __str__(self):
        return f"{self.code} ({self.hospital or 'GLOBAL'})"


class User(AbstractUser):
    """HMS user. Username = login id; staff/employee linkage filled in HR module."""
    hospital = models.ForeignKey(
        "core.Hospital",
        on_delete=models.PROTECT,
        related_name="users",
        null=True, blank=True,
    )
    phone = models.CharField(max_length=15, blank=True)
    employee_code = models.CharField(max_length=30, blank=True, db_index=True)
    designation = models.CharField(max_length=80, blank=True)
    profile_photo = models.ImageField(upload_to="users/photos/", blank=True, null=True)
    must_change_password = models.BooleanField(default=False)
    last_login_ip = models.GenericIPAddressField(null=True, blank=True)
    is_locked = models.BooleanField(default=False)
    failed_login_attempts = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["username"]

    def __str__(self):
        return self.get_full_name() or self.username

    @property
    def role_codes(self) -> list[str]:
        return list(self.user_roles.values_list("role__code", flat=True))

    @property
    def permission_codes(self) -> set[str]:
        return set(
            self.user_roles.values_list("role__permissions__code", flat=True)
        ) - {None}

    def has_module_perm(self, code: str) -> bool:
        if self.is_superuser:
            return True
        return code in self.permission_codes


class UserRole(models.Model):
    """Through-table: user holds role, optionally scoped to a department."""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="user_roles")
    role = models.ForeignKey(Role, on_delete=models.CASCADE, related_name="role_users")
    department = models.ForeignKey(
        "core.Department",
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="role_assignments",
    )
    assigned_at = models.DateTimeField(auto_now_add=True)
    assigned_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="assignments_made",
    )

    class Meta:
        unique_together = [("user", "role", "department")]

    def __str__(self):
        return f"{self.user} → {self.role}"

from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User, Role, Permission, UserRole


class UserRoleInline(admin.TabularInline):
    model = UserRole
    extra = 0
    fk_name = "user"
    raw_id_fields = ["role", "department"]


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ("username", "email", "hospital", "employee_code", "designation",
                    "is_active", "is_locked", "last_login")
    list_filter = ("is_active", "is_locked", "is_staff", "is_superuser", "hospital")
    search_fields = ("username", "email", "first_name", "last_name", "employee_code", "phone")
    inlines = [UserRoleInline]
    fieldsets = BaseUserAdmin.fieldsets + (
        ("HMS Profile", {
            "fields": ("hospital", "phone", "employee_code", "designation",
                       "profile_photo", "must_change_password", "is_locked",
                       "failed_login_attempts", "last_login_ip"),
        }),
    )


@admin.register(Permission)
class PermissionAdmin(admin.ModelAdmin):
    list_display = ("code", "module", "description")
    list_filter = ("module",)
    search_fields = ("code", "description")


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "hospital", "is_system")
    list_filter = ("is_system", "hospital")
    search_fields = ("code", "name")
    filter_horizontal = ("permissions",)


@admin.register(UserRole)
class UserRoleAdmin(admin.ModelAdmin):
    list_display = ("user", "role", "department", "assigned_at")
    raw_id_fields = ("user", "role", "department")

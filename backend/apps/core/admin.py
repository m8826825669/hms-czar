from django.contrib import admin
from simple_history.admin import SimpleHistoryAdmin

from .models import Hospital, Department, Location, Patient, AuditLog


@admin.register(Hospital)
class HospitalAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "city", "phone", "is_active")
    search_fields = ("code", "name", "city")
    list_filter = ("is_active", "state")


@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "dept_type", "hospital", "is_active")
    list_filter = ("dept_type", "is_active")
    search_fields = ("code", "name")


@admin.register(Location)
class LocationAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "location_type", "department", "capacity")
    list_filter = ("location_type",)
    search_fields = ("code", "name")


@admin.register(Patient)
class PatientAdmin(SimpleHistoryAdmin):
    list_display = ("mrn", "full_name", "age", "gender", "phone", "blood_group")
    search_fields = ("mrn", "first_name", "last_name", "phone", "abha_id")
    list_filter = ("gender", "blood_group", "is_vip", "is_deceased")
    readonly_fields = ("uuid", "mrn", "created_at", "updated_at")


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ("action", "user", "target_type", "target_id", "ip_address", "created_at")
    list_filter = ("action",)
    search_fields = ("user__username", "target_id", "ip_address")
    readonly_fields = [f.name for f in AuditLog._meta.fields]

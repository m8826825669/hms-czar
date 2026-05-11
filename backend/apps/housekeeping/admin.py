from django.contrib import admin
from .models import (
    HKZone, HKStaff, HKTaskTemplate, HKTaskAssignment, DeepCleaningSchedule,
)


@admin.register(HKZone)
class HKZoneAdmin(admin.ModelAdmin):
    list_display = ["code", "name", "zone_type", "criticality", "floor", "is_active"]
    list_filter = ["zone_type", "criticality", "is_active"]
    search_fields = ["code", "name"]


@admin.register(HKStaff)
class HKStaffAdmin(admin.ModelAdmin):
    list_display = ["employee_code", "full_name", "role", "shift",
                     "is_on_duty", "is_active"]
    list_filter = ["role", "shift", "is_on_duty"]
    search_fields = ["employee_code", "full_name"]


@admin.register(HKTaskTemplate)
class HKTaskTemplateAdmin(admin.ModelAdmin):
    list_display = ["code", "name", "zone", "task_type",
                     "frequency", "duration_minutes", "is_active"]
    list_filter = ["task_type", "frequency", "is_active"]
    autocomplete_fields = ["zone"]
    search_fields = ("code", "name")

@admin.register(HKTaskAssignment)
class HKTaskAssignmentAdmin(admin.ModelAdmin):
    list_display = ["template", "zone", "assigned_to",
                     "scheduled_date", "status", "quality_rating"]
    list_filter = ["status", "scheduled_date", "zone"]
    autocomplete_fields = ["template", "zone", "assigned_to", "inspected_by"]


@admin.register(DeepCleaningSchedule)
class DeepCleaningScheduleAdmin(admin.ModelAdmin):
    list_display = ["zone", "event_type", "scheduled_date", "status",
                     "cost", "next_due_date"]
    list_filter = ["event_type", "status"]
    autocomplete_fields = ["zone"]

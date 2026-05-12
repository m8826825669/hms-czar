from django.contrib import admin
from .models import SecurityGuard, VisitorPass, GatePass, Incident


@admin.register(SecurityGuard)
class SecurityGuardAdmin(admin.ModelAdmin):
    list_display = ["employee_code", "full_name", "phone",
                     "is_supervisor", "posted_at", "is_active"]
    list_filter = ["is_active", "is_supervisor"]
    search_fields = ["employee_code", "full_name"]


@admin.register(VisitorPass)
class VisitorPassAdmin(admin.ModelAdmin):
    list_display = ["pass_number", "visitor_name", "visit_type",
                     "department_to_visit", "entry_time", "status"]
    list_filter = ["status", "visit_type"]
    search_fields = ["pass_number", "visitor_name", "visitor_phone"]
    raw_id_fields = ["visiting_patient", "department_to_visit",
                              "issued_by", "exit_logged_by"]
    readonly_fields = ["pass_number", "created_at", "updated_at"]


@admin.register(GatePass)
class GatePassAdmin(admin.ModelAdmin):
    list_display = ["pass_number", "pass_type", "issued_to_party",
                     "vehicle_number", "issued_at", "status"]
    list_filter = ["status", "pass_type"]
    search_fields = ["pass_number", "issued_to_party"]
    raw_id_fields = ["sender_department", "received_at_gate_by"]
    readonly_fields = ["pass_number", "created_at", "updated_at"]


@admin.register(Incident)
class IncidentAdmin(admin.ModelAdmin):
    list_display = ["incident_number", "incident_type", "severity",
                     "title", "occurred_at", "status"]
    list_filter = ["status", "incident_type", "severity"]
    search_fields = ["incident_number", "title", "location"]
    raw_id_fields = ["department", "handled_by"]
    readonly_fields = ["incident_number", "created_at", "updated_at"]

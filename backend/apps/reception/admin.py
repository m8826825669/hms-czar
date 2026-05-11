from django.contrib import admin
from .models import Appointment, QueueToken, VisitorPass


@admin.register(Appointment)
class AppointmentAdmin(admin.ModelAdmin):
    list_display = ("code", "patient", "doctor", "scheduled_date",
                    "scheduled_time", "status")
    list_filter = ("status", "visit_type", "source", "scheduled_date")
    search_fields = ("code", "patient__mrn", "patient__phone",
                     "patient__first_name", "patient__last_name")
    date_hierarchy = "scheduled_date"
    autocomplete_fields = ("patient", "doctor", "location")

# @admin.register(Patient)
# class PatientAdmin(admin.ModelAdmin):
#     list_display = ("mrn", "first_name", "last_name", "phone", "gender", "dob")
#     search_fields = ("mrn", "first_name", "last_name", "phone", "email")  # ← required

@admin.register(QueueToken)
class QueueTokenAdmin(admin.ModelAdmin):
    list_display = ("token_no", "patient", "doctor", "visit_date",
                    "priority", "status", "issued_at")
    list_filter = ("status", "priority", "visit_date")
    search_fields = ("token_no", "patient__mrn", "patient__phone")
    date_hierarchy = "visit_date"


@admin.register(VisitorPass)
class VisitorPassAdmin(admin.ModelAdmin):
    list_display = ("pass_no", "visitor_name", "purpose",
                    "visiting_patient", "issued_at", "valid_until", "is_revoked")
    list_filter = ("purpose", "is_revoked")
    search_fields = ("pass_no", "visitor_name", "visitor_phone")
    date_hierarchy = "issued_at"

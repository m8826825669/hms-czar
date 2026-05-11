from django.contrib import admin
from .models import (
    OperationTheatre, SurgicalProcedure, SurgeryBooking,
    SurgeryTeam, OTRegister, OTConsumable,
)


@admin.register(OperationTheatre)
class OperationTheatreAdmin(admin.ModelAdmin):
    list_display = ["code", "name", "theatre_type", "floor", "status", "is_active"]
    list_filter = ["theatre_type", "status", "is_active"]
    search_fields = ["code", "name"]


@admin.register(SurgicalProcedure)
class SurgicalProcedureAdmin(admin.ModelAdmin):
    list_display = ["code", "name", "category", "typical_duration_minutes",
                     "base_price", "gst_rate", "is_active"]
    list_filter = ["category", "is_active", "requires_anaesthesia"]
    search_fields = ["code", "name"]


class SurgeryTeamInline(admin.TabularInline):
    model = SurgeryTeam
    extra = 0
    autocomplete_fields = ["doctor"]


class OTConsumableInline(admin.TabularInline):
    model = OTConsumable
    extra = 0
    readonly_fields = ["subtotal", "gst_amount", "total", "added_at"]


@admin.register(SurgeryBooking)
class SurgeryBookingAdmin(admin.ModelAdmin):
    list_display = ["code", "patient", "theatre", "procedure",
                     "scheduled_start", "status", "urgency"]
    list_filter = ["status", "urgency", "theatre"]
    search_fields = ["code", "patient__mrn"]
    autocomplete_fields = [
        "patient", "theatre", "procedure",
        "primary_surgeon", "anaesthetist", "admission", "invoice",
    ]
    readonly_fields = [
        "code", "actual_start", "actual_end",
        "locked_procedure_price", "locked_gst_rate",
        "cancellation_reason", "cancelled_at", "cancelled_by",
        "invoice", "created_at", "updated_at",
    ]
    inlines = [SurgeryTeamInline, OTConsumableInline]


@admin.register(OTRegister)
class OTRegisterAdmin(admin.ModelAdmin):
    list_display = ["booking", "prepared_by", "prepared_at", "finalized_at"]
    autocomplete_fields = ["booking", "prepared_by"]
    readonly_fields = ["prepared_at", "finalized_at"]

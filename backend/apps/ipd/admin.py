from django.contrib import admin
from .models import (Ward, Room, Bed, Admission, DailyCharge,
                     AdmissionService, DischargeSummary)


class RoomInline(admin.TabularInline):
    model = Room
    extra = 0


@admin.register(Ward)
class WardAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "ward_type", "default_bed_rent",
                    "default_gst_rate", "is_active")
    list_filter = ("ward_type", "is_active")
    search_fields = ("code", "name")
    inlines = [RoomInline]


class BedInline(admin.TabularInline):
    model = Bed
    extra = 0


@admin.register(Room)
class RoomAdmin(admin.ModelAdmin):
    list_display = ("ward", "number", "is_ac", "has_attached_bath")
    list_filter = ("ward", "is_ac", "has_attached_bath")
    search_fields = ("number",)
    inlines = [BedInline]


@admin.register(Bed)
class BedAdmin(admin.ModelAdmin):
    list_display = ("display_code", "status", "bed_rent",
                    "nursing_charge", "gst_rate")
    list_filter = ("status", "room__ward__ward_type")
    search_fields = ("label", "room__number", "room__ward__code")


class DailyChargeInline(admin.TabularInline):
    model = DailyCharge
    extra = 0
    readonly_fields = ("charge_date", "gst_amount", "total")


class AdmissionServiceInline(admin.TabularInline):
    model = AdmissionService
    extra = 0
    readonly_fields = ("subtotal", "gst_amount", "total")


@admin.register(Admission)
class AdmissionAdmin(admin.ModelAdmin):
    list_display = ("code", "patient", "bed", "attending_doctor",
                    "admitted_at", "discharged_at", "status")
    list_filter = ("status", "admission_type", "admitted_at",
                   "bed__room__ward__ward_type")
    search_fields = ("code", "patient__mrn", "patient__first_name",
                     "patient__last_name")
    date_hierarchy = "admitted_at"
    autocomplete_fields = ("patient", "bed", "attending_doctor",
                           "department", "invoice")
    readonly_fields = ("code", "locked_bed_rent", "locked_nursing_charge",
                       "locked_gst_rate", "discharged_at",
                       "discharge_type", "invoice")
    inlines = [DailyChargeInline, AdmissionServiceInline]


@admin.register(DischargeSummary)
class DischargeSummaryAdmin(admin.ModelAdmin):
    list_display = ("admission", "prepared_by", "prepared_at", "finalized_at")
    autocomplete_fields = ("admission", "prepared_by")
    readonly_fields = ("prepared_at", "finalized_at")

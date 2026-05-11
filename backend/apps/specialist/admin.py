from django.contrib import admin
from .models import (Doctor, Specialty, Qualification, OPDSlot,
                     OPDSlotException, ConsultationFee, OnCallRoster)

class DoctorAdmin(admin.ModelAdmin):
    search_fields = ("registration_number", "user__first_name", "user__last_name")

@admin.register(Specialty)
class SpecialtyAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "hospital", "is_active")
    search_fields = ("code", "name")


@admin.register(Qualification)
class QualificationAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "rank")
    list_filter = ("rank",)
    search_fields = ("code", "name")


class ConsultationFeeInline(admin.TabularInline):
    model = ConsultationFee
    extra = 0


class OPDSlotInline(admin.TabularInline):
    model = OPDSlot
    extra = 0


@admin.register(Doctor)
class DoctorAdmin(admin.ModelAdmin):
    list_display = ("registration_number", "full_name", "primary_department",
                    "is_consulting", "is_active")
    list_filter = ("is_consulting", "is_active", "primary_department")
    search_fields = ("registration_number", "user__first_name", "user__last_name")
    filter_horizontal = ("specialties", "qualifications")
    autocomplete_fields = ("user", "primary_department")
    inlines = [OPDSlotInline, ConsultationFeeInline]


@admin.register(OPDSlot)
class OPDSlotAdmin(admin.ModelAdmin):
    list_display = ("doctor", "day_of_week", "start_time", "end_time",
                    "location", "max_patients", "is_active")
    list_filter = ("day_of_week", "is_active")


@admin.register(OPDSlotException)
class OPDSlotExceptionAdmin(admin.ModelAdmin):
    list_display = ("doctor", "date", "exception_type", "reason")
    list_filter = ("exception_type", "date")


@admin.register(ConsultationFee)
class ConsultationFeeAdmin(admin.ModelAdmin):
    list_display = ("doctor", "visit_type", "amount", "valid_from", "valid_to")
    list_filter = ("visit_type",)


@admin.register(OnCallRoster)
class OnCallRosterAdmin(admin.ModelAdmin):
    list_display = ("date", "shift", "doctor", "department")
    list_filter = ("shift", "date")
    date_hierarchy = "date"

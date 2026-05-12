from django.contrib import admin
from .models import Vaccine, ImmunizationSchedule, VaccinationRecord, VaccinationCertificate


class ImmunizationScheduleInline(admin.TabularInline):
    model = ImmunizationSchedule
    extra = 0


@admin.register(Vaccine)
class VaccineAdmin(admin.ModelAdmin):
    list_display = ["code", "name", "vaccine_type", "doses_required",
                     "is_under_uip", "is_active"]
    list_filter = ["vaccine_type", "is_under_uip", "is_active"]
    search_fields = ["code", "name"]
    inlines = [ImmunizationScheduleInline]


@admin.register(VaccinationRecord)
class VaccinationRecordAdmin(admin.ModelAdmin):
    list_display = ["patient", "vaccine", "dose_number",
                     "status", "administered_date"]
    list_filter = ["status", "vaccine"]
    raw_id_fields = ["patient", "vaccine"]


@admin.register(VaccinationCertificate)
class VaccinationCertificateAdmin(admin.ModelAdmin):
    list_display = ["certificate_number", "record", "issued_at"]
    readonly_fields = ["certificate_number", "issued_at"]

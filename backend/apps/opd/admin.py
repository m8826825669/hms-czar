from django.contrib import admin
from .models import (Vitals, Consultation, ConsultationDiagnosis,
                     DrugMaster, Prescription, PrescriptionItem)


@admin.register(Vitals)
class VitalsAdmin(admin.ModelAdmin):
    list_display = ("patient", "recorded_at", "bp_text", "pulse_bpm",
                    "spo2_percent", "temperature_c", "weight_kg", "bmi")
    list_filter = ("recorded_at",)
    search_fields = ("patient__mrn", "patient__first_name", "patient__last_name")
    date_hierarchy = "recorded_at"


class ConsultationDiagnosisInline(admin.TabularInline):
    model = ConsultationDiagnosis
    extra = 0


@admin.register(Consultation)
class ConsultationAdmin(admin.ModelAdmin):
    list_display = ("code", "patient", "doctor", "consultation_date", "status")
    list_filter = ("status", "consultation_date")
    search_fields = ("code", "patient__mrn", "patient__first_name", "patient__last_name")
    date_hierarchy = "consultation_date"
    autocomplete_fields = ("patient", "doctor", "appointment", "queue_token", "vitals")
    inlines = [ConsultationDiagnosisInline]


@admin.register(DrugMaster)
class DrugMasterAdmin(admin.ModelAdmin):
    list_display = ("code", "generic_name", "brand_name", "dosage_form",
                    "strength", "gst_rate", "is_schedule_h")
    list_filter = ("dosage_form", "is_schedule_h")
    search_fields = ("code", "generic_name", "brand_name", "manufacturer")


class PrescriptionItemInline(admin.TabularInline):
    model = PrescriptionItem
    extra = 1


@admin.register(Prescription)
class PrescriptionAdmin(admin.ModelAdmin):
    list_display = ("code", "patient", "doctor", "prescribed_at", "is_signed")
    list_filter = ("is_signed", "prescribed_at")
    search_fields = ("code", "patient__mrn")
    date_hierarchy = "prescribed_at"
    inlines = [PrescriptionItemInline]

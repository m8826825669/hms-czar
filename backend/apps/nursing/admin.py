from django.contrib import admin

from .models import NursingNote, MedicationAdministration, ShiftHandover


@admin.register(NursingNote)
class NursingNoteAdmin(admin.ModelAdmin):
    list_display = ("noted_at", "admission", "note_type", "shift", "nurse", "hospital")
    list_filter = ("note_type", "shift", "hospital")
    search_fields = ("content", "admission__patient__first_name",
                     "admission__patient__last_name", "admission__patient__mrn")
    raw_id_fields = ("admission", "nurse", "parent_note", "created_by")
    readonly_fields = ("noted_at", "created_at", "updated_at")


@admin.register(MedicationAdministration)
class MedicationAdministrationAdmin(admin.ModelAdmin):
    list_display = ("scheduled_at", "admission", "_drug", "status",
                     "administered_at", "administered_by", "hospital")
    list_filter = ("status", "hospital")
    search_fields = ("admission__patient__mrn", "prescription_item__drug_name",
                     "reason", "response_note")
    raw_id_fields = ("admission", "prescription_item", "administered_by", "created_by")
    readonly_fields = ("created_at", "updated_at")
    date_hierarchy = "scheduled_at"

    def _drug(self, obj):
        return obj.prescription_item.drug_name if obj.prescription_item_id else "—"
    _drug.short_description = "Drug"


@admin.register(ShiftHandover)
class ShiftHandoverAdmin(admin.ModelAdmin):
    list_display = ("shift_date", "outgoing_shift", "admission", "priority",
                     "outgoing_nurse", "incoming_nurse", "acknowledged_at", "hospital")
    list_filter = ("outgoing_shift", "priority", "hospital", "shift_date")
    search_fields = ("admission__patient__mrn", "summary", "pending_tasks")
    raw_id_fields = ("admission", "outgoing_nurse", "incoming_nurse", "created_by")
    readonly_fields = ("acknowledged_at", "created_at", "updated_at")
    date_hierarchy = "shift_date"

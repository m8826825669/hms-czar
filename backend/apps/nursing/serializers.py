"""Nursing serializers — flat shapes with frontend-friendly derived fields.

Pattern adopted (lessons from this session):
  • Expose every enum's display label alongside the raw value (no more
    STATUS_CFG-undefined crashes)
  • Flatten FKs into _name companion fields (patient_name, nurse_name, etc.)
    so the frontend doesn't have to traverse relations
  • Computed fields (delay_minutes, can_acknowledge) emitted via
    SerializerMethodField
"""
from rest_framework import serializers

from .models import NursingNote, MedicationAdministration, ShiftHandover


class NursingNoteSerializer(serializers.ModelSerializer):
    nurse_name = serializers.SerializerMethodField()
    note_type_label = serializers.CharField(source="get_note_type_display", read_only=True)
    shift_label = serializers.CharField(source="get_shift_display", read_only=True)
    patient_name = serializers.SerializerMethodField()
    patient_mrn = serializers.SerializerMethodField()
    admission_code = serializers.SerializerMethodField()
    has_addenda = serializers.SerializerMethodField()

    class Meta:
        model = NursingNote
        fields = (
            "id", "admission", "admission_code",
            "patient_name", "patient_mrn",
            "note_type", "note_type_label",
            "shift", "shift_label",
            "nurse", "nurse_name",
            "content",
            "noted_at",
            "parent_note", "has_addenda",
            "created_at", "updated_at",
        )
        read_only_fields = ("hospital", "noted_at", "created_at", "updated_at", "nurse")

    def get_nurse_name(self, obj):
        return obj.nurse.get_full_name() or obj.nurse.username if obj.nurse_id else ""

    def get_patient_name(self, obj):
        try:
            return obj.admission.patient.full_name
        except Exception:
            return ""

    def get_patient_mrn(self, obj):
        try:
            return obj.admission.patient.mrn
        except Exception:
            return ""

    def get_admission_code(self, obj):
        return getattr(obj.admission, "code", "") if obj.admission_id else ""

    def get_has_addenda(self, obj):
        return obj.addenda.exists()


class MedicationAdministrationSerializer(serializers.ModelSerializer):
    drug_name = serializers.SerializerMethodField()
    dose = serializers.SerializerMethodField()
    frequency = serializers.SerializerMethodField()
    route = serializers.SerializerMethodField()
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    patient_name = serializers.SerializerMethodField()
    patient_mrn = serializers.SerializerMethodField()
    admission_code = serializers.SerializerMethodField()
    administered_by_name = serializers.SerializerMethodField()
    delay_minutes = serializers.IntegerField(read_only=True)  # @property on model

    class Meta:
        model = MedicationAdministration
        fields = (
            "id", "admission", "admission_code",
            "patient_name", "patient_mrn",
            "prescription_item",
            "drug_name", "dose", "frequency", "route",
            "scheduled_at", "administered_at",
            "status", "status_label",
            "administered_by", "administered_by_name",
            "actual_dose", "site", "reason", "response_note",
            "delay_minutes",
            "created_at", "updated_at",
        )
        read_only_fields = ("hospital", "created_at", "updated_at",
                            "administered_by", "administered_at")

    def get_drug_name(self, obj):
        return getattr(obj.prescription_item, "drug_name", "") if obj.prescription_item_id else ""

    def get_dose(self, obj):
        return getattr(obj.prescription_item, "dose", "") if obj.prescription_item_id else ""

    def get_frequency(self, obj):
        return getattr(obj.prescription_item, "frequency", "") if obj.prescription_item_id else ""

    def get_route(self, obj):
        return getattr(obj.prescription_item, "route", "") if obj.prescription_item_id else ""

    def get_patient_name(self, obj):
        try:
            return obj.admission.patient.full_name
        except Exception:
            return ""

    def get_patient_mrn(self, obj):
        try:
            return obj.admission.patient.mrn
        except Exception:
            return ""

    def get_admission_code(self, obj):
        return getattr(obj.admission, "code", "") if obj.admission_id else ""

    def get_administered_by_name(self, obj):
        if not obj.administered_by_id:
            return ""
        return obj.administered_by.get_full_name() or obj.administered_by.username


class ShiftHandoverSerializer(serializers.ModelSerializer):
    outgoing_nurse_name = serializers.SerializerMethodField()
    incoming_nurse_name = serializers.SerializerMethodField()
    outgoing_shift_label = serializers.CharField(source="get_outgoing_shift_display", read_only=True)
    priority_label = serializers.CharField(source="get_priority_display", read_only=True)
    patient_name = serializers.SerializerMethodField()
    patient_mrn = serializers.SerializerMethodField()
    admission_code = serializers.SerializerMethodField()
    bed_label = serializers.SerializerMethodField()
    is_acknowledged = serializers.SerializerMethodField()

    class Meta:
        model = ShiftHandover
        fields = (
            "id", "admission", "admission_code",
            "patient_name", "patient_mrn", "bed_label",
            "shift_date", "outgoing_shift", "outgoing_shift_label",
            "priority", "priority_label",
            "outgoing_nurse", "outgoing_nurse_name",
            "incoming_nurse", "incoming_nurse_name",
            "summary", "pending_tasks",
            "acknowledged_at", "is_acknowledged",
            "created_at", "updated_at",
        )
        read_only_fields = ("hospital", "created_at", "updated_at",
                            "acknowledged_at", "incoming_nurse")

    def get_outgoing_nurse_name(self, obj):
        if not obj.outgoing_nurse_id:
            return ""
        return obj.outgoing_nurse.get_full_name() or obj.outgoing_nurse.username

    def get_incoming_nurse_name(self, obj):
        if not obj.incoming_nurse_id:
            return ""
        return obj.incoming_nurse.get_full_name() or obj.incoming_nurse.username

    def get_patient_name(self, obj):
        try:
            return obj.admission.patient.full_name
        except Exception:
            return ""

    def get_patient_mrn(self, obj):
        try:
            return obj.admission.patient.mrn
        except Exception:
            return ""

    def get_admission_code(self, obj):
        return getattr(obj.admission, "code", "") if obj.admission_id else ""

    def get_bed_label(self, obj):
        try:
            bed = obj.admission.bed
            if bed:
                # Ward.code-Room.number-Bed.label (e.g. "GEN-101-A")
                parts = []
                if getattr(bed.room, "ward", None):
                    parts.append(bed.room.ward.code)
                if getattr(bed, "room", None):
                    parts.append(str(bed.room.number))
                parts.append(str(bed.label))
                return "-".join(parts)
        except Exception:
            pass
        return ""

    def get_is_acknowledged(self, obj):
        return obj.acknowledged_at is not None

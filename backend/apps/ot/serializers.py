from rest_framework import serializers
from .models import (
    OperationTheatre, SurgicalProcedure, SurgeryBooking,
    SurgeryTeam, OTRegister, OTConsumable,
)


class OperationTheatreSerializer(serializers.ModelSerializer):
    theatre_type_label = serializers.CharField(source="get_theatre_type_display", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = OperationTheatre
        fields = [
            "id", "hospital", "code", "name", "theatre_type", "theatre_type_label",
            "floor", "status", "status_label", "is_active", "notes",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class SurgicalProcedureSerializer(serializers.ModelSerializer):
    category_label = serializers.CharField(source="get_category_display", read_only=True)

    class Meta:
        model = SurgicalProcedure
        fields = [
            "id", "hospital", "code", "name", "category", "category_label",
            "typical_duration_minutes", "base_price", "hsn_code", "gst_rate",
            "requires_anaesthesia", "anaesthesia_type",
            "is_active", "description",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class SurgeryTeamSerializer(serializers.ModelSerializer):
    role_label = serializers.CharField(source="get_role_display", read_only=True)
    display_name = serializers.CharField(read_only=True)
    doctor_name = serializers.SerializerMethodField()

    class Meta:
        model = SurgeryTeam
        fields = [
            "id", "booking", "doctor", "doctor_name", "member_name",
            "role", "role_label", "display_name", "notes", "created_at",
        ]
        read_only_fields = ["id", "created_at"]

    def get_doctor_name(self, obj):
        if not obj.doctor:
            return None
        return f"Dr. {obj.doctor.user.get_full_name() or obj.doctor.user.username}"


class OTRegisterSerializer(serializers.ModelSerializer):
    is_finalized = serializers.BooleanField(read_only=True)
    prepared_by_name = serializers.SerializerMethodField()

    class Meta:
        model = OTRegister
        fields = [
            "id", "booking",
            "pre_op_findings", "surgical_steps", "intra_op_findings",
            "complications", "blood_loss_ml", "blood_transfused_units",
            "instruments_used", "implants_used", "specimens_sent",
            "anaesthesia_type", "anaesthesia_notes",
            "post_op_orders", "condition_on_shifting",
            "prepared_by", "prepared_by_name", "prepared_at", "finalized_at",
            "is_finalized",
        ]
        read_only_fields = ["id", "prepared_at", "finalized_at"]

    def get_prepared_by_name(self, obj):
        if not obj.prepared_by:
            return None
        return f"Dr. {obj.prepared_by.user.get_full_name() or obj.prepared_by.user.username}"


class OTConsumableSerializer(serializers.ModelSerializer):
    class Meta:
        model = OTConsumable
        fields = [
            "id", "booking", "item_name", "quantity", "unit",
            "unit_price", "gst_rate",
            "subtotal", "gst_amount", "total",
            "notes", "added_at", "added_by",
        ]
        read_only_fields = ["id", "subtotal", "gst_amount", "total", "added_at"]


class SurgeryBookingSerializer(serializers.ModelSerializer):
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    urgency_label = serializers.CharField(source="get_urgency_display", read_only=True)

    patient_name = serializers.SerializerMethodField()
    patient_mrn = serializers.CharField(source="patient.mrn", read_only=True)
    patient_age = serializers.SerializerMethodField()
    patient_gender = serializers.CharField(source="patient.gender", read_only=True)

    theatre_code = serializers.CharField(source="theatre.code", read_only=True)
    theatre_name = serializers.CharField(source="theatre.name", read_only=True)

    procedure_name = serializers.CharField(source="procedure.name", read_only=True)
    procedure_category = serializers.CharField(
        source="procedure.get_category_display", read_only=True,
    )

    primary_surgeon_name = serializers.SerializerMethodField()
    anaesthetist_name = serializers.SerializerMethodField()

    admission_code = serializers.CharField(source="admission.code", read_only=True)
    invoice_code = serializers.CharField(source="invoice.code", read_only=True)
    invoice_status = serializers.CharField(source="invoice.status", read_only=True)

    duration_minutes = serializers.IntegerField(read_only=True)

    team = SurgeryTeamSerializer(many=True, read_only=True)
    consumables = OTConsumableSerializer(many=True, read_only=True)
    ot_register = OTRegisterSerializer(read_only=True)

    class Meta:
        model = SurgeryBooking
        fields = [
            "id", "code", "hospital", "patient", "patient_name", "patient_mrn",
            "patient_age", "patient_gender",
            "theatre", "theatre_code", "theatre_name",
            "procedure", "procedure_name", "procedure_category",
            "primary_surgeon", "primary_surgeon_name",
            "anaesthetist", "anaesthetist_name",
            "admission", "admission_code",
            "urgency", "urgency_label",
            "status", "status_label",
            "scheduled_start", "scheduled_end",
            "actual_start", "actual_end",
            "duration_minutes",
            "pre_op_diagnosis", "pre_op_assessment",
            "consent_obtained", "consent_witness",
            "locked_procedure_price", "locked_gst_rate",
            "cancellation_reason", "cancelled_at", "cancelled_by",
            "invoice", "invoice_code", "invoice_status",
            "booked_by", "notes",
            "team", "consumables", "ot_register",
            "created_at", "updated_at",
        ]
        read_only_fields = [
            "id", "code", "actual_start", "actual_end",
            "locked_procedure_price", "locked_gst_rate",
            "cancellation_reason", "cancelled_at", "cancelled_by",
            "invoice", "created_at", "updated_at",
        ]

    def get_patient_name(self, obj):
        p = obj.patient
        if hasattr(p, "full_name"):
            return p.full_name
        return f"{getattr(p, 'first_name', '')} {getattr(p, 'last_name', '')}".strip()

    def get_patient_age(self, obj):
        return getattr(obj.patient, "age", None)

    def get_primary_surgeon_name(self, obj):
        d = obj.primary_surgeon
        return f"Dr. {d.user.get_full_name() or d.user.username}"

    def get_anaesthetist_name(self, obj):
        if not obj.anaesthetist:
            return None
        d = obj.anaesthetist
        return f"Dr. {d.user.get_full_name() or d.user.username}"

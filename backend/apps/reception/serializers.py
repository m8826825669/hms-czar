"""Reception serializers — extended with denormalized fields for the
reception dashboard page.

The dashboard's "today's appointments" view needs patient age/gender,
the doctor's department name, the visit_type display label, and the
token number assigned via the QueueToken on check-in. These were all
either computed in the frontend by hand-rolled mock data (bad) or read
through chained lookups in the UI (slow + brittle).

This serializer extension adds 5 derived fields to AppointmentSerializer
so the wire shape matches what UI consumers actually need. No model
changes; all fields are read-only derivations.
"""
import re
from rest_framework import serializers

from apps.core.models import Patient
from .models import Appointment, QueueToken, VisitorPass


class AppointmentSerializer(serializers.ModelSerializer):
    # Existing denormalized fields (kept as-is for backward compat)
    patient_name = serializers.CharField(source="patient.full_name", read_only=True)
    patient_mrn = serializers.CharField(source="patient.mrn", read_only=True)
    patient_phone = serializers.CharField(source="patient.phone", read_only=True)
    doctor_name = serializers.CharField(source="doctor.full_name", read_only=True)
    location_name = serializers.CharField(source="location.name", read_only=True, default="")
    status_label = serializers.CharField(source="get_status_display", read_only=True)

    # New denormalized fields for the reception dashboard
    patient_age = serializers.IntegerField(source="patient.age", read_only=True)
    patient_gender = serializers.CharField(source="patient.gender", read_only=True)
    department_name = serializers.CharField(
        source="doctor.primary_department.name", read_only=True, default="")
    visit_type_label = serializers.CharField(
        source="get_visit_type_display", read_only=True)
    token_number = serializers.SerializerMethodField()

    class Meta:
        model = Appointment
        fields = "__all__"
        read_only_fields = ("hospital", "code", "checked_in_at", "consult_started_at",
                            "consult_ended_at", "created_at", "updated_at")

    def get_token_number(self, obj):
        """Extract integer suffix from the linked QueueToken.token_no.

        token_no format is 'APT-YYYYMMDD-NNN' or 'WALK-YYYYMMDD-NNN'.
        Returns the trailing integer, or 0 if no token is linked yet
        (i.e. patient hasn't checked in).
        """
        qt = getattr(obj, "queue_token", None)
        if qt is None or not qt.token_no:
            return 0
        m = re.search(r"(\d+)$", qt.token_no)
        return int(m.group(1)) if m else 0


class QueueTokenSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source="patient.full_name", read_only=True)
    patient_mrn = serializers.CharField(source="patient.mrn", read_only=True)
    patient_age = serializers.IntegerField(source="patient.age", read_only=True)
    patient_gender = serializers.CharField(source="patient.gender", read_only=True)
    doctor_name = serializers.CharField(source="doctor.full_name", read_only=True)
    location_name = serializers.CharField(source="location.name", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = QueueToken
        fields = "__all__"
        read_only_fields = ("hospital", "token_no", "issued_at", "called_at",
                            "completed_at", "created_at", "updated_at")


class VisitorPassSerializer(serializers.ModelSerializer):
    visiting_patient_name = serializers.CharField(
        source="visiting_patient.full_name", read_only=True,
        default="")
    visiting_patient_mrn = serializers.CharField(
        source="visiting_patient.mrn", read_only=True, default="")
    is_active = serializers.BooleanField(read_only=True)

    class Meta:
        model = VisitorPass
        fields = "__all__"
        read_only_fields = ("hospital", "pass_uuid", "pass_no", "issued_at",
                            "entered_at", "exited_at", "created_at", "updated_at")

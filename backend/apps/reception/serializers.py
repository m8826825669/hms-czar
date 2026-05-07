from rest_framework import serializers
from apps.core.models import Patient
from .models import Appointment, QueueToken, VisitorPass


class AppointmentSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source="patient.full_name", read_only=True)
    patient_mrn = serializers.CharField(source="patient.mrn", read_only=True)
    patient_phone = serializers.CharField(source="patient.phone", read_only=True)
    doctor_name = serializers.CharField(source="doctor.full_name", read_only=True)
    location_name = serializers.CharField(source="location.name", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = Appointment
        fields = "__all__"
        read_only_fields = ("hospital", "code", "checked_in_at", "consult_started_at",
                            "consult_ended_at", "created_at", "updated_at")


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

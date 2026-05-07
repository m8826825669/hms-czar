from rest_framework import serializers
from .models import (Vitals, Consultation, ConsultationDiagnosis,
                     DrugMaster, Prescription, PrescriptionItem)


class VitalsSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source="patient.full_name", read_only=True)
    patient_mrn = serializers.CharField(source="patient.mrn", read_only=True)
    bp_text = serializers.CharField(read_only=True)

    class Meta:
        model = Vitals
        fields = "__all__"
        read_only_fields = ("hospital", "bmi", "created_at", "updated_at")


class ConsultationDiagnosisSerializer(serializers.ModelSerializer):
    class Meta:
        model = ConsultationDiagnosis
        fields = "__all__"
        read_only_fields = ("hospital", "created_at", "updated_at")


class DrugMasterSerializer(serializers.ModelSerializer):
    display_name = serializers.CharField(read_only=True)

    class Meta:
        model = DrugMaster
        fields = "__all__"
        read_only_fields = ("hospital", "created_at", "updated_at")


class PrescriptionItemSerializer(serializers.ModelSerializer):
    drug_display = serializers.CharField(source="drug.display_name", read_only=True, default="")

    class Meta:
        model = PrescriptionItem
        fields = "__all__"
        read_only_fields = ("hospital", "created_at", "updated_at")


class PrescriptionSerializer(serializers.ModelSerializer):
    items = PrescriptionItemSerializer(many=True, read_only=True)
    patient_name = serializers.CharField(source="patient.full_name", read_only=True)
    patient_mrn = serializers.CharField(source="patient.mrn", read_only=True)
    doctor_name = serializers.CharField(source="doctor.full_name", read_only=True)

    class Meta:
        model = Prescription
        fields = "__all__"
        read_only_fields = ("hospital", "code", "prescription_uuid", "is_signed",
                            "signed_at", "created_at", "updated_at")


class ConsultationSerializer(serializers.ModelSerializer):
    diagnoses = ConsultationDiagnosisSerializer(many=True, read_only=True)
    prescriptions = PrescriptionSerializer(many=True, read_only=True)
    vitals_data = VitalsSerializer(source="vitals", read_only=True)
    patient_name = serializers.CharField(source="patient.full_name", read_only=True)
    patient_mrn = serializers.CharField(source="patient.mrn", read_only=True)
    patient_age = serializers.IntegerField(source="patient.age", read_only=True)
    patient_gender = serializers.CharField(source="patient.gender", read_only=True)
    doctor_name = serializers.CharField(source="doctor.full_name", read_only=True)
    queue_token_no = serializers.CharField(source="queue_token.token_no", read_only=True, default="")

    class Meta:
        model = Consultation
        fields = "__all__"
        read_only_fields = ("hospital", "code", "started_at", "ended_at",
                            "created_at", "updated_at")

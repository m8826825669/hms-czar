"""Crisis serializers — flat shape + *_label/*_name companions.
"""
from rest_framework import serializers

from .models import EmergencyCode, CodeActivation, Drill


class EmergencyCodeSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmergencyCode
        fields = (
            "id", "code", "name", "description", "color",
            "is_active", "requires_evacuation", "default_response_minutes",
            "created_at", "updated_at",
        )
        read_only_fields = ("hospital", "created_at", "updated_at")


class CodeActivationSerializer(serializers.ModelSerializer):
    code_name = serializers.CharField(source="code.name", read_only=True)
    code_code = serializers.CharField(source="code.code", read_only=True)
    code_color = serializers.CharField(source="code.color", read_only=True)

    called_by_name = serializers.SerializerMethodField()
    department_name = serializers.CharField(source="department.name", read_only=True, default="")

    patient_name = serializers.SerializerMethodField()
    patient_mrn = serializers.CharField(source="patient.mrn", read_only=True, default="")

    outcome_label = serializers.CharField(source="get_outcome_display", read_only=True)

    responder_names = serializers.SerializerMethodField()
    responder_count = serializers.SerializerMethodField()

    is_resolved = serializers.BooleanField(read_only=True)
    response_seconds = serializers.IntegerField(read_only=True)
    total_duration_seconds = serializers.IntegerField(read_only=True)

    class Meta:
        model = CodeActivation
        fields = (
            "id",
            "code", "code_code", "code_name", "code_color",
            "called_at", "responded_at", "resolved_at",
            "location", "department", "department_name",
            "called_by", "called_by_name",
            "patient", "patient_name", "patient_mrn",
            "notes",
            "outcome", "outcome_label", "outcome_notes",
            "responders", "responder_names", "responder_count",
            "is_resolved", "response_seconds", "total_duration_seconds",
            "created_at", "updated_at",
        )
        read_only_fields = (
            "hospital", "created_at", "updated_at",
            "called_by", "responded_at", "resolved_at", "outcome",
        )

    def get_called_by_name(self, obj):
        if not obj.called_by_id:
            return ""
        return obj.called_by.get_full_name() or obj.called_by.username

    def get_patient_name(self, obj):
        if not obj.patient_id:
            return ""
        # core.Patient has full_name property/field — try .full_name then fallback
        return getattr(obj.patient, "full_name", "") or str(obj.patient)

    def get_responder_names(self, obj):
        return [
            (r.get_full_name() or r.username)
            for r in obj.responders.all()
        ]

    def get_responder_count(self, obj):
        return obj.responders.count()


class DrillSerializer(serializers.ModelSerializer):
    code_name = serializers.CharField(source="code.name", read_only=True)
    code_code = serializers.CharField(source="code.code", read_only=True)

    status_label = serializers.CharField(source="get_status_display", read_only=True)
    rating_label = serializers.CharField(source="get_rating_display", read_only=True)

    organizer_name = serializers.SerializerMethodField()
    participant_count = serializers.SerializerMethodField()
    observer_count = serializers.SerializerMethodField()

    is_overdue = serializers.SerializerMethodField()

    class Meta:
        model = Drill
        fields = (
            "id",
            "code", "code_code", "code_name",
            "scheduled_at", "started_at", "completed_at",
            "status", "status_label",
            "location",
            "organizer", "organizer_name",
            "participants", "participant_count",
            "observers", "observer_count",
            "rating", "rating_label",
            "expected_response_seconds", "actual_response_seconds",
            "notes", "is_overdue",
            "created_at", "updated_at",
        )
        read_only_fields = (
            "hospital", "created_at", "updated_at",
            "organizer", "started_at", "completed_at",
        )

    def get_organizer_name(self, obj):
        if not obj.organizer_id:
            return ""
        return obj.organizer.get_full_name() or obj.organizer.username

    def get_participant_count(self, obj):
        return obj.participants.count()

    def get_observer_count(self, obj):
        return obj.observers.count()

    def get_is_overdue(self, obj):
        """True if SCHEDULED but past its scheduled time by > 30 min."""
        from django.utils import timezone
        from datetime import timedelta
        if obj.status != "SCHEDULED":
            return False
        return obj.scheduled_at + timedelta(minutes=30) < timezone.now()

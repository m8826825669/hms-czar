"""Protection serializers — flat shape + *_label/*_name companions.

Confidentiality: the viewset enforces access control, but serializers do
NOT redact fields — once a user has access, they see everything. That
matches medico-legal practice: investigators need full context.
"""
from rest_framework import serializers

from .models import SafeguardingConcern, ConcernNote, ConcernReferral


class SafeguardingConcernSerializer(serializers.ModelSerializer):
    category_label = serializers.CharField(source="get_category_display", read_only=True)
    risk_level_label = serializers.CharField(source="get_risk_level_display", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)

    reporter_name = serializers.SerializerMethodField()
    investigator_name = serializers.SerializerMethodField()
    additional_viewer_names = serializers.SerializerMethodField()
    additional_viewer_count = serializers.SerializerMethodField()

    patient_name = serializers.SerializerMethodField()
    patient_mrn = serializers.CharField(source="patient.mrn", read_only=True, default="")
    patient_age = serializers.SerializerMethodField()

    is_sealed = serializers.BooleanField(read_only=True)
    days_open = serializers.IntegerField(read_only=True)

    note_count = serializers.SerializerMethodField()
    referral_count = serializers.SerializerMethodField()

    class Meta:
        model = SafeguardingConcern
        fields = (
            "id", "reference_number",
            "patient", "patient_name", "patient_mrn", "patient_age",
            "subject_description",
            "category", "category_label",
            "risk_level", "risk_level_label",
            "status", "status_label",
            "observations", "location_of_concern",
            "reporter", "reporter_name",
            "investigator", "investigator_name",
            "additional_viewers", "additional_viewer_names", "additional_viewer_count",
            "raised_at", "closed_at",
            "closure_summary",
            "is_sealed", "days_open",
            "note_count", "referral_count",
            "created_at", "updated_at",
        )
        read_only_fields = (
            "hospital", "created_at", "updated_at",
            "reporter", "raised_at", "closed_at",
        )

    def get_reporter_name(self, obj):
        if not obj.reporter_id:
            return ""
        return obj.reporter.get_full_name() or obj.reporter.username

    def get_investigator_name(self, obj):
        if not obj.investigator_id:
            return ""
        return obj.investigator.get_full_name() or obj.investigator.username

    def get_additional_viewer_names(self, obj):
        return [
            (u.get_full_name() or u.username)
            for u in obj.additional_viewers.all()
        ]

    def get_additional_viewer_count(self, obj):
        return obj.additional_viewers.count()

    def get_patient_name(self, obj):
        if not obj.patient_id:
            return ""
        return getattr(obj.patient, "full_name", "") or str(obj.patient)

    def get_patient_age(self, obj):
        if not obj.patient_id:
            return None
        return getattr(obj.patient, "age", None)

    def get_note_count(self, obj):
        return obj.notes.count()

    def get_referral_count(self, obj):
        return obj.referrals.count()

    def validate(self, data):
        """Either patient FK or subject_description must be provided."""
        # Build the effective combined state (existing + incoming)
        patient = data.get("patient", getattr(self.instance, "patient", None))
        subj = data.get("subject_description",
                        getattr(self.instance, "subject_description", "") or "")
        if not patient and not subj.strip():
            raise serializers.ValidationError({
                "subject_description": "Either patient FK or "
                                        "subject_description must be provided.",
            })
        return data


class ConcernNoteSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()
    note_type_label = serializers.CharField(source="get_note_type_display", read_only=True)
    concern_reference = serializers.CharField(source="concern.reference_number",
                                                read_only=True)

    class Meta:
        model = ConcernNote
        fields = (
            "id", "concern", "concern_reference",
            "author", "author_name",
            "note_type", "note_type_label",
            "body", "addendum_to",
            "created_at", "updated_at",
        )
        read_only_fields = ("hospital", "created_at", "updated_at", "author")

    def get_author_name(self, obj):
        if not obj.author_id:
            return ""
        return obj.author.get_full_name() or obj.author.username


class ConcernReferralSerializer(serializers.ModelSerializer):
    agency_type_label = serializers.CharField(source="get_agency_type_display", read_only=True)
    outcome_label = serializers.CharField(source="get_outcome_display", read_only=True)
    referred_by_name = serializers.SerializerMethodField()
    concern_reference = serializers.CharField(source="concern.reference_number",
                                                read_only=True)

    class Meta:
        model = ConcernReferral
        fields = (
            "id", "concern", "concern_reference",
            "agency_type", "agency_type_label",
            "agency_name", "contact_person", "contact_details",
            "referred_at",
            "referred_by", "referred_by_name",
            "reference_id_from_agency",
            "summary_shared",
            "outcome", "outcome_label",
            "outcome_notes", "outcome_updated_at",
            "created_at", "updated_at",
        )
        read_only_fields = (
            "hospital", "created_at", "updated_at",
            "referred_by", "referred_at", "outcome_updated_at",
        )

    def get_referred_by_name(self, obj):
        if not obj.referred_by_id:
            return ""
        return obj.referred_by.get_full_name() or obj.referred_by.username

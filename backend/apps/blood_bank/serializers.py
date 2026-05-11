from rest_framework import serializers
from .models import (
    BloodDonor, BloodDonation, BloodBag,
    BloodRequisition, CrossMatch, BloodIssue,
)


class BloodDonorSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)
    age = serializers.IntegerField(read_only=True)
    blood_group_label = serializers.CharField(source="get_blood_group_display", read_only=True)
    gender_label = serializers.CharField(source="get_gender_display", read_only=True)
    donor_type_label = serializers.CharField(source="get_donor_type_display", read_only=True)
    eligibility = serializers.SerializerMethodField()

    class Meta:
        model = BloodDonor
        fields = [
            "id", "donor_id", "hospital",
            "first_name", "last_name", "full_name",
            "gender", "gender_label", "dob", "age",
            "blood_group", "blood_group_label",
            "phone", "email", "address", "aadhaar_last4",
            "weight_kg", "is_eligible",
            "deferral_until", "deferral_reason",
            "donor_type", "donor_type_label",
            "last_donation_date", "total_donations",
            "eligibility", "notes",
            "created_at", "updated_at",
        ]
        read_only_fields = [
            "id", "donor_id", "last_donation_date", "total_donations",
            "created_at", "updated_at",
        ]

    def get_eligibility(self, obj):
        ok, reason = obj.can_donate_today()
        return {"can_donate": ok, "reason": reason}


class BloodDonationSerializer(serializers.ModelSerializer):
    donor_name = serializers.CharField(source="donor.full_name", read_only=True)
    donor_id_str = serializers.CharField(source="donor.donor_id", read_only=True)
    blood_group_label = serializers.CharField(source="get_blood_group_display", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    all_tests_complete = serializers.BooleanField(read_only=True)
    all_tests_passed = serializers.BooleanField(read_only=True)
    any_test_failed = serializers.BooleanField(read_only=True)

    class Meta:
        model = BloodDonation
        fields = [
            "id", "donation_id", "hospital",
            "donor", "donor_name", "donor_id_str",
            "donation_date", "volume_collected_ml",
            "blood_group", "blood_group_label",
            "pre_hb_g_dl", "pre_bp_systolic", "pre_bp_diastolic",
            "pre_pulse", "pre_temperature_c",
            "test_hiv", "test_hbsag", "test_hcv", "test_syphilis", "test_malaria",
            "all_tests_complete", "all_tests_passed", "any_test_failed",
            "screening_completed_at", "screened_by",
            "status", "status_label", "discard_reason",
            "collected_by", "notes",
            "created_at", "updated_at",
        ]
        read_only_fields = [
            "id", "donation_id", "donation_date",
            "screening_completed_at",
            "created_at", "updated_at",
        ]


class BloodBagSerializer(serializers.ModelSerializer):
    component_label = serializers.CharField(source="get_component_display", read_only=True)
    blood_group_label = serializers.CharField(source="get_blood_group_display", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    days_to_expiry = serializers.IntegerField(read_only=True)
    is_expired = serializers.BooleanField(read_only=True)
    donor_name = serializers.CharField(source="donation.donor.full_name", read_only=True)

    class Meta:
        model = BloodBag
        fields = [
            "id", "bag_id", "hospital",
            "donation", "donor_name",
            "component", "component_label",
            "blood_group", "blood_group_label",
            "volume_ml",
            "collected_at", "expiry_date",
            "days_to_expiry", "is_expired",
            "status", "status_label", "storage_location",
            "issued_to_requisition",
            "discard_reason", "discarded_at", "discarded_by",
            "notes",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "bag_id", "created_at", "updated_at"]


class CrossMatchSerializer(serializers.ModelSerializer):
    bag_id_str = serializers.CharField(source="bag.bag_id", read_only=True)
    bag_blood_group = serializers.CharField(source="bag.get_blood_group_display", read_only=True)
    bag_component = serializers.CharField(source="bag.get_component_display", read_only=True)
    result_label = serializers.CharField(source="get_result_display", read_only=True)

    class Meta:
        model = CrossMatch
        fields = [
            "id", "requisition", "bag", "bag_id_str",
            "bag_blood_group", "bag_component",
            "result", "result_label",
            "notes", "performed_by", "performed_at", "created_at",
        ]
        read_only_fields = ["id", "performed_at", "created_at"]


class BloodIssueSerializer(serializers.ModelSerializer):
    bag_id_str = serializers.CharField(source="bag.bag_id", read_only=True)
    bag_component = serializers.CharField(source="bag.get_component_display", read_only=True)
    bag_blood_group = serializers.CharField(source="bag.get_blood_group_display", read_only=True)
    invoice_code = serializers.CharField(source="invoice.code", read_only=True)

    class Meta:
        model = BloodIssue
        fields = [
            "id", "requisition", "bag", "bag_id_str",
            "bag_component", "bag_blood_group",
            "issued_to_dept", "issued_at", "issued_by",
            "received_by_name",
            "invoice", "invoice_code",
            "transfusion_started_at", "transfusion_completed_at",
            "reactions_observed", "bag_returned",
            "notes", "created_at",
        ]
        read_only_fields = ["id", "issued_at", "created_at"]


class BloodRequisitionSerializer(serializers.ModelSerializer):
    patient_name = serializers.SerializerMethodField()
    patient_mrn = serializers.CharField(source="patient.mrn", read_only=True)
    requested_by_name = serializers.SerializerMethodField()
    blood_group_label = serializers.CharField(source="get_blood_group_display", read_only=True)
    component_label = serializers.CharField(source="get_component_display", read_only=True)
    urgency_label = serializers.CharField(source="get_urgency_display", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    admission_code = serializers.CharField(source="admission.code", read_only=True)

    crossmatches = CrossMatchSerializer(many=True, read_only=True)
    issues = BloodIssueSerializer(many=True, read_only=True)
    units_issued = serializers.SerializerMethodField()

    class Meta:
        model = BloodRequisition
        fields = [
            "id", "code", "hospital",
            "patient", "patient_name", "patient_mrn",
            "requested_by", "requested_by_name",
            "department",
            "admission", "admission_code",
            "blood_group", "blood_group_label",
            "component", "component_label",
            "units_required", "units_issued",
            "urgency", "urgency_label",
            "purpose",
            "status", "status_label",
            "rejection_reason", "cancelled_reason",
            "requested_at", "issued_at",
            "crossmatches", "issues",
            "notes",
            "created_at", "updated_at",
        ]
        read_only_fields = [
            "id", "code", "requested_at", "issued_at",
            "created_at", "updated_at",
        ]

    def get_patient_name(self, obj):
        p = obj.patient
        if hasattr(p, "full_name"):
            return p.full_name
        return f"{getattr(p, 'first_name', '')} {getattr(p, 'last_name', '')}".strip()

    def get_requested_by_name(self, obj):
        d = obj.requested_by
        return f"Dr. {d.user.get_full_name() or d.user.username}"

    def get_units_issued(self, obj):
        return obj.issues.count()

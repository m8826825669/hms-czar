from django.contrib import admin
from .models import (
    BloodDonor, BloodDonation, BloodBag,
    BloodRequisition, CrossMatch, BloodIssue,
)


@admin.register(BloodDonor)
class BloodDonorAdmin(admin.ModelAdmin):
    list_display = [
        "donor_id", "first_name", "last_name", "blood_group",
        "phone", "is_eligible", "total_donations", "last_donation_date",
    ]
    list_filter = ["blood_group", "is_eligible", "donor_type", "gender"]
    search_fields = ["donor_id", "first_name", "last_name", "phone"]
    readonly_fields = ["donor_id", "total_donations", "last_donation_date",
                        "created_at", "updated_at"]


@admin.register(BloodDonation)
class BloodDonationAdmin(admin.ModelAdmin):
    list_display = [
        "donation_id", "donor", "blood_group", "donation_date",
        "volume_collected_ml", "status",
    ]
    list_filter = ["status", "blood_group"]
    search_fields = ["donation_id", "donor__donor_id"]
    autocomplete_fields = ["donor"]
    readonly_fields = [
        "donation_id", "donation_date",
        "screening_completed_at", "created_at", "updated_at",
    ]


@admin.register(BloodBag)
class BloodBagAdmin(admin.ModelAdmin):
    list_display = [
        "bag_id", "blood_group", "component", "volume_ml",
        "status", "expiry_date", "storage_location",
    ]
    list_filter = ["status", "blood_group", "component"]
    search_fields = ["bag_id", "donation__donation_id"]
    autocomplete_fields = ["donation"]
    readonly_fields = ["bag_id", "created_at", "updated_at",
                        "discarded_at", "discarded_by"]


class CrossMatchInline(admin.TabularInline):
    model = CrossMatch
    extra = 0
    autocomplete_fields = ["bag"]
    readonly_fields = ["performed_at", "created_at"]


class BloodIssueInline(admin.TabularInline):
    model = BloodIssue
    extra = 0
    autocomplete_fields = ["bag", "invoice"]
    readonly_fields = ["issued_at", "created_at"]


@admin.register(BloodRequisition)
class BloodRequisitionAdmin(admin.ModelAdmin):
    list_display = [
        "code", "patient", "blood_group", "component",
        "units_required", "urgency", "status", "requested_at",
    ]
    list_filter = ["status", "urgency", "blood_group", "component"]
    search_fields = ["code", "patient__mrn"]
    autocomplete_fields = ["patient", "requested_by", "department", "admission"]
    readonly_fields = ["code", "requested_at", "issued_at", "created_at", "updated_at"]
    inlines = [CrossMatchInline, BloodIssueInline]


@admin.register(BloodIssue)
class BloodIssueAdmin(admin.ModelAdmin):
    list_display = ["bag", "requisition", "issued_to_dept",
                     "issued_at", "bag_returned"]
    autocomplete_fields = ["requisition", "bag", "invoice"]
    readonly_fields = ["issued_at", "created_at"]

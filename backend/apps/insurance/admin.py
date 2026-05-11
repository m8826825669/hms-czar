from django.contrib import admin
from .models import (
    InsuranceCompany, TPA, PolicyCoverage,
    PreAuth, Claim, ClaimLine, ClaimDocument,
)


@admin.register(InsuranceCompany)
class InsuranceCompanyAdmin(admin.ModelAdmin):
    list_display = ["code", "name", "is_empanelled", "is_cashless", "is_active"]
    list_filter = ["is_empanelled", "is_cashless", "is_active"]
    search_fields = ["code", "name"]


@admin.register(TPA)
class TPAAdmin(admin.ModelAdmin):
    list_display = ["code", "name", "phone", "is_active"]
    search_fields = ["code", "name"]
    filter_horizontal = ["insurance_companies"]


@admin.register(PolicyCoverage)
class PolicyCoverageAdmin(admin.ModelAdmin):
    list_display = ["policy_number", "patient", "insurance_company",
                     "cover_type", "sum_insured", "is_active"]
    list_filter = ["cover_type", "is_active", "insurance_company"]
    search_fields = ["policy_number", "member_id", "policy_holder_name"]
    autocomplete_fields = ["patient", "insurance_company", "tpa"]


@admin.register(PreAuth)
class PreAuthAdmin(admin.ModelAdmin):
    list_display = ["code", "patient", "policy", "status",
                     "requested_amount", "approved_amount", "request_date"]
    list_filter = ["status", "urgency"]
    search_fields = ["code", "tpa_reference"]
    autocomplete_fields = ["patient", "policy", "admission"]
    readonly_fields = ["code"]


class ClaimLineInline(admin.TabularInline):
    model = ClaimLine
    extra = 0


class ClaimDocumentInline(admin.TabularInline):
    model = ClaimDocument
    extra = 0


@admin.register(Claim)
class ClaimAdmin(admin.ModelAdmin):
    list_display = ["code", "patient", "claim_type", "status",
                     "bill_amount", "claim_amount", "approved_amount",
                     "settled_amount", "submission_date"]
    list_filter = ["status", "claim_type"]
    search_fields = ["code", "tpa_claim_number"]
    autocomplete_fields = ["patient", "policy", "pre_auth", "invoice", "admission"]
    readonly_fields = ["code"]
    inlines = [ClaimLineInline, ClaimDocumentInline]

from django.contrib import admin

from .models import SafeguardingConcern, ConcernNote, ConcernReferral


@admin.register(SafeguardingConcern)
class SafeguardingConcernAdmin(admin.ModelAdmin):
    list_display = ("reference_number", "category", "risk_level", "status",
                     "raised_at", "reporter", "investigator", "hospital")
    list_filter = ("category", "risk_level", "status", "hospital")
    search_fields = ("reference_number", "observations", "subject_description",
                      "patient__mrn", "patient__first_name", "patient__last_name")
    raw_id_fields = ("patient", "reporter", "investigator", "created_by")
    filter_horizontal = ("additional_viewers",)
    date_hierarchy = "raised_at"
    readonly_fields = ("raised_at", "closed_at", "created_at", "updated_at")
    ordering = ("-raised_at",)


@admin.register(ConcernNote)
class ConcernNoteAdmin(admin.ModelAdmin):
    list_display = ("created_at", "concern", "note_type", "author", "hospital")
    list_filter = ("note_type", "hospital")
    search_fields = ("body", "concern__reference_number", "author__username")
    raw_id_fields = ("concern", "author", "addendum_to", "created_by")
    readonly_fields = ("created_at", "updated_at")
    ordering = ("-created_at",)

    def has_change_permission(self, request, obj=None):
        # Notes are append-only; admin can't edit either (audit integrity)
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(ConcernReferral)
class ConcernReferralAdmin(admin.ModelAdmin):
    list_display = ("referred_at", "concern", "agency_type", "agency_name",
                     "outcome", "referred_by", "hospital")
    list_filter = ("agency_type", "outcome", "hospital")
    search_fields = ("agency_name", "contact_person", "reference_id_from_agency",
                      "concern__reference_number")
    raw_id_fields = ("concern", "referred_by", "created_by")
    readonly_fields = ("referred_at", "outcome_updated_at",
                        "created_at", "updated_at")
    ordering = ("-referred_at",)

    def has_delete_permission(self, request, obj=None):
        return False

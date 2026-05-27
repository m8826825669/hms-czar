from django.contrib import admin

from .models import EmergencyCode, CodeActivation, Drill


@admin.register(EmergencyCode)
class EmergencyCodeAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "color", "is_active",
                     "requires_evacuation", "default_response_minutes", "hospital")
    list_filter = ("is_active", "requires_evacuation", "hospital")
    search_fields = ("code", "name", "description")
    ordering = ("code",)


@admin.register(CodeActivation)
class CodeActivationAdmin(admin.ModelAdmin):
    list_display = ("called_at", "code", "location", "called_by",
                     "responded_at", "resolved_at", "outcome", "hospital")
    list_filter = ("code", "outcome", "hospital")
    search_fields = ("location", "notes", "outcome_notes")
    raw_id_fields = ("code", "called_by", "patient", "department", "created_by")
    filter_horizontal = ("responders",)
    date_hierarchy = "called_at"
    readonly_fields = ("created_at", "updated_at")
    ordering = ("-called_at",)


@admin.register(Drill)
class DrillAdmin(admin.ModelAdmin):
    list_display = ("scheduled_at", "code", "location", "status",
                     "rating", "organizer", "hospital")
    list_filter = ("status", "code", "rating", "hospital")
    search_fields = ("location", "notes")
    raw_id_fields = ("code", "organizer", "created_by")
    filter_horizontal = ("participants", "observers")
    date_hierarchy = "scheduled_at"
    readonly_fields = ("created_at", "updated_at", "started_at", "completed_at")
    ordering = ("-scheduled_at",)

from django.contrib import admin
from .models import Ambulance, AmbulanceDriver, Dispatch, DispatchLog


@admin.register(Ambulance)
class AmbulanceAdmin(admin.ModelAdmin):
    list_display = ["code", "registration_number", "ambulance_type",
                     "status", "is_active"]
    list_filter = ["ambulance_type", "status", "is_active"]
    search_fields = ["code", "registration_number"]


@admin.register(AmbulanceDriver)
class AmbulanceDriverAdmin(admin.ModelAdmin):
    list_display = ["employee_code", "full_name", "role", "shift",
                     "is_on_duty", "is_active"]
    list_filter = ["role", "shift", "is_on_duty", "is_active"]
    search_fields = ["employee_code", "full_name", "phone"]


class DispatchLogInline(admin.TabularInline):
    model = DispatchLog
    extra = 0
    readonly_fields = ["timestamp", "event_type", "from_status",
                        "to_status", "lat", "lng", "note", "user"]
    can_delete = False


@admin.register(Dispatch)
class DispatchAdmin(admin.ModelAdmin):
    list_display = ["code", "call_type", "priority", "status",
                     "ambulance", "requested_at"]
    list_filter = ["status", "priority", "call_type"]
    search_fields = ["code", "patient__mrn", "caller_name"]
    raw_id_fields = ["patient", "ambulance", "driver", "paramedic", "invoice"]
    readonly_fields = [
        "code", "requested_at", "assigned_at", "en_route_at", "on_scene_at",
        "patient_picked_at", "at_hospital_at", "completed_at",
        "invoice", "created_at", "updated_at",
    ]
    inlines = [DispatchLogInline]

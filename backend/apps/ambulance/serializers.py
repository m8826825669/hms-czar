from rest_framework import serializers
from .models import Ambulance, AmbulanceDriver, Dispatch, DispatchLog


class AmbulanceSerializer(serializers.ModelSerializer):
    type_label = serializers.CharField(source="get_ambulance_type_display", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = Ambulance
        fields = [
            "id", "hospital", "code", "registration_number",
            "ambulance_type", "type_label", "make_model", "year",
            "status", "status_label",
            "equipment_list", "base_location",
            "last_lat", "last_lng", "last_location_update",
            "base_price", "per_km_rate",
            "insurance_expiry", "fitness_expiry", "puc_expiry",
            "is_active", "notes",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at",
                              "last_location_update"]


class AmbulanceDriverSerializer(serializers.ModelSerializer):
    role_label = serializers.CharField(source="get_role_display", read_only=True)
    shift_label = serializers.CharField(source="get_shift_display", read_only=True)

    class Meta:
        model = AmbulanceDriver
        fields = [
            "id", "hospital", "employee_code", "full_name", "phone",
            "role", "role_label", "license_number", "license_expiry",
            "shift", "shift_label", "is_on_duty", "is_active",
            "notes", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class DispatchLogSerializer(serializers.ModelSerializer):
    event_type_label = serializers.CharField(source="get_event_type_display", read_only=True)
    class Meta:
        model = DispatchLog
        fields = [
            "id", "dispatch", "event_type", "event_type_label",
            "from_status", "to_status",
            "lat", "lng", "note", "user", "timestamp",
        ]


class DispatchSerializer(serializers.ModelSerializer):
    call_type_label = serializers.CharField(source="get_call_type_display", read_only=True)
    priority_label = serializers.CharField(source="get_priority_display", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    ambulance_code = serializers.CharField(source="ambulance.code", read_only=True)
    ambulance_reg = serializers.CharField(source="ambulance.registration_number", read_only=True)
    driver_name = serializers.CharField(source="driver.full_name", read_only=True)
    paramedic_name = serializers.CharField(source="paramedic.full_name", read_only=True)
    patient_name = serializers.SerializerMethodField()
    invoice_code = serializers.CharField(source="invoice.code", read_only=True)
    response_time_seconds = serializers.IntegerField(read_only=True)
    logs = DispatchLogSerializer(many=True, read_only=True)

    class Meta:
        model = Dispatch
        fields = [
            "id", "code", "hospital",
            "call_type", "call_type_label",
            "priority", "priority_label",
            "patient", "patient_name",
            "patient_name_temp", "patient_phone_temp",
            "caller_name", "caller_phone", "caller_relation",
            "pickup_address", "pickup_lat", "pickup_lng", "pickup_landmark",
            "drop_address",
            "chief_complaint", "age_estimate", "is_conscious", "is_breathing",
            "ambulance", "ambulance_code", "ambulance_reg",
            "driver", "driver_name",
            "paramedic", "paramedic_name",
            "requested_at", "assigned_at", "en_route_at", "on_scene_at",
            "patient_picked_at", "at_hospital_at", "completed_at",
            "status", "status_label",
            "distance_km", "invoice", "invoice_code",
            "cancellation_reason", "notes",
            "response_time_seconds", "logs",
            "created_at", "updated_at",
        ]
        read_only_fields = [
            "id", "code", "requested_at", "assigned_at", "en_route_at",
            "on_scene_at", "patient_picked_at", "at_hospital_at",
            "completed_at", "invoice", "created_at", "updated_at",
        ]

    def get_patient_name(self, obj):
        if obj.patient:
            p = obj.patient
            if hasattr(p, "full_name"):
                return p.full_name
            return f"{getattr(p, 'first_name', '')} {getattr(p, 'last_name', '')}".strip()
        return obj.patient_name_temp or "Unknown"

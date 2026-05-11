from rest_framework import serializers
from .models import (
    CylinderType, Cylinder, CylinderUsage,
    RefillRecord, CylinderInspection,
)


class CylinderTypeSerializer(serializers.ModelSerializer):
    gas_type_label = serializers.CharField(source="get_gas_type_display", read_only=True)
    size_label = serializers.CharField(source="get_size_display", read_only=True)

    class Meta:
        model = CylinderType
        fields = "__all__"


class CylinderUsageSerializer(serializers.ModelSerializer):
    event_type_label = serializers.CharField(source="get_event_type_display", read_only=True)
    department_name = serializers.CharField(source="department.name", read_only=True)

    class Meta:
        model = CylinderUsage
        fields = [
            "id", "cylinder", "event_type", "event_type_label",
            "department", "department_name",
            "location", "fill_at_event",
            "handled_by", "received_by",
            "notes", "timestamp",
        ]


class CylinderInspectionSerializer(serializers.ModelSerializer):
    inspection_type_label = serializers.CharField(
        source="get_inspection_type_display", read_only=True,
    )
    outcome_label = serializers.CharField(source="get_outcome_display", read_only=True)

    class Meta:
        model = CylinderInspection
        fields = "__all__"


class CylinderSerializer(serializers.ModelSerializer):
    type_code = serializers.CharField(source="cylinder_type.code", read_only=True)
    type_gas = serializers.CharField(source="cylinder_type.get_gas_type_display",
                                       read_only=True)
    type_size = serializers.CharField(source="cylinder_type.get_size_display",
                                        read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    is_hydro_test_due = serializers.BooleanField(read_only=True)
    current_department_name = serializers.CharField(
        source="current_department.name", read_only=True,
    )
    usage_log = CylinderUsageSerializer(many=True, read_only=True)
    inspections = CylinderInspectionSerializer(many=True, read_only=True)

    class Meta:
        model = Cylinder
        fields = [
            "id", "hospital", "cylinder_type",
            "type_code", "type_gas", "type_size",
            "serial_number", "barcode",
            "status", "status_label",
            "fill_percentage",
            "current_location", "current_department", "current_department_name",
            "manufacture_date", "manufacturer",
            "last_hydro_test", "next_hydro_test_due", "is_hydro_test_due",
            "last_refilled_at", "refill_count",
            "is_active", "notes",
            "usage_log", "inspections",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class RefillRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = RefillRecord
        fields = "__all__"
        read_only_fields = ["id", "code"]

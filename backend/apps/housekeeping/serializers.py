from rest_framework import serializers
from .models import (
    HKZone, HKStaff, HKTaskTemplate, HKTaskAssignment, DeepCleaningSchedule,
)


class HKZoneSerializer(serializers.ModelSerializer):
    zone_type_label = serializers.CharField(source="get_zone_type_display", read_only=True)
    criticality_label = serializers.CharField(source="get_criticality_display", read_only=True)
    department_name = serializers.CharField(source="department.name", read_only=True)
    class Meta:
        model = HKZone
        fields = "__all__"


class HKStaffSerializer(serializers.ModelSerializer):
    role_label = serializers.CharField(source="get_role_display", read_only=True)
    shift_label = serializers.CharField(source="get_shift_display", read_only=True)
    class Meta:
        model = HKStaff
        fields = "__all__"


class HKTaskTemplateSerializer(serializers.ModelSerializer):
    zone_name = serializers.CharField(source="zone.name", read_only=True)
    task_type_label = serializers.CharField(source="get_task_type_display", read_only=True)
    frequency_label = serializers.CharField(source="get_frequency_display", read_only=True)
    class Meta:
        model = HKTaskTemplate
        fields = "__all__"


class HKTaskAssignmentSerializer(serializers.ModelSerializer):
    template_name = serializers.CharField(source="template.name", read_only=True)
    template_task_type = serializers.CharField(source="template.get_task_type_display",
                                                  read_only=True)
    zone_name = serializers.CharField(source="zone.name", read_only=True)
    assigned_to_name = serializers.CharField(source="assigned_to.full_name", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    class Meta:
        model = HKTaskAssignment
        fields = "__all__"


class DeepCleaningScheduleSerializer(serializers.ModelSerializer):
    zone_name = serializers.CharField(source="zone.name", read_only=True)
    event_type_label = serializers.CharField(source="get_event_type_display", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    class Meta:
        model = DeepCleaningSchedule
        fields = "__all__"

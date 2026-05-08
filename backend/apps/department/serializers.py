from rest_framework import serializers
from .models import Department


class DepartmentSerializer(serializers.ModelSerializer):
    head_doctor_name = serializers.CharField(source="head_doctor.full_name",
                                             read_only=True, default="")
    type_label = serializers.CharField(source="get_type_display", read_only=True)

    class Meta:
        model = Department
        fields = "__all__"
        read_only_fields = ("hospital", "created_at", "updated_at")

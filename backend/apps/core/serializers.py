from rest_framework import serializers
from .models import Hospital, Department, Location, Patient


class HospitalSerializer(serializers.ModelSerializer):
    class Meta:
        model = Hospital
        fields = "__all__"
        read_only_fields = ("created_at", "updated_at")


class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = "__all__"
        read_only_fields = ("created_at", "updated_at", "hospital")


class LocationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Location
        fields = "__all__"
        read_only_fields = ("created_at", "updated_at", "hospital")


class PatientSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)
    age = serializers.IntegerField(read_only=True)

    class Meta:
        model = Patient
        fields = "__all__"
        read_only_fields = ("uuid", "mrn", "hospital", "created_at", "updated_at")

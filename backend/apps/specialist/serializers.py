from rest_framework import serializers
from apps.accounts.models import User
from .models import (Doctor, Specialty, Qualification, OPDSlot,
                     OPDSlotException, ConsultationFee, OnCallRoster)


class SpecialtySerializer(serializers.ModelSerializer):
    class Meta:
        model = Specialty
        fields = "__all__"
        read_only_fields = ("hospital", "created_at", "updated_at")


class QualificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Qualification
        fields = "__all__"
        read_only_fields = ("hospital", "created_at", "updated_at")


class ConsultationFeeSerializer(serializers.ModelSerializer):
    class Meta:
        model = ConsultationFee
        fields = "__all__"
        read_only_fields = ("hospital", "created_at", "updated_at")


class OPDSlotSerializer(serializers.ModelSerializer):
    day_of_week_label = serializers.CharField(source="get_day_of_week_display", read_only=True)
    location_name = serializers.CharField(source="location.name", read_only=True)

    class Meta:
        model = OPDSlot
        fields = "__all__"
        read_only_fields = ("hospital", "created_at", "updated_at")


class OPDSlotExceptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = OPDSlotException
        fields = "__all__"
        read_only_fields = ("hospital", "created_at", "updated_at")


class DoctorSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)
    user_id = serializers.IntegerField(source="user.id", read_only=True)
    username = serializers.CharField(source="user.username", read_only=True)
    email = serializers.EmailField(source="user.email", read_only=True)
    phone = serializers.CharField(source="user.phone", read_only=True)
    specialty_names = serializers.SerializerMethodField()
    qualification_codes = serializers.SerializerMethodField()
    department_name = serializers.CharField(source="primary_department.name", read_only=True)

    class Meta:
        model = Doctor
        fields = (
            "id", "user_id", "username", "email", "phone",
            "registration_number", "full_name",
            "specialties", "specialty_names",
            "qualifications", "qualification_codes",
            "primary_department", "department_name",
            "bio", "years_of_experience", "languages",
            "signature", "is_consulting", "on_call", "is_active",
            "created_at",
        )
        read_only_fields = ("created_at",)

    def get_specialty_names(self, obj):
        return [s.name for s in obj.specialties.all()]

    def get_qualification_codes(self, obj):
        return [q.code for q in obj.qualifications.all()]


class CreateDoctorSerializer(serializers.Serializer):
    """Creates a User + Doctor profile in one step."""
    username = serializers.CharField()
    password = serializers.CharField(write_only=True, required=False)
    first_name = serializers.CharField()
    last_name = serializers.CharField(required=False, allow_blank=True)
    email = serializers.EmailField(required=False, allow_blank=True)
    phone = serializers.CharField(required=False, allow_blank=True)
    employee_code = serializers.CharField(required=False, allow_blank=True)

    registration_number = serializers.CharField()
    specialty_ids = serializers.ListField(child=serializers.IntegerField(), required=False)
    qualification_ids = serializers.ListField(child=serializers.IntegerField(), required=False)
    primary_department_id = serializers.IntegerField(required=False, allow_null=True)
    bio = serializers.CharField(required=False, allow_blank=True)
    years_of_experience = serializers.IntegerField(required=False, default=0)
    languages = serializers.ListField(child=serializers.CharField(), required=False)

    def create(self, validated_data):
        from apps.accounts.models import Role, UserRole
        request = self.context.get("request")
        hospital = getattr(request, "hospital", None)

        password = validated_data.pop("password", None) or "ChangeMe@123"
        username = validated_data.pop("username")

        user = User(
            username=username,
            first_name=validated_data.pop("first_name"),
            last_name=validated_data.pop("last_name", ""),
            email=validated_data.pop("email", ""),
            phone=validated_data.pop("phone", ""),
            employee_code=validated_data.pop("employee_code", ""),
            designation="Doctor",
            hospital=hospital,
            must_change_password=True,
        )
        user.set_password(password)
        user.save()

        # Auto-assign DOCTOR role
        from django.db.models import Q
        role = Role.objects.filter(code="DOCTOR").filter(
            Q(hospital=hospital) | Q(hospital__isnull=True)
        ).first()
        if role:
            UserRole.objects.create(user=user, role=role)

        specialty_ids = validated_data.pop("specialty_ids", [])
        qualification_ids = validated_data.pop("qualification_ids", [])
        primary_department_id = validated_data.pop("primary_department_id", None)

        doctor = Doctor.objects.create(
            hospital=hospital, user=user,
            primary_department_id=primary_department_id,
            created_by=request.user,
            **validated_data,
        )
        if specialty_ids:
            doctor.specialties.set(Specialty.objects.filter(id__in=specialty_ids))
        if qualification_ids:
            doctor.qualifications.set(Qualification.objects.filter(id__in=qualification_ids))
        return doctor

    def to_representation(self, instance):
        return DoctorSerializer(instance).data


class OnCallRosterSerializer(serializers.ModelSerializer):
    doctor_name = serializers.CharField(source="doctor.full_name", read_only=True)
    department_name = serializers.CharField(source="department.name", read_only=True)

    class Meta:
        model = OnCallRoster
        fields = "__all__"
        read_only_fields = ("hospital", "created_at", "updated_at")

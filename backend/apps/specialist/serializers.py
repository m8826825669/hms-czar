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

    # Frontend-friendly derived fields. The Specialist page (lib/api/specialist.ts
    # Doctor interface) expects flat shapes that don't match the relational
    # model 1:1. Rather than make the frontend traverse FKs, we expose them
    # in the shape it expects:
    specialty = serializers.SerializerMethodField()           # singular display string
    specialty_id = serializers.SerializerMethodField()        # id of the first specialty
    qualification = serializers.SerializerMethodField()       # comma-joined string
    department = serializers.SerializerMethodField()          # primary dept name as plain string
    status = serializers.SerializerMethodField()              # active | inactive | on_leave
    opd_fee = serializers.SerializerMethodField()             # latest NEW fee
    emergency_fee = serializers.SerializerMethodField()       # latest EMERGENCY fee
    availability = serializers.SerializerMethodField()        # list of {day, start_time, end_time, max_patients}
    joined_date = serializers.DateTimeField(source="created_at", read_only=True)
    patients_today = serializers.SerializerMethodField()
    total_patients = serializers.SerializerMethodField()

    class Meta:
        model = Doctor
        fields = (
            "id", "user_id", "username", "email", "phone",
            "registration_number", "full_name",
            # Relational (raw)
            "specialties", "specialty_names",
            "qualifications", "qualification_codes",
            "primary_department", "department_name",
            "bio", "years_of_experience", "languages",
            "signature", "is_consulting", "on_call", "is_active",
            "created_at",
            # Frontend-friendly flat shapes
            "specialty", "specialty_id", "qualification", "department", "status",
            "opd_fee", "emergency_fee", "availability",
            "joined_date", "patients_today", "total_patients",
        )
        read_only_fields = ("created_at",)

    def get_specialty_names(self, obj):
        return [s.name for s in obj.specialties.all()]

    def get_qualification_codes(self, obj):
        return [q.code for q in obj.qualifications.all()]

    # ─── Derived (flat) fields for the Specialist page ────────────────────────

    def get_specialty(self, obj):
        """First specialty name as a singular string. Specialist page renders
        this; multi-specialty doctors get their additional specialties via
        specialty_names."""
        names = [s.name for s in obj.specialties.all()]
        return names[0] if names else ""

    def get_specialty_id(self, obj):
        """First specialty's id. Pairs with specialty (the name string) so
        the frontend can use the id for edit forms while showing the name."""
        first = obj.specialties.first()
        return first.id if first else None

    def get_qualification(self, obj):
        """Comma-joined qualification codes — 'MBBS, MD' style."""
        return ", ".join(q.code for q in obj.qualifications.all())

    def get_department(self, obj):
        """primary_department.name as plain string (vs department_name above
        which is the same; kept for backward compat with both clients)."""
        return obj.primary_department.name if obj.primary_department_id else ""

    def get_status(self, obj):
        """Derive UI status from the three flags:
            is_active=False               → inactive
            is_active=True, is_consulting=False  → on_leave
            is_active=True, is_consulting=True   → active
        """
        if not obj.is_active:
            return "inactive"
        if not obj.is_consulting:
            return "on_leave"
        return "active"

    def _latest_fee(self, obj, visit_type):
        """Latest active ConsultationFee for this visit_type, or 0."""
        from datetime import date
        from .models import ConsultationFee
        fee = (
            ConsultationFee.objects
            .filter(doctor=obj, visit_type=visit_type, is_active=True,
                    valid_from__lte=date.today())
            .order_by("-valid_from")
            .first()
        )
        return float(fee.amount) if fee else 0.0

    def get_opd_fee(self, obj):
        return self._latest_fee(obj, "NEW")

    def get_emergency_fee(self, obj):
        return self._latest_fee(obj, "EMERGENCY")

    def get_availability(self, obj):
        """OPD slots shaped as the frontend's DoctorSlot:
            { day: 'Mon', start_time: '09:00', end_time: '13:00', max_patients: 20 }
        """
        DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
        slots = []
        for s in obj.opd_slots.filter(is_active=True).order_by("day_of_week", "start_time"):
            slots.append({
                "day": DAY_NAMES[s.day_of_week] if 0 <= s.day_of_week <= 6 else "?",
                "start_time": s.start_time.strftime("%H:%M") if s.start_time else "",
                "end_time": s.end_time.strftime("%H:%M") if s.end_time else "",
                "max_patients": s.max_patients,
            })
        return slots

    def get_patients_today(self, obj):
        """Count of consultations this doctor has done today."""
        from django.utils import timezone
        try:
            from apps.opd.models import Consultation
            return Consultation.objects.filter(
                doctor=obj, consultation_date=timezone.localdate()
            ).count()
        except Exception:
            return 0

    def get_total_patients(self, obj):
        """All-time distinct patients this doctor has consulted."""
        try:
            from apps.opd.models import Consultation
            return Consultation.objects.filter(doctor=obj).values("patient_id").distinct().count()
        except Exception:
            return 0



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

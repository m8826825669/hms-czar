from rest_framework import serializers
from .models import (Ward, Room, Bed, Admission, DailyCharge,
                     AdmissionService, DischargeSummary)


class WardSerializer(serializers.ModelSerializer):
    ward_type_label = serializers.CharField(source="get_ward_type_display",
                                             read_only=True)
    room_count = serializers.SerializerMethodField()
    bed_count = serializers.SerializerMethodField()
    available_count = serializers.SerializerMethodField()
    occupied_count = serializers.SerializerMethodField()

    class Meta:
        model = Ward
        fields = "__all__"
        read_only_fields = ("hospital", "created_at", "updated_at")

    def get_room_count(self, obj):
        return obj.rooms.count()

    def get_bed_count(self, obj):
        return Bed.objects.filter(room__ward=obj).count()

    def get_available_count(self, obj):
        return Bed.objects.filter(room__ward=obj, status="AVAILABLE").count()

    def get_occupied_count(self, obj):
        return Bed.objects.filter(room__ward=obj, status="OCCUPIED").count()


class RoomSerializer(serializers.ModelSerializer):
    ward_code = serializers.CharField(source="ward.code", read_only=True)
    ward_name = serializers.CharField(source="ward.name", read_only=True)
    bed_count = serializers.IntegerField(source="beds.count", read_only=True)

    class Meta:
        model = Room
        fields = "__all__"
        read_only_fields = ("hospital", "created_at", "updated_at")


class BedSerializer(serializers.ModelSerializer):
    room_number = serializers.CharField(source="room.number", read_only=True)
    ward_code = serializers.CharField(source="room.ward.code", read_only=True)
    ward_name = serializers.CharField(source="room.ward.name", read_only=True)
    ward_type = serializers.CharField(source="room.ward.ward_type", read_only=True)
    display_code = serializers.CharField(read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    current_admission_code = serializers.SerializerMethodField()
    current_patient_name = serializers.SerializerMethodField()

    class Meta:
        model = Bed
        fields = "__all__"
        read_only_fields = ("hospital", "created_at", "updated_at")

    def get_current_admission_code(self, obj):
        adm = obj.admissions.filter(status="ADMITTED").first()
        return adm.code if adm else ""

    def get_current_patient_name(self, obj):
        adm = obj.admissions.filter(status="ADMITTED").select_related("patient").first()
        return adm.patient.full_name if adm and adm.patient else ""


class DailyChargeSerializer(serializers.ModelSerializer):
    class Meta:
        model = DailyCharge
        fields = "__all__"
        read_only_fields = ("hospital", "gst_amount", "total",
                            "created_at", "updated_at")


class AdmissionServiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = AdmissionService
        fields = "__all__"
        read_only_fields = ("hospital", "subtotal", "gst_amount", "total",
                            "created_at", "updated_at")


class DischargeSummarySerializer(serializers.ModelSerializer):
    prepared_by_name = serializers.SerializerMethodField()
    is_finalized = serializers.BooleanField(read_only=True)

    class Meta:
        model = DischargeSummary
        fields = "__all__"
        read_only_fields = ("hospital", "admission", "prepared_at",
                            "finalized_at", "created_at", "updated_at")

    def get_prepared_by_name(self, obj):
        if not obj.prepared_by or not obj.prepared_by.user:
            return ""
        return f"Dr. {obj.prepared_by.user.get_full_name()}".strip()


class AdmissionSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source="patient.full_name", read_only=True)
    patient_mrn = serializers.CharField(source="patient.mrn", read_only=True)
    patient_phone = serializers.CharField(source="patient.phone", read_only=True)
    patient_age = serializers.IntegerField(source="patient.age", read_only=True)
    patient_gender = serializers.CharField(source="patient.gender", read_only=True)

    bed_code = serializers.CharField(source="bed.display_code", read_only=True)
    ward_name = serializers.CharField(source="bed.room.ward.name", read_only=True)
    ward_type = serializers.CharField(source="bed.room.ward.ward_type", read_only=True)

    attending_doctor_name = serializers.SerializerMethodField()
    department_name = serializers.CharField(source="department.name",
                                             read_only=True, default="")

    invoice_code = serializers.CharField(source="invoice.code",
                                          read_only=True, default="")
    invoice_status = serializers.CharField(source="invoice.status",
                                            read_only=True, default="")
    invoice_total = serializers.DecimalField(source="invoice.total_amount",
                                              max_digits=12, decimal_places=2,
                                              read_only=True, default=0)

    status_label = serializers.CharField(source="get_status_display", read_only=True)
    admission_type_label = serializers.CharField(
        source="get_admission_type_display", read_only=True,
    )

    stay_days = serializers.IntegerField(read_only=True)
    daily_charges = DailyChargeSerializer(many=True, read_only=True)
    services = AdmissionServiceSerializer(many=True, read_only=True)
    discharge_summary = DischargeSummarySerializer(read_only=True)

    accrued_total = serializers.SerializerMethodField()

    class Meta:
        model = Admission
        fields = "__all__"
        read_only_fields = ("hospital", "code", "discharged_at", "discharge_type",
                            "locked_bed_rent", "locked_nursing_charge",
                            "locked_gst_rate", "invoice",
                            "created_at", "updated_at")

    def get_attending_doctor_name(self, obj):
        if not obj.attending_doctor or not obj.attending_doctor.user:
            return ""
        return f"Dr. {obj.attending_doctor.user.get_full_name()}".strip()

    def get_accrued_total(self, obj):
        from decimal import Decimal
        daily = sum((Decimal(c.total) for c in obj.daily_charges.all()),
                    Decimal("0"))
        services = sum((Decimal(s.total) for s in obj.services.all()),
                       Decimal("0"))
        return f"{daily + services:.2f}"

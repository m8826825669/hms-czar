from rest_framework import serializers
from .models import (TestCatalog, TestParameter, LabOrder, LabOrderItem,
                     LabSample, LabResult)


class TestParameterSerializer(serializers.ModelSerializer):
    class Meta:
        model = TestParameter
        fields = "__all__"
        read_only_fields = ("hospital", "created_at", "updated_at")


class TestCatalogSerializer(serializers.ModelSerializer):
    parameters = TestParameterSerializer(many=True, read_only=True)
    parameter_count = serializers.IntegerField(source="parameters.count", read_only=True)
    category_label = serializers.CharField(source="get_category_display", read_only=True)
    sample_type_label = serializers.CharField(source="get_sample_type_display", read_only=True)

    class Meta:
        model = TestCatalog
        fields = "__all__"
        read_only_fields = ("hospital", "created_at", "updated_at")


class LabResultSerializer(serializers.ModelSerializer):
    flag_label = serializers.CharField(source="get_flag_display", read_only=True)
    parameter_code = serializers.CharField(source="parameter.code", read_only=True)
    is_qualitative = serializers.BooleanField(source="parameter.is_qualitative", read_only=True)
    entered_by_name = serializers.CharField(
        source="entered_by.get_full_name", read_only=True, default="")

    class Meta:
        model = LabResult
        fields = "__all__"
        read_only_fields = ("hospital", "parameter_name", "parameter_unit",
                            "parameter_ref", "flag", "entered_at", "entered_by",
                            "verified_at", "verified_by", "sort_order",
                            "created_at", "updated_at")


class LabOrderItemSerializer(serializers.ModelSerializer):
    test_category = serializers.CharField(source="test.category", read_only=True)
    test_parameters = TestParameterSerializer(source="test.parameters",
                                              many=True, read_only=True)
    results = LabResultSerializer(many=True, read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    abnormal_count = serializers.SerializerMethodField()

    class Meta:
        model = LabOrderItem
        fields = "__all__"
        read_only_fields = ("hospital", "test_code", "test_name", "sample_type",
                            "gst_amount", "created_at", "updated_at")

    def get_abnormal_count(self, obj):
        return obj.results.exclude(flag="NORMAL").count()


class LabSampleSerializer(serializers.ModelSerializer):
    sample_type_label = serializers.CharField(source="get_sample_type_display",
                                              read_only=True)
    collected_by_name = serializers.CharField(
        source="collected_by.get_full_name", read_only=True, default="")

    class Meta:
        model = LabSample
        fields = "__all__"
        read_only_fields = ("hospital", "barcode", "created_at", "updated_at")


class LabOrderSerializer(serializers.ModelSerializer):
    items = LabOrderItemSerializer(many=True, read_only=True)
    samples = LabSampleSerializer(many=True, read_only=True)
    patient_name = serializers.CharField(source="patient.full_name", read_only=True)
    patient_mrn = serializers.CharField(source="patient.mrn", read_only=True)
    patient_phone = serializers.CharField(source="patient.phone", read_only=True)
    patient_age = serializers.IntegerField(source="patient.age", read_only=True)
    patient_gender = serializers.CharField(source="patient.gender", read_only=True)
    consultation_code = serializers.CharField(source="consultation.code",
                                              read_only=True, default="")
    ordered_by_name = serializers.SerializerMethodField()
    reported_by_name = serializers.SerializerMethodField()
    invoice_code = serializers.CharField(source="invoice.code", read_only=True, default="")
    invoice_status = serializers.CharField(source="invoice.status", read_only=True, default="")
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    priority_label = serializers.CharField(source="get_priority_display", read_only=True)
    abnormal_count = serializers.SerializerMethodField()
    test_count = serializers.IntegerField(source="items.count", read_only=True)

    class Meta:
        model = LabOrder
        fields = "__all__"
        read_only_fields = ("hospital", "code", "subtotal", "cgst_amount",
                            "sgst_amount", "igst_amount", "total_amount",
                            "invoice", "sample_collected_at",
                            "reported_at", "reported_by",
                            "created_at", "updated_at")

    def get_ordered_by_name(self, obj):
        if not obj.ordered_by:
            return ""
        full = obj.ordered_by.user.get_full_name() if obj.ordered_by.user else ""
        return f"Dr. {full}".strip() if full else "Dr."

    def get_reported_by_name(self, obj):
        if not obj.reported_by:
            return ""
        full = obj.reported_by.user.get_full_name() if obj.reported_by.user else ""
        return f"Dr. {full}".strip() if full else "Dr."

    def get_abnormal_count(self, obj):
        return LabResult.objects.filter(
            order_item__order=obj
        ).exclude(flag="NORMAL").count()

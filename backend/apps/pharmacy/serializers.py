from rest_framework import serializers
from .models import DrugBatch, StockMovement, PharmacyOrder, PharmacyOrderItem


class DrugBatchSerializer(serializers.ModelSerializer):
    drug_name = serializers.CharField(source="drug.display_name", read_only=True)
    drug_strength = serializers.CharField(source="drug.strength", read_only=True)
    drug_dosage_form = serializers.CharField(source="drug.dosage_form", read_only=True)
    is_expired = serializers.BooleanField(read_only=True)
    is_near_expiry = serializers.BooleanField(read_only=True)

    class Meta:
        model = DrugBatch
        fields = "__all__"
        read_only_fields = ("hospital", "created_at", "updated_at")


class StockMovementSerializer(serializers.ModelSerializer):
    drug_name = serializers.CharField(source="drug.display_name", read_only=True)
    batch_no = serializers.CharField(source="batch.batch_no", read_only=True, default="")
    movement_label = serializers.CharField(source="get_movement_type_display", read_only=True)

    class Meta:
        model = StockMovement
        fields = "__all__"
        read_only_fields = ("hospital", "created_at", "updated_at")


class PharmacyOrderItemSerializer(serializers.ModelSerializer):
    drug_strength = serializers.CharField(source="drug.strength", read_only=True)

    class Meta:
        model = PharmacyOrderItem
        fields = "__all__"
        read_only_fields = ("hospital", "subtotal", "gst_amount", "total",
                            "batch_no", "expiry_date",
                            "created_at", "updated_at")


class PharmacyOrderSerializer(serializers.ModelSerializer):
    items = PharmacyOrderItemSerializer(many=True, read_only=True)
    patient_name = serializers.CharField(source="patient.full_name", read_only=True)
    patient_mrn = serializers.CharField(source="patient.mrn", read_only=True)
    patient_phone = serializers.CharField(source="patient.phone", read_only=True)
    prescription_code = serializers.CharField(source="prescription.code",
                                              read_only=True, default="")
    invoice_code = serializers.CharField(source="invoice.code",
                                         read_only=True, default="")
    invoice_status = serializers.CharField(source="invoice.status",
                                           read_only=True, default="")
    status_label = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = PharmacyOrder
        fields = "__all__"
        read_only_fields = ("hospital", "code", "subtotal", "cgst_amount",
                            "sgst_amount", "igst_amount", "total_amount",
                            "invoice", "dispensed_at",
                            "created_at", "updated_at")

from rest_framework import serializers
from .models import ServiceCatalog, Invoice, InvoiceItem, Payment


class ServiceCatalogSerializer(serializers.ModelSerializer):
  
    class Meta:
        model = ServiceCatalog
        fields = "__all__"
        read_only_fields = ("hospital", "created_at", "updated_at")


class InvoiceItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = InvoiceItem
        fields = "__all__"
        read_only_fields = ("hospital", "subtotal", "gst_amount", "total",
                            "created_at", "updated_at")


class PaymentSerializer(serializers.ModelSerializer):
    method_label = serializers.CharField(source="get_method_display", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = Payment
        fields = "__all__"
        read_only_fields = ("hospital", "is_signature_verified",
                            "razorpay_signature", "created_at", "updated_at")


class InvoiceSerializer(serializers.ModelSerializer):
    items = InvoiceItemSerializer(many=True, read_only=True)
    payments = PaymentSerializer(many=True, read_only=True)
    patient_name = serializers.CharField(source="patient.full_name", read_only=True)
    patient_mrn = serializers.CharField(source="patient.mrn", read_only=True)
    patient_phone = serializers.CharField(source="patient.phone", read_only=True)
    consultation_code = serializers.CharField(source="consultation.code",
                                              read_only=True, default="")
    appointment_code = serializers.CharField(source="appointment.code",
                                             read_only=True, default="")
    status_label = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = Invoice
        fields = "__all__"
        read_only_fields = ("hospital", "code", "subtotal", "taxable_amount",
                            "cgst_amount", "sgst_amount", "igst_amount",
                            "total_amount", "amount_paid", "amount_due",
                            "razorpay_order_id", "printed_at",
                            "created_at", "updated_at")

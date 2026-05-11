from rest_framework import serializers
from .models import LinenItem, LinenStock, LaundryBatch, LaundryBatchItem, LinenLoss


class LinenItemSerializer(serializers.ModelSerializer):
    category_label = serializers.CharField(source="get_category_display", read_only=True)
    class Meta:
        model = LinenItem
        fields = "__all__"


class LinenStockSerializer(serializers.ModelSerializer):
    item_name = serializers.CharField(source="item.name", read_only=True)
    item_code = serializers.CharField(source="item.code", read_only=True)
    item_category = serializers.CharField(source="item.get_category_display", read_only=True)
    department_name = serializers.CharField(source="department.name", read_only=True)

    class Meta:
        model = LinenStock
        fields = [
            "id", "hospital", "item", "item_code", "item_name", "item_category",
            "department", "department_name", "ward_label",
            "total_units", "in_use", "in_laundry", "clean_in_stock",
            "minimum_threshold", "last_audit_date",
            "notes", "updated_at",
        ]


class LaundryBatchItemSerializer(serializers.ModelSerializer):
    item_name = serializers.CharField(source="item.name", read_only=True)
    item_code = serializers.CharField(source="item.code", read_only=True)
    discrepancy = serializers.IntegerField(read_only=True)

    class Meta:
        model = LaundryBatchItem
        fields = [
            "id", "batch", "item", "item_code", "item_name",
            "quantity_sent", "quantity_received",
            "quantity_lost", "quantity_damaged",
            "discrepancy",
            "cost_per_unit", "line_cost", "notes",
        ]
        read_only_fields = ["id", "line_cost", "discrepancy"]


class LaundryBatchSerializer(serializers.ModelSerializer):
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    batch_type_label = serializers.CharField(source="get_batch_type_display", read_only=True)
    department_name = serializers.CharField(source="source_department.name", read_only=True)
    items = LaundryBatchItemSerializer(many=True, read_only=True)

    class Meta:
        model = LaundryBatch
        fields = [
            "id", "hospital", "code", "batch_type", "batch_type_label",
            "source_department", "department_name", "source_ward_label",
            "vendor_name", "vendor_contact",
            "pickup_at", "expected_return_at", "returned_at",
            "status", "status_label",
            "total_cost", "items", "notes",
            "created_at", "updated_at",
        ]
        read_only_fields = [
            "id", "code", "pickup_at", "returned_at",
            "total_cost", "created_at", "updated_at",
        ]


class LinenLossSerializer(serializers.ModelSerializer):
    item_name = serializers.CharField(source="item.name", read_only=True)
    loss_type_label = serializers.CharField(source="get_loss_type_display", read_only=True)

    class Meta:
        model = LinenLoss
        fields = [
            "id", "hospital", "item", "item_name",
            "loss_type", "loss_type_label", "quantity",
            "department", "batch",
            "cost_impact", "reason", "reported_by", "reported_at",
        ]

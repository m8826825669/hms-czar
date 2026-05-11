from rest_framework import serializers
from .models import (
    StoreLocation, ItemCategory, Supplier, StockItem, StockBatch,
    PurchaseOrder, POLine, GRN, GRNLine,
    StockRequisition, RequisitionLine, StockIssue, IssueLine, StockTransfer,
)


class StoreLocationSerializer(serializers.ModelSerializer):
    store_type_label = serializers.CharField(source="get_store_type_display", read_only=True)
    department_name = serializers.CharField(source="department.name", read_only=True)
    class Meta:
        model = StoreLocation
        fields = "__all__"


class ItemCategorySerializer(serializers.ModelSerializer):
    parent_name = serializers.CharField(source="parent.name", read_only=True)
    class Meta:
        model = ItemCategory
        fields = "__all__"


class SupplierSerializer(serializers.ModelSerializer):
    class Meta:
        model = Supplier
        fields = "__all__"


class StockItemSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True)
    item_type_label = serializers.CharField(source="get_item_type_display", read_only=True)
    uom_label = serializers.CharField(source="get_uom_display", read_only=True)
    class Meta:
        model = StockItem
        fields = "__all__"


class StockBatchSerializer(serializers.ModelSerializer):
    item_name = serializers.CharField(source="item.name", read_only=True)
    item_code = serializers.CharField(source="item.code", read_only=True)
    item_uom = serializers.CharField(source="item.uom", read_only=True)
    store_name = serializers.CharField(source="store.name", read_only=True)
    supplier_name = serializers.CharField(source="supplier.name", read_only=True)
    class Meta:
        model = StockBatch
        fields = "__all__"


class POLineSerializer(serializers.ModelSerializer):
    item_name = serializers.CharField(source="item.name", read_only=True)
    item_code = serializers.CharField(source="item.code", read_only=True)
    class Meta:
        model = POLine
        fields = "__all__"


class PurchaseOrderSerializer(serializers.ModelSerializer):
    supplier_name = serializers.CharField(source="supplier.name", read_only=True)
    store_name = serializers.CharField(source="store.name", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    lines = POLineSerializer(many=True, read_only=True)
    class Meta:
        model = PurchaseOrder
        fields = "__all__"


class GRNLineSerializer(serializers.ModelSerializer):
    item_name = serializers.CharField(source="item.name", read_only=True)
    item_code = serializers.CharField(source="item.code", read_only=True)
    class Meta:
        model = GRNLine
        fields = "__all__"


class GRNSerializer(serializers.ModelSerializer):
    supplier_name = serializers.CharField(source="supplier.name", read_only=True)
    store_name = serializers.CharField(source="store.name", read_only=True)
    po_code = serializers.CharField(source="purchase_order.code", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    lines = GRNLineSerializer(many=True, read_only=True)
    class Meta:
        model = GRN
        fields = "__all__"


class RequisitionLineSerializer(serializers.ModelSerializer):
    item_name = serializers.CharField(source="item.name", read_only=True)
    item_code = serializers.CharField(source="item.code", read_only=True)
    item_uom = serializers.CharField(source="item.uom", read_only=True)
    class Meta:
        model = RequisitionLine
        fields = "__all__"


class StockRequisitionSerializer(serializers.ModelSerializer):
    requesting_dept_name = serializers.CharField(source="requesting_dept.name",
                                                    read_only=True)
    source_store_name = serializers.CharField(source="source_store.name",
                                                 read_only=True)
    urgency_label = serializers.CharField(source="get_urgency_display", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    lines = RequisitionLineSerializer(many=True, read_only=True)
    class Meta:
        model = StockRequisition
        fields = "__all__"


class IssueLineSerializer(serializers.ModelSerializer):
    batch_number = serializers.CharField(source="batch.batch_number", read_only=True)
    item_name = serializers.CharField(source="batch.item.name", read_only=True)
    item_code = serializers.CharField(source="batch.item.code", read_only=True)
    class Meta:
        model = IssueLine
        fields = "__all__"


class StockIssueSerializer(serializers.ModelSerializer):
    issuing_store_name = serializers.CharField(source="issuing_store.name", read_only=True)
    receiving_dept_name = serializers.CharField(source="receiving_dept.name", read_only=True)
    requisition_code = serializers.CharField(source="requisition.code", read_only=True)
    lines = IssueLineSerializer(many=True, read_only=True)
    class Meta:
        model = StockIssue
        fields = "__all__"


class StockTransferSerializer(serializers.ModelSerializer):
    from_store_name = serializers.CharField(source="from_store.name", read_only=True)
    to_store_name = serializers.CharField(source="to_store.name", read_only=True)
    item_name = serializers.CharField(source="item.name", read_only=True)
    item_code = serializers.CharField(source="item.code", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    class Meta:
        model = StockTransfer
        fields = "__all__"

from django.contrib import admin
from .models import (
    StoreLocation, ItemCategory, Supplier, StockItem, StockBatch,
    PurchaseOrder, POLine, GRN, GRNLine,
    StockRequisition, RequisitionLine, StockIssue, IssueLine, StockTransfer,
)


@admin.register(StoreLocation)
class StoreLocationAdmin(admin.ModelAdmin):
    list_display = ["code", "name", "store_type", "department", "is_active"]
    list_filter = ["store_type", "is_active"]
    search_fields = ["code", "name"]


@admin.register(ItemCategory)
class ItemCategoryAdmin(admin.ModelAdmin):
    list_display = ["code", "name", "parent", "is_active"]
    search_fields = ["code", "name"]


@admin.register(Supplier)
class SupplierAdmin(admin.ModelAdmin):
    list_display = ["code", "name", "gstin", "phone", "rating", "is_active"]
    list_filter = ["is_active", "is_blacklisted"]
    search_fields = ["code", "name", "gstin", "phone"]


@admin.register(StockItem)
class StockItemAdmin(admin.ModelAdmin):
    list_display = ["code", "name", "category", "item_type", "uom",
                     "reorder_level", "is_active"]
    list_filter = ["item_type", "is_active", "category"]
    search_fields = ["code", "name"]
    raw_id_fields = ["category"]


@admin.register(StockBatch)
class StockBatchAdmin(admin.ModelAdmin):
    list_display = ["batch_number", "item", "store", "current_quantity",
                     "expiry_date", "is_active"]
    list_filter = ["store", "is_active"]
    search_fields = ["batch_number", "item__code", "item__name"]
    raw_id_fields = ["item", "store", "supplier"]


class POLineInline(admin.TabularInline):
    model = POLine
    extra = 0
    raw_id_fields = ["item"]
    readonly_fields = ["subtotal", "gst_amount", "line_total"]


@admin.register(PurchaseOrder)
class PurchaseOrderAdmin(admin.ModelAdmin):
    list_display = ["code", "supplier", "store", "order_date",
                     "status", "total_amount"]
    list_filter = ["status", "store"]
    search_fields = ["code"]
    raw_id_fields = ["supplier", "store"]
    readonly_fields = ["code", "subtotal", "gst_amount", "total_amount",
                         "approved_at", "created_at", "updated_at"]
    inlines = [POLineInline]


class GRNLineInline(admin.TabularInline):
    model = GRNLine
    extra = 0
    raw_id_fields = ["item"]


@admin.register(GRN)
class GRNAdmin(admin.ModelAdmin):
    list_display = ["code", "supplier", "store", "receipt_date",
                     "status", "total_amount"]
    list_filter = ["status", "store"]
    search_fields = ["code", "supplier_invoice_number"]
    raw_id_fields = ["purchase_order", "supplier", "store"]
    inlines = [GRNLineInline]


class RequisitionLineInline(admin.TabularInline):
    model = RequisitionLine
    extra = 0
    raw_id_fields = ["item"]


@admin.register(StockRequisition)
class StockRequisitionAdmin(admin.ModelAdmin):
    list_display = ["code", "requesting_dept", "source_store", "urgency",
                     "status", "requested_date"]
    list_filter = ["status", "urgency"]
    search_fields = ["code"]
    raw_id_fields = ["requesting_dept", "source_store"]
    inlines = [RequisitionLineInline]


class IssueLineInline(admin.TabularInline):
    model = IssueLine
    extra = 0
    readonly_fields = ["line_total"]
    raw_id_fields = ["batch"]


@admin.register(StockIssue)
class StockIssueAdmin(admin.ModelAdmin):
    list_display = ["code", "issuing_store", "receiving_dept",
                     "issue_date", "total_value"]
    raw_id_fields = ["requisition", "issuing_store", "receiving_dept"]
    inlines = [IssueLineInline]


@admin.register(StockTransfer)
class StockTransferAdmin(admin.ModelAdmin):
    list_display = ["code", "from_store", "to_store", "item",
                     "quantity", "status", "transfer_date"]
    list_filter = ["status"]
    raw_id_fields = ["from_store", "to_store", "item"]

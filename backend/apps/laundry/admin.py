from django.contrib import admin
from .models import LinenItem, LinenStock, LaundryBatch, LaundryBatchItem, LinenLoss


@admin.register(LinenItem)
class LinenItemAdmin(admin.ModelAdmin):
    list_display = ["code", "name", "category", "cost_per_unit",
                     "expected_lifetime_washes", "is_active"]
    list_filter = ["category", "is_active"]
    search_fields = ["code", "name"]


@admin.register(LinenStock)
class LinenStockAdmin(admin.ModelAdmin):
    list_display = ["item", "department", "ward_label",
                     "total_units", "in_use", "in_laundry", "clean_in_stock"]
    list_filter = ["department", "item__category"]
    raw_id_fields = ["item", "department"]


class LaundryBatchItemInline(admin.TabularInline):
    model = LaundryBatchItem
    extra = 0
    readonly_fields = ["line_cost", "discrepancy"]


@admin.register(LaundryBatch)
class LaundryBatchAdmin(admin.ModelAdmin):
    list_display = ["code", "batch_type", "source_department",
                     "vendor_name", "status", "total_cost", "created_at"]
    list_filter = ["status", "batch_type"]
    search_fields = ["code", "vendor_name"]
    raw_id_fields = ["source_department"]
    readonly_fields = ["code", "pickup_at", "returned_at", "total_cost",
                        "created_at", "updated_at"]
    inlines = [LaundryBatchItemInline]


@admin.register(LinenLoss)
class LinenLossAdmin(admin.ModelAdmin):
    list_display = ["item", "loss_type", "quantity", "department",
                     "cost_impact", "reported_at"]
    list_filter = ["loss_type", "department"]
    raw_id_fields = ["item", "department", "batch"]

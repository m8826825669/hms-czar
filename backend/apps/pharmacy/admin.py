from django.contrib import admin
from .models import DrugBatch, StockMovement, PharmacyOrder, PharmacyOrderItem


@admin.register(DrugBatch)
class DrugBatchAdmin(admin.ModelAdmin):
    list_display = ("drug", "batch_no", "expiry_date", "qty_in_stock",
                    "qty_purchased", "mrp", "supplier_name")
    list_filter = ("expiry_date", "supplier_name")
    search_fields = ("drug__generic_name", "drug__brand_name", "batch_no")
    autocomplete_fields = ("drug",)
    date_hierarchy = "expiry_date"


@admin.register(StockMovement)
class StockMovementAdmin(admin.ModelAdmin):
    list_display = ("drug", "batch", "movement_type", "quantity", "moved_at")
    list_filter = ("movement_type", "moved_at")
    search_fields = ("drug__generic_name", "drug__brand_name", "batch__batch_no")
    readonly_fields = ("moved_at", "drug", "batch", "movement_type",
                       "quantity", "reference_type", "reference_id")
    date_hierarchy = "moved_at"


class PharmacyOrderItemInline(admin.TabularInline):
    model = PharmacyOrderItem
    extra = 0
    readonly_fields = ("subtotal", "gst_amount", "total", "batch_no", "expiry_date")


@admin.register(PharmacyOrder)
class PharmacyOrderAdmin(admin.ModelAdmin):
    list_display = ("code", "patient", "order_date", "total_amount",
                    "status", "invoice")
    list_filter = ("status", "order_date")
    search_fields = ("code", "patient__mrn", "patient__first_name",
                     "patient__last_name")
    autocomplete_fields = ("patient", "prescription", "consultation", "invoice")
    inlines = [PharmacyOrderItemInline]
    readonly_fields = ("subtotal", "cgst_amount", "sgst_amount", "igst_amount",
                       "total_amount", "dispensed_at")

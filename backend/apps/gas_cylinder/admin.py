from django.contrib import admin
from .models import (
    CylinderType, Cylinder, CylinderUsage,
    RefillRecord, CylinderInspection,
)


@admin.register(CylinderType)
class CylinderTypeAdmin(admin.ModelAdmin):
    list_display = ["code", "gas_type", "size", "capacity_litres",
                     "refill_cost", "is_active"]
    list_filter = ["gas_type", "size", "is_active"]
    search_fields = ["code"]


class CylinderUsageInline(admin.TabularInline):
    model = CylinderUsage
    extra = 0
    readonly_fields = ["timestamp"]


class CylinderInspectionInline(admin.TabularInline):
    model = CylinderInspection
    extra = 0
    readonly_fields = ["inspection_date"]


@admin.register(Cylinder)
class CylinderAdmin(admin.ModelAdmin):
    list_display = ["serial_number", "cylinder_type", "status",
                     "fill_percentage", "current_location",
                     "next_hydro_test_due", "is_active"]
    list_filter = ["status", "cylinder_type__gas_type", "is_active"]
    search_fields = ["serial_number", "barcode"]
    raw_id_fields = ["cylinder_type", "current_department"]
    inlines = [CylinderUsageInline, CylinderInspectionInline]


@admin.register(RefillRecord)
class RefillRecordAdmin(admin.ModelAdmin):
    list_display = ["code", "vendor_name", "sent_at",
                     "cylinders_sent", "cylinders_received", "is_completed"]
    list_filter = ["is_completed", "vendor_name"]
    search_fields = ["code", "vendor_name"]
    readonly_fields = ["code"]


@admin.register(CylinderInspection)
class CylinderInspectionAdmin(admin.ModelAdmin):
    list_display = ["cylinder", "inspection_type", "outcome",
                     "inspection_date", "next_due_date"]
    list_filter = ["inspection_type", "outcome"]
    raw_id_fields = ["cylinder"]

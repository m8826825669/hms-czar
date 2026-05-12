from django.contrib import admin
from .models import AssetCategory, Asset, AssetMaintenanceLog, AMC, AssetDisposal


@admin.register(AssetCategory)
class AssetCategoryAdmin(admin.ModelAdmin):
    list_display = ["code", "name", "category_type",
                     "default_depreciation_pct", "is_active"]
    list_filter = ["category_type", "is_active"]
    search_fields = ["code", "name"]


class AssetMaintenanceLogInline(admin.TabularInline):
    model = AssetMaintenanceLog
    extra = 0
    readonly_fields = ["created_at"]


class AMCInline(admin.TabularInline):
    model = AMC
    extra = 0


@admin.register(Asset)
class AssetAdmin(admin.ModelAdmin):
    list_display = ["asset_code", "name", "category", "department",
                     "status", "condition", "purchase_date", "purchase_cost"]
    list_filter = ["status", "condition", "category", "department"]
    search_fields = ["asset_code", "name", "serial_number"]
    raw_id_fields = ["category", "department", "custodian"]
    readonly_fields = ["asset_code", "created_at", "updated_at"]
    inlines = [AssetMaintenanceLogInline, AMCInline]


@admin.register(AssetMaintenanceLog)
class AssetMaintenanceLogAdmin(admin.ModelAdmin):
    list_display = ["asset", "maintenance_type", "scheduled_date",
                     "status", "cost", "vendor_name"]
    list_filter = ["maintenance_type", "status"]
    raw_id_fields = ["asset"]


@admin.register(AMC)
class AMCAdmin(admin.ModelAdmin):
    list_display = ["contract_number", "asset", "vendor_name",
                     "start_date", "end_date", "status"]
    list_filter = ["status"]
    search_fields = ["contract_number", "vendor_name"]
    raw_id_fields = ["asset"]


@admin.register(AssetDisposal)
class AssetDisposalAdmin(admin.ModelAdmin):
    list_display = ["asset", "disposal_type", "disposal_date", "sale_value"]
    list_filter = ["disposal_type"]
    raw_id_fields = ["asset"]

from django.contrib import admin
from .models import (TestCatalog, TestParameter, LabOrder, LabOrderItem,
                     LabSample, LabResult)


class TestParameterInline(admin.TabularInline):
    model = TestParameter
    extra = 0
    fields = ("code", "name", "unit", "ref_low", "ref_high", "ref_text",
              "critical_low", "critical_high", "is_qualitative", "sort_order")


@admin.register(TestCatalog)
class TestCatalogAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "category", "sample_type",
                    "price", "gst_rate", "is_active")
    list_filter = ("category", "sample_type", "is_active", "requires_fasting")
    search_fields = ("code", "name")
    inlines = [TestParameterInline]


@admin.register(TestParameter)
class TestParameterAdmin(admin.ModelAdmin):
    list_display = ("test", "code", "name", "unit",
                    "ref_low", "ref_high", "is_qualitative")
    list_filter = ("test__category", "is_qualitative")
    search_fields = ("code", "name", "test__code", "test__name")


class LabOrderItemInline(admin.TabularInline):
    model = LabOrderItem
    extra = 0
    fields = ("test", "test_name", "price", "gst_rate", "status", "order_index")
    readonly_fields = ("test_name",)


class LabSampleInline(admin.TabularInline):
    model = LabSample
    extra = 0
    fields = ("barcode", "sample_type", "container", "collected_at",
              "is_received", "is_rejected")
    readonly_fields = ("barcode", "collected_at")


@admin.register(LabOrder)
class LabOrderAdmin(admin.ModelAdmin):
    list_display = ("code", "patient", "ordered_by", "order_date",
                    "priority", "status", "total_amount")
    list_filter = ("status", "priority", "order_date")
    search_fields = ("code", "patient__mrn", "patient__first_name",
                     "patient__last_name")
    date_hierarchy = "order_date"
    raw_id_fields = ("patient", "consultation", "ordered_by",
                           "reported_by", "invoice")
    readonly_fields = ("code", "subtotal", "cgst_amount", "sgst_amount",
                       "igst_amount", "total_amount",
                       "sample_collected_at", "reported_at")
    inlines = [LabOrderItemInline, LabSampleInline]


@admin.register(LabResult)
class LabResultAdmin(admin.ModelAdmin):
    list_display = ("order_item", "parameter_name", "value",
                    "parameter_unit", "flag", "entered_at")
    list_filter = ("flag", "entered_at")
    search_fields = ("order_item__order__code", "parameter_name")
    readonly_fields = ("flag", "parameter_name", "parameter_unit",
                       "parameter_ref", "entered_at")


@admin.register(LabSample)
class LabSampleAdmin(admin.ModelAdmin):
    list_display = ("barcode", "order", "sample_type", "is_received",
                    "is_rejected", "collected_at")
    list_filter = ("sample_type", "is_received", "is_rejected")
    search_fields = ("barcode", "order__code")
    raw_id_fields = ("order",)

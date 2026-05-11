from django.contrib import admin

from .models import SavedReport, ReportRun, DashboardWidget


@admin.register(SavedReport)
class SavedReportAdmin(admin.ModelAdmin):
    list_display = ("name", "report_type", "is_pinned", "created_by", "created_at")
    list_filter = ("report_type", "is_pinned")
    search_fields = ("name", "description")
    autocomplete_fields = ("hospital",)


@admin.register(ReportRun)
class ReportRunAdmin(admin.ModelAdmin):
    list_display = ("report_type", "status", "row_count", "runtime_ms", "run_by", "started_at")
    list_filter = ("status", "report_type")
    readonly_fields = ("started_at", "finished_at", "runtime_ms", "row_count")
    search_fields = ("report_type",)


@admin.register(DashboardWidget)
class DashboardWidgetAdmin(admin.ModelAdmin):
    list_display = ("name", "user", "widget_type", "metric_key", "position", "is_visible")
    list_filter = ("widget_type", "is_visible")
    search_fields = ("name", "metric_key")

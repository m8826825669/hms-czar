from rest_framework import serializers

from .models import SavedReport, ReportRun, DashboardWidget


class SavedReportSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source="created_by.get_full_name", read_only=True)

    class Meta:
        model = SavedReport
        fields = [
            "id", "hospital", "name", "description", "report_type",
            "parameters", "is_pinned", "created_by", "created_by_name",
            "created_at", "updated_at",
        ]
        read_only_fields = ["created_by", "created_at", "updated_at"]


class ReportRunSerializer(serializers.ModelSerializer):
    run_by_name = serializers.CharField(source="run_by.get_full_name", read_only=True)
    report_name = serializers.CharField(source="report.name", read_only=True)

    class Meta:
        model = ReportRun
        fields = [
            "id", "report", "report_name", "report_type", "parameters",
            "status", "row_count", "runtime_ms", "error_message",
            "run_by", "run_by_name", "started_at", "finished_at",
        ]
        read_only_fields = ["run_by", "started_at", "finished_at"]


class DashboardWidgetSerializer(serializers.ModelSerializer):
    class Meta:
        model = DashboardWidget
        fields = [
            "id", "user", "name", "widget_type", "metric_key",
            "parameters", "position", "is_visible", "created_at",
        ]
        read_only_fields = ["user", "created_at"]

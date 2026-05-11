"""
Analytics views.

Endpoints:

  GET  /api/analytics/dashboard/                  → full payload (KPIs + 14 widgets)
  GET  /api/analytics/kpis/                       → just the KPI cards
  GET  /api/analytics/widget/<metric>/            → single widget data
  GET  /api/analytics/report-types/               → catalog of report types
  POST /api/analytics/run-report/                 → execute a report on demand
  CRUD /api/analytics/saved-reports/              → save/list/edit reports
  POST /api/analytics/saved-reports/<id>/run/     → execute a saved report
  CRUD /api/analytics/runs/                       → run history
  CRUD /api/analytics/widgets/                    → per-user dashboard widgets
  GET  /api/analytics/go-live-checklist/          → operational readiness check
"""
from __future__ import annotations

import time
import datetime as dt

from django.utils import timezone
from rest_framework import viewsets, status, decorators, response, permissions
from rest_framework.views import APIView
from rest_framework.response import Response

from .models import SavedReport, ReportRun, DashboardWidget, REPORT_TYPES
from .serializers import (
    SavedReportSerializer, ReportRunSerializer, DashboardWidgetSerializer,
)
from .services import analytics_service as svc
from .services import golive_service


def _hospital_id_from(request):
    """Pull hospital_id from query param, falling back to user profile."""
    h = request.query_params.get("hospital_id")
    if h:
        try:
            return int(h)
        except (TypeError, ValueError):
            return None
    user = request.user
    return getattr(user, "hospital_id", None)


# ---------------------------------------------------------------------------
# Dashboard endpoints
# ---------------------------------------------------------------------------
class DashboardView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        h = _hospital_id_from(request)
        return Response(svc.dashboard_payload(h))


class KPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        h = _hospital_id_from(request)
        return Response(svc.kpi_cards(h))


class WidgetView(APIView):
    """Single-widget endpoint dispatched by metric key (URL path)."""
    permission_classes = [permissions.IsAuthenticated]

    DISPATCH = {
        "revenue_monthly": lambda req, h: svc.revenue_monthly(int(req.query_params.get("months", 6)), h),
        "opd_volume":      lambda req, h: svc.opd_volume_daily(int(req.query_params.get("days", 30)), h),
        "revenue_by_dept": lambda req, h: svc.revenue_by_department(
            int(req.query_params["month"]) if req.query_params.get("month") else None,
            int(req.query_params["year"])  if req.query_params.get("year")  else None,
            h,
        ),
        "ot_utilization":  lambda req, h: svc.ot_utilization(int(req.query_params.get("days", 30)), h),
        "ipd_occupancy":   lambda req, h: svc.ipd_occupancy_by_ward(h),
        "ar_aging":        lambda req, h: svc.ar_aging(h),
        "top_diagnoses":   lambda req, h: svc.top_diagnoses(int(req.query_params.get("limit", 10)), h),
        "blood_inventory": lambda req, h: svc.blood_inventory(h),
        "hr_headcount":    lambda req, h: svc.hr_headcount(h),
        "attendance":      lambda req, h: svc.attendance_summary(hospital_id=h),
        "pharmacy_turn":   lambda req, h: svc.pharmacy_turnover(int(req.query_params.get("months", 6)), h),
        "lab_turnover":    lambda req, h: svc.lab_turnover(int(req.query_params.get("months", 6)), h),
        "asset_deprec":    lambda req, h: svc.asset_depreciation_summary(h),
        "insurance":       lambda req, h: svc.insurance_claim_summary(int(req.query_params.get("months", 6)), h),
        "complaints":      lambda req, h: svc.complaints_sla(int(req.query_params.get("months", 3)), h),
    }

    def get(self, request, metric):
        fn = self.DISPATCH.get(metric)
        if not fn:
            return Response(
                {"detail": f"Unknown metric: {metric}", "available": list(self.DISPATCH.keys())},
                status=status.HTTP_404_NOT_FOUND,
            )
        h = _hospital_id_from(request)
        return Response({"metric": metric, "data": fn(request, h)})


# ---------------------------------------------------------------------------
# Report types + ad-hoc runner
# ---------------------------------------------------------------------------
class ReportTypesView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response([{"code": c, "label": l} for c, l in REPORT_TYPES])


class RunReportView(APIView):
    """Run a report on-demand without saving it."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        report_type = request.data.get("report_type")
        parameters = request.data.get("parameters") or {}
        if not report_type:
            return Response({"detail": "report_type is required"}, status=status.HTTP_400_BAD_REQUEST)
        h = _hospital_id_from(request)

        run = ReportRun.objects.create(
            report=None,
            report_type=report_type,
            parameters=parameters,
            run_by=request.user if request.user.is_authenticated else None,
        )
        t0 = time.perf_counter()
        try:
            data = svc.run_report(report_type, parameters, h)
        except Exception as exc:
            run.status = "FAILED"
            run.error_message = str(exc)
            run.finished_at = timezone.now()
            run.runtime_ms = int((time.perf_counter() - t0) * 1000)
            run.save()
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        row_count = len(data) if isinstance(data, list) else (len(data.get("buckets", [])) if isinstance(data, dict) else 0)
        run.status = "COMPLETED"
        run.row_count = row_count
        run.runtime_ms = int((time.perf_counter() - t0) * 1000)
        run.finished_at = timezone.now()
        run.save()

        return Response({
            "run_id": run.id,
            "report_type": report_type,
            "parameters": parameters,
            "row_count": row_count,
            "runtime_ms": run.runtime_ms,
            "data": data,
        })


# ---------------------------------------------------------------------------
# Saved report CRUD + run-on-demand
# ---------------------------------------------------------------------------
class SavedReportViewSet(viewsets.ModelViewSet):
    queryset = SavedReport.objects.all()
    serializer_class = SavedReportSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        h = _hospital_id_from(self.request)
        if h:
            qs = qs.filter(hospital_id=h)
        return qs.order_by("-is_pinned", "name")

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user if self.request.user.is_authenticated else None)

    @decorators.action(detail=True, methods=["post"], url_path="run")
    def run(self, request, pk=None):
        rep = self.get_object()
        h = _hospital_id_from(request)
        run = ReportRun.objects.create(
            report=rep,
            report_type=rep.report_type,
            parameters=rep.parameters,
            run_by=request.user if request.user.is_authenticated else None,
        )
        t0 = time.perf_counter()
        try:
            data = svc.run_report(rep.report_type, rep.parameters, h)
        except Exception as exc:
            run.status = "FAILED"
            run.error_message = str(exc)
            run.finished_at = timezone.now()
            run.runtime_ms = int((time.perf_counter() - t0) * 1000)
            run.save()
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        row_count = len(data) if isinstance(data, list) else (len(data.get("buckets", [])) if isinstance(data, dict) else 0)
        run.status = "COMPLETED"
        run.row_count = row_count
        run.runtime_ms = int((time.perf_counter() - t0) * 1000)
        run.finished_at = timezone.now()
        run.save()
        return Response({
            "run_id":   run.id,
            "report":   SavedReportSerializer(rep).data,
            "row_count": row_count,
            "runtime_ms": run.runtime_ms,
            "data": data,
        })


class ReportRunViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = ReportRun.objects.all()
    serializer_class = ReportRunSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset().order_by("-started_at")
        rt = self.request.query_params.get("report_type")
        if rt:
            qs = qs.filter(report_type=rt)
        return qs[:200]


# ---------------------------------------------------------------------------
# Dashboard widget personalisation
# ---------------------------------------------------------------------------
class DashboardWidgetViewSet(viewsets.ModelViewSet):
    queryset = DashboardWidget.objects.all()
    serializer_class = DashboardWidgetSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return super().get_queryset().filter(user=self.request.user).order_by("position", "id")

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


# ---------------------------------------------------------------------------
# Go-live readiness checklist
# ---------------------------------------------------------------------------
class GoLiveChecklistView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        h = _hospital_id_from(request)
        return Response(golive_service.run_checks(h))

"""GSTR API endpoints (Phase 2c additions to apps.billing).

These are standalone API views (not on the InvoiceViewSet) so they don't
disturb the existing Phase 1c/2b billing routes. They're wired up via
billing/urls.py (see the matching update file in this zip).

Endpoints:
  GET /api/billing/gst/gstr1/?year=2026&month=5    → JSON
  GET /api/billing/gst/gstr3b/?year=2026&month=5   → JSON
  GET /api/billing/gst/workbook/?year=2026&month=5 → .xlsx download
"""
from datetime import date
from django.http import HttpResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.billing.services.gst_reports import (build_gstr1, build_gstr3b,
                                                build_gstr_workbook)


def _parse_period(request):
    today = date.today()
    try:
        year = int(request.query_params.get("year", today.year))
        month = int(request.query_params.get("month", today.month))
    except (TypeError, ValueError):
        return None, None, "year and month must be integers"
    if not (1 <= month <= 12):
        return None, None, "month out of range"
    if year < 2017:
        return None, None, "year out of range"
    return year, month, None


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def gstr1_view(request):
    year, month, err = _parse_period(request)
    if err:
        return Response({"detail": err}, status=400)
    data = build_gstr1(hospital=request.hospital, year=year, month=month)
    return Response(data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def gstr3b_view(request):
    year, month, err = _parse_period(request)
    if err:
        return Response({"detail": err}, status=400)
    data = build_gstr3b(hospital=request.hospital, year=year, month=month)
    return Response(data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def gstr_workbook_view(request):
    year, month, err = _parse_period(request)
    if err:
        return Response({"detail": err}, status=400)
    try:
        xlsx_bytes = build_gstr_workbook(
            hospital=request.hospital, year=year, month=month,
        )
    except Exception as e:
        return Response({"detail": f"Workbook build failed: {e}"}, status=500)
    resp = HttpResponse(
        xlsx_bytes,
        content_type=("application/vnd.openxmlformats-officedocument."
                      "spreadsheetml.sheet"),
    )
    resp["Content-Disposition"] = (
        f'attachment; filename="GSTR_{year}_{month:02d}.xlsx"'
    )
    return resp

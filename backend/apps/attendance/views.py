from datetime import date, datetime, timedelta
from decimal import Decimal
from django.utils import timezone
from rest_framework import serializers, viewsets, status
from rest_framework.decorators import action, api_view
from rest_framework.response import Response

from .models import Shift, Holiday, ShiftRoster, AttendanceLog, DailyAttendance, Overtime


class ShiftSerializer(serializers.ModelSerializer):
    class Meta:
        model = Shift
        fields = "__all__"


class HolidaySerializer(serializers.ModelSerializer):
    class Meta:
        model = Holiday
        fields = "__all__"


class ShiftRosterSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source="employee.full_name", read_only=True)
    shift_code = serializers.CharField(source="shift.code", read_only=True)
    class Meta:
        model = ShiftRoster
        fields = "__all__"


class AttendanceLogSerializer(serializers.ModelSerializer):
    employee_code = serializers.CharField(source="employee.employee_code", read_only=True)
    employee_name = serializers.CharField(source="employee.full_name", read_only=True)
    punch_type_label = serializers.CharField(source="get_punch_type_display", read_only=True)
    class Meta:
        model = AttendanceLog
        fields = "__all__"


class DailyAttendanceSerializer(serializers.ModelSerializer):
    employee_code = serializers.CharField(source="employee.employee_code", read_only=True)
    employee_name = serializers.CharField(source="employee.full_name", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    class Meta:
        model = DailyAttendance
        fields = "__all__"


class OvertimeSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source="employee.full_name", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    class Meta:
        model = Overtime
        fields = "__all__"


class ShiftViewSet(viewsets.ModelViewSet):
    queryset = Shift.objects.all()
    serializer_class = ShiftSerializer
    filterset_fields = ["is_active"]


class HolidayViewSet(viewsets.ModelViewSet):
    queryset = Holiday.objects.all()
    serializer_class = HolidaySerializer
    filterset_fields = ["is_optional"]


class ShiftRosterViewSet(viewsets.ModelViewSet):
    queryset = ShiftRoster.objects.select_related("employee", "shift").all()
    serializer_class = ShiftRosterSerializer
    filterset_fields = ["employee", "shift", "work_date"]


class AttendanceLogViewSet(viewsets.ModelViewSet):
    queryset = AttendanceLog.objects.select_related("employee").all()
    serializer_class = AttendanceLogSerializer
    filterset_fields = ["employee", "punch_type", "source"]

    @action(detail=False, methods=["post"])
    def punch(self, request):
        """Record a punch event: { employee_id, punch_type, source? }"""
        from apps.hr.models import Employee
        try:
            emp = Employee.objects.get(id=request.data["employee_id"])
        except (KeyError, Employee.DoesNotExist):
            return Response({"detail": "Invalid employee."}, status=400)

        log = AttendanceLog.objects.create(
            employee=emp,
            punch_type=request.data.get("punch_type", "IN"),
            source=request.data.get("source", "MANUAL"),
            location=request.data.get("location", ""),
            notes=request.data.get("notes", ""),
            recorded_by=request.user if request.user.is_authenticated else None,
        )

        # Auto-update DailyAttendance
        today = log.punch_time.date()
        da, _ = DailyAttendance.objects.get_or_create(
            employee=emp, work_date=today,
            defaults={"status": "PRESENT"},
        )
        if log.punch_type == "IN" and not da.check_in_time:
            da.check_in_time = log.punch_time
            da.status = "PRESENT"
        elif log.punch_type == "OUT":
            da.check_out_time = log.punch_time
            if da.check_in_time:
                diff = (log.punch_time - da.check_in_time).total_seconds() / 3600
                da.hours_worked = Decimal(str(round(diff, 2)))
        da.save()

        return Response(AttendanceLogSerializer(log).data, status=201)


class DailyAttendanceViewSet(viewsets.ModelViewSet):
    queryset = DailyAttendance.objects.select_related("employee").all()
    serializer_class = DailyAttendanceSerializer
    filterset_fields = ["employee", "status", "work_date"]


class OvertimeViewSet(viewsets.ModelViewSet):
    queryset = Overtime.objects.select_related("employee", "approved_by").all()
    serializer_class = OvertimeSerializer
    filterset_fields = ["employee", "status"]


@api_view(["GET"])
def today_summary(request):
    """Today's attendance counts."""
    from apps.hr.models import Employee
    today = timezone.localdate()
    total_active = Employee.objects.filter(status="ACTIVE").count()
    today_attendance = DailyAttendance.objects.filter(work_date=today)

    return Response({
        "date": today.isoformat(),
        "total_active_employees": total_active,
        "counts": {
            "present": today_attendance.filter(status="PRESENT").count(),
            "absent": today_attendance.filter(status="ABSENT").count(),
            "late": today_attendance.filter(status="LATE").count(),
            "on_leave": today_attendance.filter(status="ON_LEAVE").count(),
            "half_day": today_attendance.filter(status="HALF_DAY").count(),
        },
        "marked_total": today_attendance.count(),
        "unmarked": total_active - today_attendance.count(),
    })

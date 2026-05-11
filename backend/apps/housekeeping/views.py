from datetime import date, timedelta
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view
from rest_framework.response import Response

from .models import (
    HKZone, HKStaff, HKTaskTemplate, HKTaskAssignment, DeepCleaningSchedule,
)
from .serializers import (
    HKZoneSerializer, HKStaffSerializer, HKTaskTemplateSerializer,
    HKTaskAssignmentSerializer, DeepCleaningScheduleSerializer,
)


class HKZoneViewSet(viewsets.ModelViewSet):
    queryset = HKZone.objects.all()
    serializer_class = HKZoneSerializer
    filterset_fields = ["zone_type", "criticality", "is_active"]
    search_fields = ["code", "name"]


class HKStaffViewSet(viewsets.ModelViewSet):
    queryset = HKStaff.objects.all()
    serializer_class = HKStaffSerializer
    filterset_fields = ["role", "shift", "is_on_duty", "is_active"]
    search_fields = ["employee_code", "full_name"]


class HKTaskTemplateViewSet(viewsets.ModelViewSet):
    queryset = HKTaskTemplate.objects.select_related("zone").all()
    serializer_class = HKTaskTemplateSerializer
    filterset_fields = ["zone", "task_type", "frequency", "is_active"]


class HKTaskAssignmentViewSet(viewsets.ModelViewSet):
    queryset = (HKTaskAssignment.objects
                .select_related("template", "zone", "assigned_to").all())
    serializer_class = HKTaskAssignmentSerializer
    filterset_fields = ["status", "zone", "assigned_to", "scheduled_date"]

    @action(detail=True, methods=["post"])
    def start(self, request, pk=None):
        a = self.get_object()
        if a.status != "PENDING":
            return Response({"detail": f"Cannot start {a.status}"}, status=400)
        a.status = "IN_PROGRESS"
        a.started_at = timezone.now()
        a.save(update_fields=["status", "started_at", "updated_at"])
        return Response(self.get_serializer(a).data)

    @action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        a = self.get_object()
        if a.status not in ("PENDING", "IN_PROGRESS"):
            return Response({"detail": f"Cannot complete {a.status}"}, status=400)
        a.status = "COMPLETED"
        a.completed_at = timezone.now()
        a.notes = request.data.get("notes", a.notes)
        a.save(update_fields=["status", "completed_at", "notes", "updated_at"])
        return Response(self.get_serializer(a).data)

    @action(detail=True, methods=["post"])
    def inspect(self, request, pk=None):
        a = self.get_object()
        rating = int(request.data["quality_rating"])
        a.quality_rating = rating
        a.quality_notes = request.data.get("quality_notes", "")
        if request.data.get("inspector_id"):
            a.inspected_by = HKStaff.objects.get(id=request.data["inspector_id"])
        if rating < 3:
            a.status = "REJECTED"
        a.save()
        return Response(self.get_serializer(a).data)


class DeepCleaningScheduleViewSet(viewsets.ModelViewSet):
    queryset = DeepCleaningSchedule.objects.select_related("zone").all()
    serializer_class = DeepCleaningScheduleSerializer
    filterset_fields = ["event_type", "status", "zone"]


@api_view(["GET"])
def today_summary(request):
    """Today's housekeeping summary — open tasks by zone + by status."""
    today = timezone.localdate()
    today_tasks = HKTaskAssignment.objects.filter(scheduled_date=today)

    return Response({
        "date": today.isoformat(),
        "counts": {
            "total":       today_tasks.count(),
            "pending":     today_tasks.filter(status="PENDING").count(),
            "in_progress": today_tasks.filter(status="IN_PROGRESS").count(),
            "completed":   today_tasks.filter(status="COMPLETED").count(),
            "missed":      today_tasks.filter(status="MISSED").count(),
            "rejected":    today_tasks.filter(status="REJECTED").count(),
        },
        "by_zone": list(today_tasks.values("zone__code", "zone__name", "status")
                         .annotate(count=__import__("django.db.models",
                            fromlist=["Count"]).Count("id"))
                         .order_by("zone__code")),
    })


@api_view(["POST"])
def generate_daily_tasks(request):
    """Generate today's task assignments from templates."""
    from apps.core.models import Hospital
    hospital = Hospital.objects.first()
    target_date = request.data.get("date")
    if target_date:
        target_date = date.fromisoformat(target_date)
    else:
        target_date = timezone.localdate()

    n = 0
    for tpl in HKTaskTemplate.objects.filter(hospital=hospital, is_active=True):
        # Map frequency to number of slots/day
        slots_per_day = {
            "HOURLY": 24, "EVERY_2H": 12, "EVERY_4H": 6,
            "DAILY": 1, "TWICE": 2, "THRICE": 3,
        }.get(tpl.frequency, 1)
        if tpl.frequency in ("WEEKLY", "MONTHLY"):
            # Skip frequency-based for simplicity in this seed
            continue

        for i in range(slots_per_day):
            existing = HKTaskAssignment.objects.filter(
                template=tpl, scheduled_date=target_date,
            ).count()
            if existing >= slots_per_day:
                continue
            HKTaskAssignment.objects.create(
                template=tpl, zone=tpl.zone,
                scheduled_date=target_date,
                status="PENDING",
            )
            n += 1
    return Response({"created": n, "date": target_date.isoformat()})

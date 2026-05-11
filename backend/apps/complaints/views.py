from rest_framework import serializers, viewsets, status
from rest_framework.decorators import action, api_view
from rest_framework.response import Response

from .models import Ticket, TicketCategory, TicketComment, NPSResponse
from .services import complaints_service


# ─── Serializers ──────────────────────────────────────────────────────────

class TicketCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = TicketCategory
        fields = "__all__"


class TicketCommentSerializer(serializers.ModelSerializer):
    class Meta:
        model = TicketComment
        fields = "__all__"


class TicketSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True)
    category_code = serializers.CharField(source="category.code", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    priority_label = serializers.CharField(source="get_priority_display", read_only=True)
    source_label = serializers.CharField(source="get_source_display", read_only=True)
    assigned_to_name = serializers.SerializerMethodField()
    related_patient_name = serializers.CharField(source="related_patient.full_name",
                                                    read_only=True)
    related_department_name = serializers.CharField(source="related_department.name",
                                                       read_only=True)
    comments = TicketCommentSerializer(many=True, read_only=True)

    class Meta:
        model = Ticket
        fields = "__all__"

    def get_assigned_to_name(self, obj):
        if obj.assigned_to:
            return obj.assigned_to.get_full_name() or obj.assigned_to.username
        return ""


class NPSResponseSerializer(serializers.ModelSerializer):
    category = serializers.CharField(read_only=True)
    patient_name = serializers.CharField(source="patient.full_name", read_only=True)
    related_department_name = serializers.CharField(source="related_department.name",
                                                       read_only=True)

    class Meta:
        model = NPSResponse
        fields = "__all__"


# ─── ViewSets ─────────────────────────────────────────────────────────────

class TicketCategoryViewSet(viewsets.ModelViewSet):
    queryset = TicketCategory.objects.all()
    serializer_class = TicketCategorySerializer
    filterset_fields = ["is_active"]
    search_fields = ["code", "name"]


class TicketCommentViewSet(viewsets.ModelViewSet):
    queryset = TicketComment.objects.select_related("author", "ticket").all()
    serializer_class = TicketCommentSerializer
    filterset_fields = ["ticket", "is_internal"]


class TicketViewSet(viewsets.ModelViewSet):
    queryset = (Ticket.objects
                .select_related("category", "assigned_to", "related_patient",
                                "related_department")
                .prefetch_related("comments").all())
    serializer_class = TicketSerializer
    filterset_fields = ["status", "priority", "category", "assigned_to", "source"]
    search_fields = ["code", "title", "reporter_name", "reporter_phone"]

    def create(self, request, *args, **kwargs):
        from apps.core.models import Hospital
        try:
            hospital = Hospital.objects.first()
            category = TicketCategory.objects.get(id=request.data["category"])
            ticket = complaints_service.create_ticket(
                hospital=hospital,
                category=category,
                title=request.data["title"],
                description=request.data["description"],
                reporter_name=request.data["reporter_name"],
                source=request.data.get("source", "PATIENT"),
                reporter_phone=request.data.get("reporter_phone", ""),
                reporter_email=request.data.get("reporter_email", ""),
                related_patient_id=request.data.get("related_patient"),
                related_department_id=request.data.get("related_department"),
                related_staff_name=request.data.get("related_staff_name", ""),
                priority=request.data.get("priority"),
                notes=request.data.get("notes", ""),
            ) if False else None  # placeholder swap below
        except KeyError as e:
            return Response({"detail": f"Missing field: {e}"}, status=400)
        except TicketCategory.DoesNotExist:
            return Response({"detail": "Category not found"}, status=400)

        # Resolve FK ids
        related_patient = None
        if request.data.get("related_patient"):
            from apps.reception.models import Patient
            try:
                related_patient = Patient.objects.get(id=request.data["related_patient"])
            except Patient.DoesNotExist:
                pass
        related_dept = None
        if request.data.get("related_department"):
            from apps.department.models import Department
            try:
                related_dept = Department.objects.get(id=request.data["related_department"])
            except Department.DoesNotExist:
                pass

        ticket = complaints_service.create_ticket(
            hospital=hospital,
            category=category,
            title=request.data["title"],
            description=request.data["description"],
            reporter_name=request.data["reporter_name"],
            source=request.data.get("source", "PATIENT"),
            reporter_phone=request.data.get("reporter_phone", ""),
            reporter_email=request.data.get("reporter_email", ""),
            related_patient=related_patient,
            related_department=related_dept,
            related_staff_name=request.data.get("related_staff_name", ""),
            priority=request.data.get("priority"),
            notes=request.data.get("notes", ""),
        )
        return Response(self.get_serializer(ticket).data, status=201)

    @action(detail=True, methods=["post"])
    def assign(self, request, pk=None):
        from apps.accounts.models import User
        ticket = self.get_object()
        try:
            user = User.objects.get(id=request.data["user_id"])
        except (KeyError, User.DoesNotExist):
            return Response({"detail": "user_id required and must exist"}, status=400)
        complaints_service.assign_ticket(
            ticket, user=user,
            author=request.user if request.user.is_authenticated else None,
        )
        return Response(self.get_serializer(ticket).data)

    @action(detail=True, methods=["post"], url_path="add-comment")
    def add_comment(self, request, pk=None):
        ticket = self.get_object()
        comment = request.data.get("comment", "").strip()
        if not comment:
            return Response({"detail": "comment required"}, status=400)
        c = complaints_service.add_comment(
            ticket,
            comment=comment,
            author=request.user if request.user.is_authenticated else None,
            author_name=request.data.get("author_name", ""),
            is_internal=bool(request.data.get("is_internal", False)),
            attachment_url=request.data.get("attachment_url", ""),
        )
        return Response(TicketCommentSerializer(c).data, status=201)

    @action(detail=True, methods=["post"])
    def resolve(self, request, pk=None):
        ticket = self.get_object()
        resolution = request.data.get("resolution", "").strip()
        if not resolution:
            return Response({"detail": "resolution required"}, status=400)
        complaints_service.resolve_ticket(
            ticket, resolution=resolution,
            author=request.user if request.user.is_authenticated else None,
        )
        return Response(self.get_serializer(ticket).data)

    @action(detail=True, methods=["post"])
    def close(self, request, pk=None):
        ticket = self.get_object()
        complaints_service.close_ticket(
            ticket,
            satisfaction_rating=request.data.get("satisfaction_rating"),
            author=request.user if request.user.is_authenticated else None,
        )
        return Response(self.get_serializer(ticket).data)

    @action(detail=True, methods=["post"])
    def reopen(self, request, pk=None):
        ticket = self.get_object()
        reason = request.data.get("reason", "Customer reopened")
        complaints_service.reopen_ticket(
            ticket, reason=reason,
            author=request.user if request.user.is_authenticated else None,
        )
        return Response(self.get_serializer(ticket).data)


class NPSResponseViewSet(viewsets.ModelViewSet):
    queryset = NPSResponse.objects.select_related("patient", "related_department").all()
    serializer_class = NPSResponseSerializer
    filterset_fields = ["score", "related_department"]

    def create(self, request, *args, **kwargs):
        from apps.core.models import Hospital
        from apps.reception.models import Patient
        from apps.department.models import Department
        hospital = Hospital.objects.first()
        patient = None
        if request.data.get("patient"):
            try:
                patient = Patient.objects.get(id=request.data["patient"])
            except Patient.DoesNotExist:
                pass
        dept = None
        if request.data.get("related_department"):
            try:
                dept = Department.objects.get(id=request.data["related_department"])
            except Department.DoesNotExist:
                pass
        try:
            nps = complaints_service.submit_nps(
                hospital=hospital,
                reporter_name=request.data["reporter_name"],
                score=request.data["score"],
                feedback=request.data.get("feedback", ""),
                patient=patient,
                reporter_phone=request.data.get("reporter_phone", ""),
                related_visit_date=request.data.get("related_visit_date"),
                related_department=dept,
            )
        except KeyError as e:
            return Response({"detail": f"Missing field: {e}"}, status=400)
        return Response(self.get_serializer(nps).data, status=201)


@api_view(["GET"])
def nps_metrics(request):
    from apps.core.models import Hospital
    from django.utils import timezone
    from datetime import timedelta

    hospital = Hospital.objects.first()
    days = int(request.GET.get("days", 30))
    since = timezone.now() - timedelta(days=days)
    metrics = complaints_service.get_nps_metrics(hospital, since=since)
    return Response({"period_days": days, **metrics})


@api_view(["GET"])
def tickets_dashboard(request):
    from apps.core.models import Hospital
    from django.db.models import Count
    hospital = Hospital.objects.first()

    qs = Ticket.objects.filter(hospital=hospital)
    by_status = dict(qs.values_list("status").annotate(c=Count("id")))
    by_priority = dict(qs.values_list("priority").annotate(c=Count("id")))
    open_count = qs.exclude(status__in=["CLOSED", "CANCELLED", "RESOLVED"]).count()
    breached = qs.filter(is_sla_breached=True).count()
    avg_satisfaction = (qs.filter(customer_satisfaction__isnull=False)
                        .values_list("customer_satisfaction", flat=True))
    avg_csat = round(sum(avg_satisfaction) / len(avg_satisfaction), 2) \
        if avg_satisfaction else 0

    return Response({
        "open_count": open_count,
        "sla_breached": breached,
        "by_status": by_status,
        "by_priority": by_priority,
        "avg_csat": avg_csat,
        "total": qs.count(),
    })

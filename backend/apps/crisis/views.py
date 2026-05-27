"""Crisis views.

Endpoint surface:

  Codes (master list — configuration)
  -----------------------------------
  GET    /crisis/codes/                            list
  POST   /crisis/codes/                            create
  GET    /crisis/codes/{id}/                       retrieve
  PATCH  /crisis/codes/{id}/                       edit
  DELETE /crisis/codes/{id}/                       delete (blocked if has activations/drills)

  Activations (live + historical)
  -------------------------------
  GET    /crisis/activations/                      list (filter by code, resolved, date)
  POST   /crisis/activations/                      create (called_by = request.user)
  GET    /crisis/activations/{id}/                 retrieve
  PATCH  /crisis/activations/{id}/                 edit (409 if resolved)
  DELETE /crisis/activations/{id}/                 delete (409 if resolved)
  POST   /crisis/activations/{id}/respond/         mark responded_at = now (idempotent)
  POST   /crisis/activations/{id}/resolve/         mark resolved_at = now + record outcome
  POST   /crisis/activations/{id}/add-responder/   { user_id }
  GET    /crisis/activations/live/                 unresolved activations (resolved_at null)
  GET    /crisis/activations/stats/                aggregate counts + avg response time

  Drills
  ------
  GET    /crisis/drills/                           list
  POST   /crisis/drills/                           create (organizer = request.user)
  GET    /crisis/drills/{id}/                      retrieve
  PATCH  /crisis/drills/{id}/                      edit (409 if completed)
  DELETE /crisis/drills/{id}/                      delete (409 if completed)
  POST   /crisis/drills/{id}/start/                SCHEDULED → IN_PROGRESS
  POST   /crisis/drills/{id}/complete/             IN_PROGRESS → COMPLETED + record rating
  POST   /crisis/drills/{id}/cancel/               → CANCELLED (only if not started)
  GET    /crisis/drills/upcoming/                  scheduled + not yet started
"""
from datetime import timedelta

from django.db.models import Avg, Count, Q, F
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.core.views import TenantScopedViewSetMixin
from .models import EmergencyCode, CodeActivation, Drill
from .serializers import (
    EmergencyCodeSerializer, CodeActivationSerializer, DrillSerializer,
)


# ─── Code master ────────────────────────────────────────────────────────────

class EmergencyCodeViewSet(TenantScopedViewSetMixin, viewsets.ModelViewSet):
    queryset = EmergencyCode.objects.all()
    serializer_class = EmergencyCodeSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["is_active", "requires_evacuation"]
    search_fields = ["code", "name", "description"]
    ordering_fields = ["code", "name"]
    ordering = ["code"]

    def destroy(self, request, *args, **kwargs):
        obj = self.get_object()
        if obj.activations.exists():
            return Response(
                {"detail": f"Cannot delete code {obj.code}: it has "
                            f"{obj.activations.count()} activation(s). "
                           "Deactivate instead (set is_active=false)."},
                status=status.HTTP_409_CONFLICT,
            )
        if obj.drills.exists():
            return Response(
                {"detail": f"Cannot delete code {obj.code}: it has "
                            f"{obj.drills.count()} drill(s). "
                           "Deactivate instead."},
                status=status.HTTP_409_CONFLICT,
            )
        return super().destroy(request, *args, **kwargs)


# ─── Activations ────────────────────────────────────────────────────────────

class CodeActivationViewSet(TenantScopedViewSetMixin, viewsets.ModelViewSet):
    queryset = CodeActivation.objects.select_related(
        "code", "called_by", "department", "patient",
    ).prefetch_related("responders")
    serializer_class = CodeActivationSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["code", "outcome", "department"]
    search_fields = ["location", "notes", "outcome_notes"]
    ordering_fields = ["called_at", "resolved_at"]
    ordering = ["-called_at"]

    def get_queryset(self):
        qs = super().get_queryset()
        # ?resolved=true / false filter (presence of resolved_at)
        resolved = self.request.query_params.get("resolved")
        if resolved == "true":
            qs = qs.filter(resolved_at__isnull=False)
        elif resolved == "false":
            qs = qs.filter(resolved_at__isnull=True)
        # Optional date range
        date_from = self.request.query_params.get("from")
        date_to = self.request.query_params.get("to")
        if date_from:
            qs = qs.filter(called_at__date__gte=date_from)
        if date_to:
            qs = qs.filter(called_at__date__lte=date_to)
        return qs

    def perform_create(self, serializer):
        serializer.save(
            hospital=self.request.hospital,
            created_by=self.request.user,
            called_by=self.request.user,
        )

    def update(self, request, *args, **kwargs):
        obj = self.get_object()
        if obj.is_resolved:
            return Response(
                {"detail": "Cannot edit a resolved activation. Add an "
                           "addendum or create a follow-up record instead."},
                status=status.HTTP_409_CONFLICT,
            )
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        obj = self.get_object()
        if obj.is_resolved:
            return Response(
                {"detail": "Cannot delete a resolved activation "
                           "(medico-legal evidence)."},
                status=status.HTTP_409_CONFLICT,
            )
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=["post"])
    def respond(self, request, pk=None):
        """Stamp responded_at = now. Idempotent (returns existing time)."""
        obj = self.get_object()
        if obj.is_resolved:
            return Response(
                {"detail": "Activation is already resolved."},
                status=status.HTTP_409_CONFLICT,
            )
        if obj.responded_at is None:
            obj.responded_at = timezone.now()
            obj.save(update_fields=["responded_at", "updated_at"])
        return Response(self.get_serializer(obj).data)

    @action(detail=True, methods=["post"])
    def resolve(self, request, pk=None):
        """Stamp resolved_at = now, set outcome, seal the record.

        Body (required):
          { outcome: 'RESOLVED' | 'FALSE_ALARM' | 'ESCALATED' | 'FATALITY' | 'OTHER',
            outcome_notes?: string }
        """
        obj = self.get_object()
        if obj.is_resolved:
            return Response(
                {"detail": "Activation is already resolved."},
                status=status.HTTP_409_CONFLICT,
            )
        outcome = request.data.get("outcome", "").upper()
        valid = [c[0] for c in CodeActivation.OUTCOMES]
        if outcome not in valid:
            return Response(
                {"detail": f"outcome must be one of {valid}."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        obj.outcome = outcome
        obj.outcome_notes = request.data.get("outcome_notes", "")
        obj.resolved_at = timezone.now()
        # Auto-fill responded_at if not yet set (the responders showed up at
        # some point; default to resolve time so duration math works)
        if obj.responded_at is None:
            obj.responded_at = obj.resolved_at
        obj.save(update_fields=[
            "outcome", "outcome_notes", "resolved_at", "responded_at", "updated_at",
        ])
        return Response(self.get_serializer(obj).data)

    @action(detail=True, methods=["post"], url_path="add-responder")
    def add_responder(self, request, pk=None):
        """Add a user to responders. Body: { user_id }"""
        obj = self.get_object()
        if obj.is_resolved:
            return Response(
                {"detail": "Cannot modify a resolved activation."},
                status=status.HTTP_409_CONFLICT,
            )
        user_id = request.data.get("user_id")
        if not user_id:
            return Response(
                {"detail": "user_id is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        from django.contrib.auth import get_user_model
        User = get_user_model()
        try:
            u = User.objects.get(pk=user_id, hospital=request.hospital)
        except User.DoesNotExist:
            return Response(
                {"detail": f"User {user_id} not found in this hospital."},
                status=status.HTTP_404_NOT_FOUND,
            )
        obj.responders.add(u)
        return Response(self.get_serializer(obj).data)

    @action(detail=False, methods=["get"])
    def live(self, request):
        """Currently-unresolved activations (the 'incident board')."""
        qs = self.get_queryset().filter(resolved_at__isnull=True)
        page = self.paginate_queryset(qs)
        if page is not None:
            return self.get_paginated_response(self.get_serializer(page, many=True).data)
        return Response(self.get_serializer(qs, many=True).data)

    @action(detail=False, methods=["get"])
    def stats(self, request):
        """Aggregate stats. Filterable by date range.

        Returns:
          {
            "total_activations": N,
            "live_count": N,
            "resolved_count": N,
            "false_alarm_count": N,
            "avg_response_seconds": int | null,
            "by_code": [ {code, code_name, count}, ... ]
          }
        """
        qs = self.get_queryset()  # date range already applied if provided

        total = qs.count()
        live = qs.filter(resolved_at__isnull=True).count()
        resolved = qs.filter(resolved_at__isnull=False).count()
        false_alarm = qs.filter(outcome="FALSE_ALARM").count()

        # Average response time over activations that did respond
        responded = qs.filter(responded_at__isnull=False)
        avg_response = None
        if responded.exists():
            total_seconds = 0
            n = 0
            for a in responded:
                if a.response_seconds is not None:
                    total_seconds += a.response_seconds
                    n += 1
            avg_response = int(total_seconds / n) if n else None

        # Breakdown by code
        by_code_qs = (
            qs.values("code__code", "code__name")
              .annotate(count=Count("id"))
              .order_by("-count")
        )
        by_code = [
            {"code": r["code__code"], "code_name": r["code__name"],
             "count": r["count"]}
            for r in by_code_qs
        ]

        return Response({
            "total_activations": total,
            "live_count": live,
            "resolved_count": resolved,
            "false_alarm_count": false_alarm,
            "avg_response_seconds": avg_response,
            "by_code": by_code,
        })


# ─── Drills ─────────────────────────────────────────────────────────────────

class DrillViewSet(TenantScopedViewSetMixin, viewsets.ModelViewSet):
    queryset = Drill.objects.select_related("code", "organizer").prefetch_related(
        "participants", "observers",
    )
    serializer_class = DrillSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["status", "code", "rating"]
    search_fields = ["location", "notes"]
    ordering_fields = ["scheduled_at", "completed_at"]
    ordering = ["-scheduled_at"]

    def perform_create(self, serializer):
        serializer.save(
            hospital=self.request.hospital,
            created_by=self.request.user,
            organizer=self.request.user,
        )

    def update(self, request, *args, **kwargs):
        obj = self.get_object()
        if obj.status == "COMPLETED":
            return Response(
                {"detail": "Cannot edit a completed drill. Lessons learned "
                           "should be added separately."},
                status=status.HTTP_409_CONFLICT,
            )
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        obj = self.get_object()
        if obj.status == "COMPLETED":
            return Response(
                {"detail": "Cannot delete a completed drill."},
                status=status.HTTP_409_CONFLICT,
            )
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=["post"])
    def start(self, request, pk=None):
        """SCHEDULED → IN_PROGRESS. Sets started_at = now."""
        obj = self.get_object()
        if obj.status != "SCHEDULED":
            return Response(
                {"detail": f"Cannot start drill in status {obj.status}."},
                status=status.HTTP_409_CONFLICT,
            )
        obj.status = "IN_PROGRESS"
        obj.started_at = timezone.now()
        obj.save(update_fields=["status", "started_at", "updated_at"])
        return Response(self.get_serializer(obj).data)

    @action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        """IN_PROGRESS → COMPLETED. Sets completed_at = now and records rating.

        Body (required):
          { rating: 'EXCELLENT' | 'SATISFACTORY' | 'NEEDS_IMPROVEMENT' | 'FAILED',
            actual_response_seconds?: int,
            notes?: string }
        """
        obj = self.get_object()
        if obj.status not in ("IN_PROGRESS", "SCHEDULED"):
            return Response(
                {"detail": f"Cannot complete drill in status {obj.status}."},
                status=status.HTTP_409_CONFLICT,
            )
        rating = request.data.get("rating", "").upper()
        valid = [c[0] for c in Drill.RATINGS]
        if rating not in valid:
            return Response(
                {"detail": f"rating must be one of {valid}."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        obj.rating = rating
        obj.status = "COMPLETED"
        obj.completed_at = timezone.now()
        if obj.started_at is None:
            obj.started_at = obj.completed_at
        if request.data.get("actual_response_seconds") is not None:
            obj.actual_response_seconds = int(request.data["actual_response_seconds"])
        if request.data.get("notes"):
            obj.notes = (obj.notes + "\n\n" + request.data["notes"]).strip()
        obj.save(update_fields=[
            "status", "rating", "completed_at", "started_at",
            "actual_response_seconds", "notes", "updated_at",
        ])
        return Response(self.get_serializer(obj).data)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        """SCHEDULED → CANCELLED. Cannot cancel in-progress or completed."""
        obj = self.get_object()
        if obj.status != "SCHEDULED":
            return Response(
                {"detail": f"Cannot cancel drill in status {obj.status}."},
                status=status.HTTP_409_CONFLICT,
            )
        obj.status = "CANCELLED"
        obj.save(update_fields=["status", "updated_at"])
        return Response(self.get_serializer(obj).data)

    @action(detail=False, methods=["get"])
    def upcoming(self, request):
        """Drills scheduled for the future (not yet started)."""
        qs = self.get_queryset().filter(
            status="SCHEDULED",
            scheduled_at__gte=timezone.now() - timedelta(hours=1),  # grace
        ).order_by("scheduled_at")
        return Response(self.get_serializer(qs, many=True).data)

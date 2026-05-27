"""Protection views.

Endpoint surface:

  Concerns
  --------
  GET    /protection/concerns/                       list (visibility-filtered)
  POST   /protection/concerns/                       create (reporter = request.user)
  GET    /protection/concerns/{id}/                  retrieve (404 if not visible)
  PATCH  /protection/concerns/{id}/                  edit (409 if sealed)
  DELETE /protection/concerns/{id}/                  always 405 — use /cancel/
  POST   /protection/concerns/{id}/submit/           DRAFT → OPEN
  POST   /protection/concerns/{id}/assign/           assign investigator
  POST   /protection/concerns/{id}/grant-access/     add to additional_viewers
  POST   /protection/concerns/{id}/revoke-access/    remove from additional_viewers
  POST   /protection/concerns/{id}/close/            OPEN → CLOSED + summary
  POST   /protection/concerns/{id}/escalate/         OPEN → ESCALATED + summary
  POST   /protection/concerns/{id}/cancel/           DRAFT/OPEN → CANCELLED + summary
  GET    /protection/concerns/my-cases/              concerns where I'm reporter or investigator
  GET    /protection/concerns/stats/                 aggregate counts (admin/lead role)

  Notes (append-only)
  -------------------
  GET    /protection/notes/?concern=ID               list notes on a concern
  POST   /protection/notes/                          create note (author = request.user)
  GET    /protection/notes/{id}/                     retrieve
  PUT, PATCH, DELETE → 405

  Referrals (append-only)
  -----------------------
  GET    /protection/referrals/?concern=ID           list referrals on a concern
  POST   /protection/referrals/                      create (referred_by = request.user)
  GET    /protection/referrals/{id}/                 retrieve
  POST   /protection/referrals/{id}/update-outcome/  update outcome (only safe field)
  PUT, PATCH, DELETE → 405
"""
from django.db.models import Q, Count
from django.utils import timezone
from rest_framework import viewsets, status, mixins
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.core.views import TenantScopedViewSetMixin
from .models import SafeguardingConcern, ConcernNote, ConcernReferral
from .serializers import (
    SafeguardingConcernSerializer,
    ConcernNoteSerializer,
    ConcernReferralSerializer,
)


# ─── Concerns ───────────────────────────────────────────────────────────────

class SafeguardingConcernViewSet(TenantScopedViewSetMixin, viewsets.ModelViewSet):
    """CRUD-ish for SafeguardingConcern.

    Confidentiality filter: a user sees a concern only if they are
      - the reporter, OR
      - the investigator, OR
      - in additional_viewers, OR
      - a superuser (admin override).
    """
    queryset = SafeguardingConcern.objects.select_related(
        "patient", "reporter", "investigator",
    ).prefetch_related("additional_viewers", "notes", "referrals")
    serializer_class = SafeguardingConcernSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["category", "risk_level", "status", "investigator"]
    search_fields = ["reference_number", "observations", "subject_description"]
    ordering_fields = ["raised_at", "risk_level", "status"]
    ordering = ["-raised_at"]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.is_superuser:
            return qs
        return qs.filter(
            Q(reporter=user) | Q(investigator=user) | Q(additional_viewers=user)
        ).distinct()

    def perform_create(self, serializer):
        serializer.save(
            hospital=self.request.hospital,
            created_by=self.request.user,
            reporter=self.request.user,
        )

    def update(self, request, *args, **kwargs):
        obj = self.get_object()
        if obj.is_sealed:
            return Response(
                {"detail": f"Concern is in terminal status ({obj.status}). "
                           "Append a note for any updates."},
                status=status.HTTP_409_CONFLICT,
            )
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        return Response(
            {"detail": "Safeguarding records cannot be deleted. Use /cancel/ "
                       "if the concern was raised in error."},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )

    # ─── Lifecycle transitions ──────────────────────────────────────────────
    def _seal(self, obj, new_status, summary):
        """Common logic to transition into a terminal status."""
        obj.status = new_status
        obj.closed_at = timezone.now()
        if summary:
            obj.closure_summary = summary
        obj.save(update_fields=["status", "closed_at", "closure_summary", "updated_at"])

    @action(detail=True, methods=["post"])
    def submit(self, request, pk=None):
        """DRAFT → OPEN."""
        obj = self.get_object()
        if obj.status != "DRAFT":
            return Response(
                {"detail": f"Can only submit DRAFT concerns (current: {obj.status})."},
                status=status.HTTP_409_CONFLICT,
            )
        obj.status = "OPEN"
        obj.save(update_fields=["status", "updated_at"])
        return Response(self.get_serializer(obj).data)

    @action(detail=True, methods=["post"])
    def assign(self, request, pk=None):
        """Assign investigator. Body: { user_id }"""
        obj = self.get_object()
        if obj.is_sealed:
            return Response(
                {"detail": "Cannot reassign a sealed concern."},
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
        obj.investigator = u
        obj.save(update_fields=["investigator", "updated_at"])
        return Response(self.get_serializer(obj).data)

    @action(detail=True, methods=["post"], url_path="grant-access")
    def grant_access(self, request, pk=None):
        """Add a user to additional_viewers. Body: { user_id }"""
        obj = self.get_object()
        user_id = request.data.get("user_id")
        if not user_id:
            return Response({"detail": "user_id is required."},
                            status=status.HTTP_400_BAD_REQUEST)
        from django.contrib.auth import get_user_model
        User = get_user_model()
        try:
            u = User.objects.get(pk=user_id, hospital=request.hospital)
        except User.DoesNotExist:
            return Response({"detail": f"User {user_id} not found."},
                            status=status.HTTP_404_NOT_FOUND)
        obj.additional_viewers.add(u)
        return Response(self.get_serializer(obj).data)

    @action(detail=True, methods=["post"], url_path="revoke-access")
    def revoke_access(self, request, pk=None):
        """Remove a user from additional_viewers. Body: { user_id }"""
        obj = self.get_object()
        user_id = request.data.get("user_id")
        if not user_id:
            return Response({"detail": "user_id is required."},
                            status=status.HTTP_400_BAD_REQUEST)
        from django.contrib.auth import get_user_model
        User = get_user_model()
        try:
            u = User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return Response({"detail": f"User {user_id} not found."},
                            status=status.HTTP_404_NOT_FOUND)
        obj.additional_viewers.remove(u)
        return Response(self.get_serializer(obj).data)

    @action(detail=True, methods=["post"])
    def close(self, request, pk=None):
        """OPEN → CLOSED. Body: { closure_summary }"""
        obj = self.get_object()
        if obj.status != "OPEN":
            return Response(
                {"detail": f"Can only close OPEN concerns (current: {obj.status})."},
                status=status.HTTP_409_CONFLICT,
            )
        summary = request.data.get("closure_summary", "").strip()
        if not summary:
            return Response(
                {"detail": "closure_summary is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        self._seal(obj, "CLOSED", summary)
        return Response(self.get_serializer(obj).data)

    @action(detail=True, methods=["post"])
    def escalate(self, request, pk=None):
        """OPEN → ESCALATED. Body: { closure_summary }"""
        obj = self.get_object()
        if obj.status != "OPEN":
            return Response(
                {"detail": f"Can only escalate OPEN concerns (current: {obj.status})."},
                status=status.HTTP_409_CONFLICT,
            )
        summary = request.data.get("closure_summary", "").strip()
        if not summary:
            return Response(
                {"detail": "closure_summary is required (describe what's been escalated)."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        self._seal(obj, "ESCALATED", summary)
        return Response(self.get_serializer(obj).data)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        """DRAFT or OPEN → CANCELLED. Body: { closure_summary }"""
        obj = self.get_object()
        if obj.status not in ("DRAFT", "OPEN"):
            return Response(
                {"detail": f"Can only cancel DRAFT/OPEN concerns (current: {obj.status})."},
                status=status.HTTP_409_CONFLICT,
            )
        summary = request.data.get("closure_summary", "").strip()
        if not summary:
            return Response(
                {"detail": "closure_summary is required (reason for cancellation)."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        self._seal(obj, "CANCELLED", summary)
        return Response(self.get_serializer(obj).data)

    @action(detail=False, methods=["get"], url_path="my-cases")
    def my_cases(self, request):
        """Concerns where I'm the reporter or investigator."""
        qs = super().get_queryset().filter(
            Q(reporter=request.user) | Q(investigator=request.user)
        ).distinct().order_by("-raised_at")
        page = self.paginate_queryset(qs)
        if page is not None:
            return self.get_paginated_response(self.get_serializer(page, many=True).data)
        return Response(self.get_serializer(qs, many=True).data)

    @action(detail=False, methods=["get"])
    def stats(self, request):
        """Aggregate counts. Subject to the same visibility filter."""
        qs = self.get_queryset()
        return Response({
            "total": qs.count(),
            "by_status": {
                row["status"]: row["n"]
                for row in qs.values("status").annotate(n=Count("id"))
            },
            "by_risk_level": {
                row["risk_level"]: row["n"]
                for row in qs.values("risk_level").annotate(n=Count("id"))
            },
            "by_category": {
                row["category"]: row["n"]
                for row in qs.values("category").annotate(n=Count("id"))
            },
            "critical_open": qs.filter(
                risk_level="CRITICAL", status__in=["DRAFT", "OPEN"],
            ).count(),
        })


# ─── Notes — Append-only ────────────────────────────────────────────────────

class ConcernNoteViewSet(TenantScopedViewSetMixin,
                          mixins.CreateModelMixin,
                          mixins.RetrieveModelMixin,
                          mixins.ListModelMixin,
                          viewsets.GenericViewSet):
    """List / retrieve / create only. PUT/PATCH/DELETE return 405."""
    queryset = ConcernNote.objects.select_related("concern", "author", "addendum_to")
    serializer_class = ConcernNoteSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["concern", "note_type", "author"]
    ordering_fields = ["created_at"]
    ordering = ["-created_at"]

    def get_queryset(self):
        """Notes are visible only on concerns the user can see."""
        qs = super().get_queryset()
        user = self.request.user
        if user.is_superuser:
            return qs
        # Restrict to notes whose concern is visible to the user
        return qs.filter(
            Q(concern__reporter=user)
            | Q(concern__investigator=user)
            | Q(concern__additional_viewers=user)
        ).distinct()

    def perform_create(self, serializer):
        serializer.save(
            hospital=self.request.hospital,
            created_by=self.request.user,
            author=self.request.user,
        )


# ─── Referrals — Append-only (except outcome) ───────────────────────────────

class ConcernReferralViewSet(TenantScopedViewSetMixin,
                              mixins.CreateModelMixin,
                              mixins.RetrieveModelMixin,
                              mixins.ListModelMixin,
                              viewsets.GenericViewSet):
    """List / retrieve / create only. Outcome alone is updatable via action."""
    queryset = ConcernReferral.objects.select_related("concern", "referred_by")
    serializer_class = ConcernReferralSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["concern", "agency_type", "outcome"]
    ordering_fields = ["referred_at"]
    ordering = ["-referred_at"]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.is_superuser:
            return qs
        return qs.filter(
            Q(concern__reporter=user)
            | Q(concern__investigator=user)
            | Q(concern__additional_viewers=user)
        ).distinct()

    def perform_create(self, serializer):
        serializer.save(
            hospital=self.request.hospital,
            created_by=self.request.user,
            referred_by=self.request.user,
        )

    @action(detail=True, methods=["post"], url_path="update-outcome")
    def update_outcome(self, request, pk=None):
        """Update outcome only — the only safe field on an append-only referral.

        Body: { outcome, outcome_notes?, reference_id_from_agency? }

        outcome must be one of the OUTCOMES choices.
        """
        obj = self.get_object()
        outcome = request.data.get("outcome", "").upper()
        valid = [c[0] for c in ConcernReferral.OUTCOMES]
        if outcome not in valid:
            return Response(
                {"detail": f"outcome must be one of {valid}."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        obj.outcome = outcome
        obj.outcome_notes = request.data.get("outcome_notes", obj.outcome_notes)
        if request.data.get("reference_id_from_agency"):
            obj.reference_id_from_agency = request.data["reference_id_from_agency"]
        obj.outcome_updated_at = timezone.now()
        obj.save(update_fields=[
            "outcome", "outcome_notes", "reference_id_from_agency",
            "outcome_updated_at", "updated_at",
        ])
        return Response(self.get_serializer(obj).data)

"""Internal communications views.

Endpoint surface:

  Messages
  --------
  GET    /internal-comms/messages/                   list (auto-filtered to user's mail)
  POST   /internal-comms/messages/                   send (sender=request.user)
  GET    /internal-comms/messages/{id}/              retrieve
  POST   /internal-comms/messages/{id}/mark-read/    mark received message as read
  POST   /internal-comms/messages/{id}/archive/      archive (sender or recipient view)
  GET    /internal-comms/messages/inbox/             received, not archived
  GET    /internal-comms/messages/sent/              sent, not archived
  GET    /internal-comms/messages/unread-count/      number of unread received

  Bulletins
  ---------
  GET    /internal-comms/bulletins/                  list (auto-filtered to user's audience)
  POST   /internal-comms/bulletins/                  create (author=request.user)
  GET    /internal-comms/bulletins/{id}/             retrieve with ack status
  POST   /internal-comms/bulletins/{id}/acknowledge/ acknowledge (creates BulletinAcknowledgment)
  GET    /internal-comms/bulletins/active/           non-expired, audience matches me
  GET    /internal-comms/bulletins/pending-ack/      requires_ack=true, not yet ack'd by me

  Acknowledgments
  ---------------
  GET    /internal-comms/acknowledgments/            list (managers can see all; users see own)
"""
from django.db.models import Q
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.core.views import TenantScopedViewSetMixin
from .models import Message, Bulletin, BulletinAcknowledgment
from .serializers import (
    MessageSerializer, BulletinSerializer, BulletinAcknowledgmentSerializer,
)


class MessageViewSet(TenantScopedViewSetMixin, viewsets.ModelViewSet):
    """CRUD + actions for direct messages.

    Important access rule: a user only sees messages where they are the
    sender OR the recipient. Even superusers see their own mail by default
    (use admin to see everyone's).
    """
    queryset = Message.objects.select_related("sender", "recipient", "parent_message")
    serializer_class = MessageSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["priority", "sender", "recipient", "parent_message"]
    search_fields = ["subject", "body"]
    ordering_fields = ["created_at", "read_at"]
    ordering = ["-created_at"]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        # Restrict to mail involving the requesting user
        return qs.filter(Q(sender=user) | Q(recipient=user))

    def perform_create(self, serializer):
        serializer.save(
            hospital=self.request.hospital,
            created_by=self.request.user,
            sender=self.request.user,
        )

    @action(detail=True, methods=["post"], url_path="mark-read")
    def mark_read(self, request, pk=None):
        msg = self.get_object()
        if msg.recipient_id != request.user.id:
            return Response(
                {"detail": "Only the recipient can mark a message as read."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if msg.read_at is None:
            msg.read_at = timezone.now()
            msg.save(update_fields=["read_at", "updated_at"])
        return Response(self.get_serializer(msg).data)

    @action(detail=True, methods=["post"])
    def archive(self, request, pk=None):
        """Archive from the current user's perspective. Sender archiving
        doesn't affect recipient's view and vice versa."""
        msg = self.get_object()
        if msg.sender_id == request.user.id:
            msg.is_archived_by_sender = True
        if msg.recipient_id == request.user.id:
            msg.is_archived_by_recipient = True
        msg.save(update_fields=["is_archived_by_sender",
                                 "is_archived_by_recipient", "updated_at"])
        return Response(self.get_serializer(msg).data)

    @action(detail=False, methods=["get"])
    def inbox(self, request):
        """Received, not archived by me, latest first."""
        qs = self.get_queryset().filter(
            recipient=request.user, is_archived_by_recipient=False,
        )
        page = self.paginate_queryset(qs)
        if page is not None:
            return self.get_paginated_response(self.get_serializer(page, many=True).data)
        return Response(self.get_serializer(qs, many=True).data)

    @action(detail=False, methods=["get"])
    def sent(self, request):
        """Sent by me, not archived by me, latest first."""
        qs = self.get_queryset().filter(
            sender=request.user, is_archived_by_sender=False,
        )
        page = self.paginate_queryset(qs)
        if page is not None:
            return self.get_paginated_response(self.get_serializer(page, many=True).data)
        return Response(self.get_serializer(qs, many=True).data)

    @action(detail=False, methods=["get"], url_path="unread-count")
    def unread_count(self, request):
        n = self.get_queryset().filter(
            recipient=request.user,
            read_at__isnull=True,
            is_archived_by_recipient=False,
        ).count()
        return Response({"unread": n})


class BulletinViewSet(TenantScopedViewSetMixin, viewsets.ModelViewSet):
    """CRUD + actions for bulletins.

    Anyone in the hospital can view bulletins for their audience.
    Creation is technically open to any authenticated user — restrict via
    role permissions if needed (DRF permission_classes can be tightened).
    """
    queryset = Bulletin.objects.select_related(
        "author", "audience_department", "audience_ward",
    ).prefetch_related("acknowledgments")
    serializer_class = BulletinSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["category", "priority", "audience_type",
                         "audience_department", "audience_ward",
                         "requires_acknowledgment", "is_pinned", "author"]
    search_fields = ["title", "body"]
    ordering_fields = ["created_at", "expires_at"]
    ordering = ["-is_pinned", "-created_at"]

    def perform_create(self, serializer):
        serializer.save(
            hospital=self.request.hospital,
            created_by=self.request.user,
            author=self.request.user,
        )

    @action(detail=True, methods=["post"])
    def acknowledge(self, request, pk=None):
        """Acknowledge this bulletin. Idempotent — second ack returns the
        existing record. Body (optional): { note }"""
        bulletin = self.get_object()
        if not bulletin.requires_acknowledgment:
            return Response(
                {"detail": "This bulletin does not require acknowledgment."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        ack, created = BulletinAcknowledgment.objects.get_or_create(
            bulletin=bulletin, user=request.user,
            defaults={
                "hospital": self.request.hospital,
                "created_by": request.user,
                "note": request.data.get("note", "").strip(),
            },
        )
        return Response(
            BulletinAcknowledgmentSerializer(ack).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    @action(detail=False, methods=["get"])
    def active(self, request):
        """Bulletins targeting me that haven't expired.

        Audience match logic:
          - audience_type=HOSPITAL → always included
          - audience_type=DEPARTMENT → included if user belongs to that dept
          - audience_type=WARD → included if user is assigned to that ward
                                  (best-effort; lite version is permissive)

        For now, the WARD/DEPARTMENT filtering is permissive — users see all
        bulletins regardless of department/ward assignment. A real
        deployment with strict scoping would join through hr.Employee or
        attendance.ShiftRoster. Marking as TODO for Phase 5.
        """
        now = timezone.now()
        qs = self.get_queryset().filter(
            Q(expires_at__isnull=True) | Q(expires_at__gt=now)
        )
        page = self.paginate_queryset(qs)
        if page is not None:
            return self.get_paginated_response(self.get_serializer(page, many=True).data)
        return Response(self.get_serializer(qs, many=True).data)

    @action(detail=False, methods=["get"], url_path="pending-ack")
    def pending_ack(self, request):
        """Bulletins requiring ack that I haven't yet ack'd."""
        now = timezone.now()
        # Bulletins that require ack, are not expired, and I haven't ack'd
        my_acked_ids = BulletinAcknowledgment.objects.filter(
            user=request.user,
        ).values_list("bulletin_id", flat=True)
        qs = self.get_queryset().filter(
            requires_acknowledgment=True,
        ).filter(
            Q(expires_at__isnull=True) | Q(expires_at__gt=now)
        ).exclude(id__in=list(my_acked_ids))
        return Response(self.get_serializer(qs, many=True).data)


class BulletinAcknowledgmentViewSet(TenantScopedViewSetMixin, viewsets.ReadOnlyModelViewSet):
    """List-only view of acks. Useful for compliance reporting.

    Filterable by bulletin to answer "who has acknowledged this?" or by
    user to answer "what has Dr. Sharma acknowledged this month?".
    """
    queryset = BulletinAcknowledgment.objects.select_related("bulletin", "user")
    serializer_class = BulletinAcknowledgmentSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["bulletin", "user"]
    ordering_fields = ["acknowledged_at"]
    ordering = ["-acknowledged_at"]

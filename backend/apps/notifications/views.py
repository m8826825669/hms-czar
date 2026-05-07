from rest_framework import viewsets, serializers
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from apps.core.views import TenantScopedViewSetMixin
from .models import NotificationLog, NotificationTemplate


class NotificationTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = NotificationTemplate
        fields = "__all__"
        read_only_fields = ("hospital", "created_at", "updated_at")


class NotificationLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = NotificationLog
        fields = "__all__"
        read_only_fields = [f.name for f in NotificationLog._meta.fields]


class NotificationTemplateViewSet(TenantScopedViewSetMixin, viewsets.ModelViewSet):
    queryset = NotificationTemplate.objects.all()
    serializer_class = NotificationTemplateSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]
    filterset_fields = ["channel", "is_active"]
    search_fields = ["code", "name"]


class NotificationLogViewSet(TenantScopedViewSetMixin, viewsets.ReadOnlyModelViewSet):
    queryset = NotificationLog.objects.all()
    serializer_class = NotificationLogSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["channel", "status", "related_object_type"]
    search_fields = ["to_address", "body"]

"""Auth views.

POST /api/v1/auth/login/                — JWT obtain (issues access + refresh + user payload)
POST /api/v1/auth/refresh/              — JWT refresh
POST /api/v1/auth/logout/               — Blacklists refresh token, audit-logs the event
GET  /api/v1/auth/me/                   — Current user profile
POST /api/v1/auth/change-password/      — Change own password
GET  /api/v1/auth/users/                — List users (admin)
POST /api/v1/auth/users/                — Create user (admin)
GET  /api/v1/auth/roles/                — List roles
"""
from django.contrib.auth import logout
from django.utils import timezone
from rest_framework import status, viewsets, generics
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken

from apps.core.models import AuditLog
from .models import User, Role
from .serializers import (
    HMSTokenObtainPairSerializer, UserSerializer, CreateUserSerializer,
    RoleSerializer, ChangePasswordSerializer,
)


def _client_ip(request):
    xff = request.META.get("HTTP_X_FORWARDED_FOR")
    return xff.split(",")[0].strip() if xff else request.META.get("REMOTE_ADDR")


class HMSLoginView(TokenObtainPairView):
    serializer_class = HMSTokenObtainPairSerializer

    def post(self, request, *args, **kwargs):
        username = request.data.get("username", "")
        try:
            response = super().post(request, *args, **kwargs)
            # Success: reset failed attempts, log
            user = User.objects.filter(username=username).first()
            if user:
                user.failed_login_attempts = 0
                user.last_login_ip = _client_ip(request)
                user.save(update_fields=["failed_login_attempts", "last_login_ip"])
                AuditLog.objects.create(
                    hospital=user.hospital, user=user, action="LOGIN",
                    ip_address=_client_ip(request),
                    user_agent=request.META.get("HTTP_USER_AGENT", "")[:500],
                )
            return response
        except Exception:
            user = User.objects.filter(username=username).first()
            if user:
                user.failed_login_attempts += 1
                if user.failed_login_attempts >= 5:
                    user.is_locked = True
                user.save(update_fields=["failed_login_attempts", "is_locked"])
                AuditLog.objects.create(
                    hospital=user.hospital, user=user, action="LOGIN_FAILED",
                    ip_address=_client_ip(request),
                    user_agent=request.META.get("HTTP_USER_AGENT", "")[:500],
                    detail={"attempts": user.failed_login_attempts},
                )
            raise


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def logout_view(request):
    refresh = request.data.get("refresh")
    if refresh:
        try:
            RefreshToken(refresh).blacklist()
        except Exception:
            pass
    AuditLog.objects.create(
        hospital=request.user.hospital, user=request.user, action="LOGOUT",
        ip_address=_client_ip(request),
    )
    logout(request)
    return Response({"detail": "Logged out."})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me_view(request):
    return Response(UserSerializer(request.user).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def change_password(request):
    serializer = ChangePasswordSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    user = request.user
    if not user.check_password(serializer.validated_data["old_password"]):
        return Response({"old_password": "Incorrect."}, status=status.HTTP_400_BAD_REQUEST)
    user.set_password(serializer.validated_data["new_password"])
    user.must_change_password = False
    user.save(update_fields=["password", "must_change_password"])
    AuditLog.objects.create(hospital=user.hospital, user=user, action="PASSWORD_CHANGE",
                            ip_address=_client_ip(request))
    return Response({"detail": "Password changed."})


class UserViewSet(viewsets.ModelViewSet):
    """Admin: manage users in current hospital."""
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]
    search_fields = ["username", "email", "first_name", "last_name", "employee_code", "phone"]
    filterset_fields = ["is_active", "is_locked"]

    def get_queryset(self):
        qs = super().get_queryset()
        hospital = getattr(self.request, "hospital", None)
        return qs.filter(hospital=hospital) if hospital else qs

    def get_serializer_class(self):
        return CreateUserSerializer if self.action == "create" else UserSerializer


class RoleViewSet(viewsets.ModelViewSet):
    queryset = Role.objects.all()
    serializer_class = RoleSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get_queryset(self):
        from django.db.models import Q
        hospital = getattr(self.request, "hospital", None)
        return self.queryset.filter(Q(hospital=hospital) | Q(hospital__isnull=True))

"""Auth serializers - JWT issue, user profile, password change."""
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from apps.core.serializers import HospitalSerializer
from .models import User, Role, Permission, UserRole


class HMSTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Adds hospital_id, role codes, permission codes, and basic profile to JWT + response."""

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["hospital_id"] = user.hospital_id
        token["roles"] = user.role_codes
        token["permissions"] = list(user.permission_codes)
        token["full_name"] = user.get_full_name()
        token["username"] = user.username
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        user = self.user

        # Block locked users
        if user.is_locked:
            raise serializers.ValidationError(
                {"detail": "Account is locked. Please contact administrator."}
            )

        data["user"] = {
            "id": user.id,
            "username": user.username,
            "full_name": user.get_full_name(),
            "email": user.email,
            "phone": user.phone,
            "employee_code": user.employee_code,
            "designation": user.designation,
            "must_change_password": user.must_change_password,
            "hospital": HospitalSerializer(user.hospital).data if user.hospital else None,
            "roles": user.role_codes,
            "permissions": list(user.permission_codes),
            "is_superuser": user.is_superuser,
        }
        return data


class PermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Permission
        fields = ("id", "code", "description", "module")


class RoleSerializer(serializers.ModelSerializer):
    permissions = PermissionSerializer(many=True, read_only=True)
    permission_codes = serializers.ListField(
        child=serializers.CharField(), write_only=True, required=False
    )

    class Meta:
        model = Role
        fields = ("id", "hospital", "code", "name", "description", "is_system",
                  "permissions", "permission_codes")
        read_only_fields = ("hospital", "is_system")

    def update(self, instance, validated_data):
        codes = validated_data.pop("permission_codes", None)
        instance = super().update(instance, validated_data)
        if codes is not None:
            perms = Permission.objects.filter(code__in=codes)
            instance.permissions.set(perms)
        return instance


class UserSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(source="get_full_name", read_only=True)
    roles = serializers.ListField(source="role_codes", read_only=True)
    permissions = serializers.ListField(child=serializers.CharField(), read_only=True,
                                        source="permission_codes")

    class Meta:
        model = User
        fields = ("id", "username", "email", "first_name", "last_name", "full_name",
                  "phone", "employee_code", "designation", "profile_photo",
                  "hospital", "is_active", "is_locked",
                  "must_change_password", "roles", "permissions",
                  "last_login")
        read_only_fields = ("is_active", "is_locked", "last_login", "hospital")


class CreateUserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, validators=[validate_password])
    role_codes = serializers.ListField(child=serializers.CharField(), write_only=True, required=False)

    class Meta:
        model = User
        fields = ("username", "email", "first_name", "last_name", "phone",
                  "employee_code", "designation", "password", "role_codes")

    def create(self, validated_data):
        codes = validated_data.pop("role_codes", [])
        password = validated_data.pop("password")
        request = self.context.get("request")
        hospital = getattr(request, "hospital", None)
        user = User(**validated_data, hospital=hospital, must_change_password=True)
        user.set_password(password)
        user.save()
        for code in codes:
            role = Role.objects.filter(code=code).filter(
                models_q_or_blank(hospital)
            ).first()
            if role:
                UserRole.objects.create(user=user, role=role)
        return user


def models_q_or_blank(hospital):
    """Match role for this hospital OR a global role (hospital is null)."""
    from django.db.models import Q
    return Q(hospital=hospital) | Q(hospital__isnull=True)


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True, validators=[validate_password])

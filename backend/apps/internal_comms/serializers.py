"""Internal communications serializers.

Same flat-shape + denormalized-label pattern adopted in nursing/specialist/
reception this session. Every enum has a *_label companion. Every FK has
a *_name companion. Computed fields via SerializerMethodField.
"""
from rest_framework import serializers

from .models import Message, Bulletin, BulletinAcknowledgment


# ─── Messages ────────────────────────────────────────────────────────────────

class MessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.SerializerMethodField()
    recipient_name = serializers.SerializerMethodField()
    priority_label = serializers.CharField(source="get_priority_display", read_only=True)
    is_read = serializers.BooleanField(read_only=True)
    has_replies = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = (
            "id",
            "sender", "sender_name",
            "recipient", "recipient_name",
            "subject", "body",
            "priority", "priority_label",
            "parent_message",
            "read_at", "is_read",
            "is_archived_by_sender", "is_archived_by_recipient",
            "has_replies",
            "created_at", "updated_at",
        )
        read_only_fields = ("hospital", "created_at", "updated_at",
                            "sender", "read_at")

    def get_sender_name(self, obj):
        if not obj.sender_id:
            return ""
        return obj.sender.get_full_name() or obj.sender.username

    def get_recipient_name(self, obj):
        if not obj.recipient_id:
            return ""
        return obj.recipient.get_full_name() or obj.recipient.username

    def get_has_replies(self, obj):
        return obj.replies.exists()


# ─── Bulletins ───────────────────────────────────────────────────────────────

class BulletinSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()
    audience_type_label = serializers.CharField(source="get_audience_type_display", read_only=True)
    audience_department_name = serializers.SerializerMethodField()
    audience_ward_name = serializers.SerializerMethodField()
    category_label = serializers.CharField(source="get_category_display", read_only=True)
    priority_label = serializers.CharField(source="get_priority_display", read_only=True)
    ack_count = serializers.SerializerMethodField()
    is_acknowledged_by_me = serializers.SerializerMethodField()
    is_expired = serializers.SerializerMethodField()

    class Meta:
        model = Bulletin
        fields = (
            "id", "title", "body",
            "author", "author_name",
            "category", "category_label",
            "priority", "priority_label",
            "audience_type", "audience_type_label",
            "audience_department", "audience_department_name",
            "audience_ward", "audience_ward_name",
            "requires_acknowledgment",
            "expires_at", "is_expired",
            "is_pinned",
            "ack_count", "is_acknowledged_by_me",
            "created_at", "updated_at",
        )
        read_only_fields = ("hospital", "created_at", "updated_at", "author")

    def get_author_name(self, obj):
        if not obj.author_id:
            return ""
        return obj.author.get_full_name() or obj.author.username

    def get_audience_department_name(self, obj):
        return getattr(obj.audience_department, "name", "") if obj.audience_department_id else ""

    def get_audience_ward_name(self, obj):
        return getattr(obj.audience_ward, "name", "") if obj.audience_ward_id else ""

    def get_ack_count(self, obj):
        return obj.acknowledgments.count()

    def get_is_acknowledged_by_me(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        return obj.acknowledgments.filter(user=request.user).exists()

    def get_is_expired(self, obj):
        from django.utils import timezone
        return obj.expires_at is not None and obj.expires_at < timezone.now()

    def validate(self, data):
        """Enforce: audience_type=DEPARTMENT requires audience_department,
        audience_type=WARD requires audience_ward."""
        atype = data.get("audience_type", "HOSPITAL")
        if atype == "DEPARTMENT" and not data.get("audience_department"):
            raise serializers.ValidationError({
                "audience_department": "Required when audience_type=DEPARTMENT.",
            })
        if atype == "WARD" and not data.get("audience_ward"):
            raise serializers.ValidationError({
                "audience_ward": "Required when audience_type=WARD.",
            })
        # Also clear stale FKs if audience type changes
        if atype != "DEPARTMENT":
            data["audience_department"] = None
        if atype != "WARD":
            data["audience_ward"] = None
        return data


# ─── Acknowledgments ─────────────────────────────────────────────────────────

class BulletinAcknowledgmentSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()
    bulletin_title = serializers.CharField(source="bulletin.title", read_only=True)

    class Meta:
        model = BulletinAcknowledgment
        fields = (
            "id", "bulletin", "bulletin_title",
            "user", "user_name", "note",
            "acknowledged_at",
            "created_at", "updated_at",
        )
        read_only_fields = ("hospital", "created_at", "updated_at",
                            "acknowledged_at", "user")

    def get_user_name(self, obj):
        if not obj.user_id:
            return ""
        return obj.user.get_full_name() or obj.user.username

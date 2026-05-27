"""Accounting serializers.

Same flat-shape + denormalized-label pattern.
"""
from decimal import Decimal
from rest_framework import serializers

from .models import Account, JournalEntry, JournalLine


# ─── Account ────────────────────────────────────────────────────────────────

class AccountSerializer(serializers.ModelSerializer):
    account_type_label = serializers.CharField(source="get_account_type_display", read_only=True)
    parent_code = serializers.CharField(source="parent.code", read_only=True, default="")
    parent_name = serializers.CharField(source="parent.name", read_only=True, default="")
    normal_balance = serializers.SerializerMethodField()

    class Meta:
        model = Account
        fields = (
            "id", "code", "name",
            "account_type", "account_type_label",
            "parent", "parent_code", "parent_name",
            "is_postable", "is_active",
            "description", "normal_balance",
            "created_at", "updated_at",
        )
        read_only_fields = ("hospital", "created_at", "updated_at")

    def get_normal_balance(self, obj):
        """The expected side of the account's natural balance.
        Asset/Expense → DR (debit increases). Liability/Equity/Income → CR."""
        return Account.NORMAL_BALANCE.get(obj.account_type, "DR")

    def validate(self, data):
        # Run model.clean() to catch parent-type mismatch and self-parenting
        instance = Account(**{k: v for k, v in data.items() if k != "hospital"})
        if self.instance:
            instance.id = self.instance.id
        instance.clean()
        return data


# ─── Journal Lines (nested in entry) ────────────────────────────────────────

class JournalLineSerializer(serializers.ModelSerializer):
    account_code = serializers.CharField(source="account.code", read_only=True)
    account_name = serializers.CharField(source="account.name", read_only=True)
    account_type = serializers.CharField(source="account.account_type", read_only=True)

    class Meta:
        model = JournalLine
        fields = (
            "id", "entry",
            "account", "account_code", "account_name", "account_type",
            "debit", "credit", "narration",
            "created_at", "updated_at",
        )
        read_only_fields = ("hospital", "entry", "created_at", "updated_at")

    def validate(self, data):
        debit = data.get("debit", Decimal("0"))
        credit = data.get("credit", Decimal("0"))
        if debit < 0 or credit < 0:
            raise serializers.ValidationError(
                "Debit and credit must be non-negative."
            )
        if debit and credit:
            raise serializers.ValidationError(
                "A line cannot have both a debit and a credit."
            )
        if not debit and not credit:
            raise serializers.ValidationError(
                "A line must have either a debit or a credit."
            )
        account = data.get("account") or getattr(self.instance, "account", None)
        if account and not account.is_postable:
            raise serializers.ValidationError({
                "account": f"Account {account.code} is a group account; "
                            "use a leaf account instead.",
            })
        return data


# ─── Journal Entry ──────────────────────────────────────────────────────────

class JournalEntrySerializer(serializers.ModelSerializer):
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    posted_by_name = serializers.SerializerMethodField()
    lines = JournalLineSerializer(many=True, read_only=True)
    total_debit = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    total_credit = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    is_balanced = serializers.BooleanField(read_only=True)
    line_count = serializers.SerializerMethodField()

    class Meta:
        model = JournalEntry
        fields = (
            "id", "entry_number", "entry_date",
            "narration", "reference",
            "status", "status_label",
            "posted_at", "posted_by", "posted_by_name",
            "is_locked",
            "lines", "line_count",
            "total_debit", "total_credit", "is_balanced",
            "created_at", "updated_at",
        )
        read_only_fields = ("hospital", "created_at", "updated_at",
                            "posted_at", "posted_by", "status")

    def get_posted_by_name(self, obj):
        if not obj.posted_by_id:
            return ""
        return obj.posted_by.get_full_name() or obj.posted_by.username

    def get_line_count(self, obj):
        return obj.lines.count()

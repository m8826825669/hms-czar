"""Accounting views.

Endpoint surface:

  Chart of Accounts
  -----------------
  GET    /accounting/accounts/                    list (filterable by type, postable, active)
  POST   /accounting/accounts/                    create
  GET    /accounting/accounts/{id}/               retrieve
  PATCH  /accounting/accounts/{id}/               edit (always allowed)
  DELETE /accounting/accounts/{id}/               delete (blocked if has lines)
  GET    /accounting/accounts/tree/               hierarchical chart of accounts
  GET    /accounting/accounts/{id}/ledger/        all journal lines touching this account

  Journal Entries
  ---------------
  GET    /accounting/journal-entries/             list (filterable by date range, status)
  POST   /accounting/journal-entries/             create (always as DRAFT)
  GET    /accounting/journal-entries/{id}/        retrieve with nested lines
  PATCH  /accounting/journal-entries/{id}/        edit (only if DRAFT; 409 otherwise)
  DELETE /accounting/journal-entries/{id}/        delete (only if DRAFT; 409 otherwise)
  POST   /accounting/journal-entries/{id}/post/   transition DRAFT → POSTED (validates balance)
  POST   /accounting/journal-entries/{id}/lines/  add a line to a DRAFT entry

  Reports
  -------
  GET    /accounting/reports/trial-balance/       all accounts with summed dr/cr
  GET    /accounting/reports/pl-summary/          income totals - expense totals for a period
"""
from decimal import Decimal, ROUND_HALF_UP
from datetime import date

from django.db.models import Sum, Q, F, DecimalField
from django.db.models.functions import Coalesce
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.views import TenantScopedViewSetMixin
from .models import Account, JournalEntry, JournalLine
from .serializers import (
    AccountSerializer, JournalEntrySerializer, JournalLineSerializer,
)


def _fmt(value):
    """Format a decimal to 2 places for JSON output."""
    if value is None:
        return "0.00"
    return str(Decimal(value).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


class AccountViewSet(TenantScopedViewSetMixin, viewsets.ModelViewSet):
    queryset = Account.objects.select_related("parent")
    serializer_class = AccountSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["account_type", "is_postable", "is_active", "parent"]
    search_fields = ["code", "name", "description"]
    ordering_fields = ["code", "name", "account_type"]
    ordering = ["code"]

    def destroy(self, request, *args, **kwargs):
        """Block delete if the account has any journal lines."""
        obj = self.get_object()
        if obj.lines.exists():
            return Response(
                {"detail": f"Cannot delete account {obj.code}: it has "
                            f"{obj.lines.count()} journal line(s). "
                           "Deactivate it instead (set is_active=false)."},
                status=status.HTTP_409_CONFLICT,
            )
        if obj.children.exists():
            return Response(
                {"detail": f"Cannot delete account {obj.code}: it has child "
                           "accounts. Reparent or delete children first."},
                status=status.HTTP_409_CONFLICT,
            )
        return super().destroy(request, *args, **kwargs)

    @action(detail=False, methods=["get"])
    def tree(self, request):
        """Hierarchical chart of accounts. Top-level (parent=None) first,
        then their children, recursively. Useful for the UI's tree-view."""
        all_accounts = list(self.get_queryset().filter(is_active=True))
        by_parent = {}
        for a in all_accounts:
            by_parent.setdefault(a.parent_id, []).append(a)

        def build(parent_id):
            return [
                {
                    "id": a.id,
                    "code": a.code,
                    "name": a.name,
                    "account_type": a.account_type,
                    "is_postable": a.is_postable,
                    "children": build(a.id),
                }
                for a in sorted(by_parent.get(parent_id, []), key=lambda x: x.code)
            ]

        return Response(build(None))

    @action(detail=True, methods=["get"])
    def ledger(self, request, pk=None):
        """All journal lines touching this account. Filterable by date range.
        Returns running balance (cumulative dr - cr for ASSET/EXPENSE, or
        cr - dr for the others)."""
        account = self.get_object()
        qs = JournalLine.objects.filter(
            account=account, entry__status="POSTED",
        ).select_related("entry").order_by("entry__entry_date", "entry__id", "id")

        date_from = request.query_params.get("from")
        date_to = request.query_params.get("to")
        if date_from:
            qs = qs.filter(entry__entry_date__gte=date_from)
        if date_to:
            qs = qs.filter(entry__entry_date__lte=date_to)

        sign = 1 if Account.NORMAL_BALANCE[account.account_type] == "DR" else -1

        running = Decimal("0")
        rows = []
        for line in qs:
            delta = (line.debit - line.credit) * sign
            running += delta
            rows.append({
                "line_id": line.id,
                "entry_id": line.entry_id,
                "entry_number": line.entry.entry_number,
                "entry_date": line.entry.entry_date,
                "narration": line.narration or line.entry.narration,
                "reference": line.entry.reference,
                "debit": _fmt(line.debit),
                "credit": _fmt(line.credit),
                "running_balance": _fmt(running),
            })

        return Response({
            "account": {
                "id": account.id, "code": account.code, "name": account.name,
                "account_type": account.account_type,
                "normal_balance": Account.NORMAL_BALANCE[account.account_type],
            },
            "from": date_from, "to": date_to,
            "line_count": len(rows),
            "closing_balance": _fmt(running),
            "lines": rows,
        })


class JournalEntryViewSet(TenantScopedViewSetMixin, viewsets.ModelViewSet):
    queryset = JournalEntry.objects.select_related("posted_by").prefetch_related(
        "lines__account",
    )
    serializer_class = JournalEntrySerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["status", "is_locked"]
    search_fields = ["entry_number", "narration", "reference"]
    ordering_fields = ["entry_date", "created_at"]
    ordering = ["-entry_date", "-id"]

    def get_queryset(self):
        qs = super().get_queryset()
        # Optional date-range filter (?from=YYYY-MM-DD&to=YYYY-MM-DD)
        date_from = self.request.query_params.get("from")
        date_to = self.request.query_params.get("to")
        if date_from:
            qs = qs.filter(entry_date__gte=date_from)
        if date_to:
            qs = qs.filter(entry_date__lte=date_to)
        return qs

    def update(self, request, *args, **kwargs):
        obj = self.get_object()
        if obj.status == "POSTED":
            return Response(
                {"detail": "Cannot edit a POSTED entry. Create a reversing "
                           "entry instead."},
                status=status.HTTP_409_CONFLICT,
            )
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        obj = self.get_object()
        if obj.status == "POSTED":
            return Response(
                {"detail": "Cannot delete a POSTED entry. Create a reversing "
                           "entry instead."},
                status=status.HTTP_409_CONFLICT,
            )
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=["post"])
    def post(self, request, pk=None):
        """Transition DRAFT → POSTED. Validates balance, records who/when."""
        entry = self.get_object()
        try:
            entry.post(user=request.user)
        except Exception as e:
            return Response(
                {"detail": str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(self.get_serializer(entry).data)

    @action(detail=True, methods=["post"], url_path="lines")
    def add_line(self, request, pk=None):
        """Add a line to a DRAFT entry.

        Body: { account, debit?, credit?, narration? }

        Validates that exactly one of debit/credit is provided and that the
        account is postable. Returns the new line.
        """
        entry = self.get_object()
        if entry.status == "POSTED":
            return Response(
                {"detail": "Cannot add lines to a POSTED entry."},
                status=status.HTTP_409_CONFLICT,
            )
        ser = JournalLineSerializer(data=request.data, context={"request": request})
        ser.is_valid(raise_exception=True)
        line = JournalLine.objects.create(
            hospital=request.hospital,
            created_by=request.user,
            entry=entry,
            **ser.validated_data,
        )
        return Response(
            JournalLineSerializer(line).data,
            status=status.HTTP_201_CREATED,
        )


# ─── Reports ────────────────────────────────────────────────────────────────

class TrialBalanceView(APIView):
    """Sum debits and credits per account from POSTED entries only.

    Query params:
      from   YYYY-MM-DD   (optional) start date inclusive
      to     YYYY-MM-DD   (optional) end date inclusive

    Returns:
      {
        "from": ..., "to": ...,
        "accounts": [
          { "id", "code", "name", "account_type", "debit_total",
            "credit_total", "balance" },
          ...
        ],
        "totals": { "debit_total", "credit_total", "is_balanced" }
      }
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        hospital = request.hospital
        date_from = request.query_params.get("from")
        date_to = request.query_params.get("to")

        line_qs = JournalLine.objects.filter(
            hospital=hospital, entry__status="POSTED",
        )
        if date_from:
            line_qs = line_qs.filter(entry__entry_date__gte=date_from)
        if date_to:
            line_qs = line_qs.filter(entry__entry_date__lte=date_to)

        sums = line_qs.values("account_id").annotate(
            debit_total=Coalesce(Sum("debit"), Decimal("0"),
                                  output_field=DecimalField(max_digits=14, decimal_places=2)),
            credit_total=Coalesce(Sum("credit"), Decimal("0"),
                                   output_field=DecimalField(max_digits=14, decimal_places=2)),
        )
        sums_by_id = {s["account_id"]: s for s in sums}

        accounts = Account.objects.filter(
            hospital=hospital, id__in=sums_by_id.keys(),
        ).order_by("code")

        rows = []
        total_dr = total_cr = Decimal("0")
        for acc in accounts:
            s = sums_by_id[acc.id]
            dr = s["debit_total"]
            cr = s["credit_total"]
            total_dr += dr
            total_cr += cr
            # Balance: for DR-natural accounts (asset/expense), positive = dr - cr
            #          for CR-natural, positive = cr - dr
            if Account.NORMAL_BALANCE[acc.account_type] == "DR":
                balance = dr - cr
            else:
                balance = cr - dr
            rows.append({
                "id": acc.id,
                "code": acc.code,
                "name": acc.name,
                "account_type": acc.account_type,
                "debit_total": _fmt(dr),
                "credit_total": _fmt(cr),
                "balance": _fmt(balance),
            })

        return Response({
            "from": date_from, "to": date_to,
            "accounts": rows,
            "totals": {
                "debit_total": _fmt(total_dr),
                "credit_total": _fmt(total_cr),
                "is_balanced": total_dr == total_cr,
            },
        })


class ProfitLossSummaryView(APIView):
    """Income totals minus expense totals for a period.

    Query params: from, to (both YYYY-MM-DD, optional)

    Returns total income, total expense, net profit/loss, and breakdown by
    account. Only POSTED entries are counted.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        hospital = request.hospital
        date_from = request.query_params.get("from")
        date_to = request.query_params.get("to")

        line_qs = JournalLine.objects.filter(
            hospital=hospital,
            entry__status="POSTED",
            account__account_type__in=["INCOME", "EXPENSE"],
        ).select_related("account")
        if date_from:
            line_qs = line_qs.filter(entry__entry_date__gte=date_from)
        if date_to:
            line_qs = line_qs.filter(entry__entry_date__lte=date_to)

        sums = line_qs.values(
            "account_id", "account__code", "account__name", "account__account_type",
        ).annotate(
            debit_total=Coalesce(Sum("debit"), Decimal("0"),
                                  output_field=DecimalField(max_digits=14, decimal_places=2)),
            credit_total=Coalesce(Sum("credit"), Decimal("0"),
                                   output_field=DecimalField(max_digits=14, decimal_places=2)),
        ).order_by("account__code")

        income = []
        expense = []
        total_income = total_expense = Decimal("0")
        for s in sums:
            # Income: normal balance is CR, so amount = cr - dr
            # Expense: normal balance is DR, so amount = dr - cr
            if s["account__account_type"] == "INCOME":
                amt = s["credit_total"] - s["debit_total"]
                income.append({
                    "code": s["account__code"], "name": s["account__name"],
                    "amount": _fmt(amt),
                })
                total_income += amt
            else:
                amt = s["debit_total"] - s["credit_total"]
                expense.append({
                    "code": s["account__code"], "name": s["account__name"],
                    "amount": _fmt(amt),
                })
                total_expense += amt

        return Response({
            "from": date_from, "to": date_to,
            "income": income,
            "expense": expense,
            "total_income": _fmt(total_income),
            "total_expense": _fmt(total_expense),
            "net": _fmt(total_income - total_expense),
        })

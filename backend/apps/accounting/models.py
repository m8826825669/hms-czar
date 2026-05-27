"""Accounting — lite implementation of double-entry bookkeeping.

Scope: minimum viable to feed Tally / QuickBooks for GST returns and
produce a basic Trial Balance + P&L summary.

Three models:

  Account          — Chart of accounts. Hierarchical via parent FK.
                      Types: ASSET / LIABILITY / EQUITY / INCOME / EXPENSE.

  JournalEntry     — A balanced voucher (a single accounting transaction).
                      DRAFT entries are editable; POSTED entries are
                      immutable. A POSTED entry's lines must balance.

  JournalLine      — One side of an entry. (account, debit, credit) where
                      exactly one of debit/credit is > 0.

Design decisions:
  * Double-entry, no shortcuts. Posting requires Σdebits = Σcredits.
  * DRAFT/POSTED status. Once POSTED, the entry cannot be edited or deleted.
    Corrections require a reversing entry (standard practice).
  * Account codes are user-defined (Indian standard: 1xxx assets, 2xxx
    liabilities, 3xxx equity, 4xxx income, 5xxx expense). Seed creates a
    starter chart.
  * No auto-posting from billing/pharmacy. Accountant manually enters
    daily summaries, or future hooks can post programmatically.
  * No depreciation, no FX, no fiscal-year locking, no budgets.
"""
from decimal import Decimal
from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models, transaction

from apps.core.models import TenantBaseModel


# ─── Chart of Accounts ──────────────────────────────────────────────────────

class Account(TenantBaseModel):
    """A node in the chart of accounts.

    Hierarchy: parent → children. A "group" account holds child accounts
    but cannot be posted to directly (is_postable=False). A "leaf" account
    receives journal lines (is_postable=True).

    Standard 4-digit numbering (Indian convention):
      1xxx — Assets (Cash, Bank, AR, Inventory, Fixed Assets)
      2xxx — Liabilities (AP, GST Payable, Loans)
      3xxx — Equity (Capital, Retained Earnings)
      4xxx — Income (OPD Revenue, IPD Revenue, Pharmacy Sales)
      5xxx — Expense (Salaries, Rent, Utilities, COGS)
    """
    TYPES = [
        ("ASSET",     "Asset"),
        ("LIABILITY", "Liability"),
        ("EQUITY",    "Equity"),
        ("INCOME",    "Income"),
        ("EXPENSE",   "Expense"),
    ]

    # Normal balance per account type — debits increase ASSET/EXPENSE,
    # credits increase LIABILITY/EQUITY/INCOME
    NORMAL_BALANCE = {
        "ASSET":     "DR",
        "LIABILITY": "CR",
        "EQUITY":    "CR",
        "INCOME":    "CR",
        "EXPENSE":   "DR",
    }

    code = models.CharField(max_length=20,
        help_text="Account code (e.g. '1000', '4100-OPD'). Unique per hospital.")
    name = models.CharField(max_length=120)
    account_type = models.CharField(max_length=10, choices=TYPES, db_index=True)

    parent = models.ForeignKey(
        "self", on_delete=models.PROTECT, null=True, blank=True,
        related_name="children",
        help_text="Parent group account, if this is a sub-account.",
    )

    is_postable = models.BooleanField(default=True,
        help_text="False = group/header account; True = leaf that takes journal lines.")
    is_active = models.BooleanField(default=True, db_index=True)
    description = models.CharField(max_length=300, blank=True, default="")

    class Meta:
        ordering = ["code"]
        unique_together = [("hospital", "code")]
        indexes = [
            models.Index(fields=["account_type", "code"]),
            models.Index(fields=["parent", "code"]),
        ]

    def __str__(self):
        return f"{self.code} — {self.name}"

    def clean(self):
        # A non-postable account can't be a parent's own type-mismatch
        if self.parent and self.parent.account_type != self.account_type:
            raise ValidationError({
                "parent": "Parent account must be of the same type "
                          f"({self.get_account_type_display()}).",
            })
        # Prevent self-parenting
        if self.parent_id and self.parent_id == self.id:
            raise ValidationError({"parent": "Account cannot be its own parent."})


# ─── Journal Entries (Vouchers) ─────────────────────────────────────────────

class JournalEntry(TenantBaseModel):
    """A balanced double-entry transaction.

    Status:
      DRAFT  — editable, deletable, doesn't appear in trial balance
      POSTED — immutable (raises 405 on PUT/DELETE), counts in reports

    Posting is a two-step process:
      1. Create the entry as DRAFT
      2. Add JournalLines (at least 2, balanced)
      3. POST /journal-entries/{id}/post/ — validates balance, flips status

    Once POSTED, corrections require a reversing entry (standard accounting
    practice). Don't try to "edit" a posted entry.
    """
    STATUSES = [
        ("DRAFT",  "Draft"),
        ("POSTED", "Posted"),
    ]

    entry_number = models.CharField(max_length=30,
        help_text="Human-readable voucher number (e.g. 'JV-2026-0001').")
    entry_date = models.DateField(db_index=True,
        help_text="Date of the transaction (not the system time).")
    narration = models.TextField(
        help_text="What this entry is for (visible in reports).")
    reference = models.CharField(max_length=80, blank=True, default="",
        help_text="External reference: invoice no, cheque no, etc.")

    status = models.CharField(max_length=8, choices=STATUSES,
                               default="DRAFT", db_index=True)

    # Audit
    posted_at = models.DateTimeField(null=True, blank=True,
        help_text="When the entry was POSTED. Null = still DRAFT.")
    posted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
        null=True, blank=True, related_name="journal_entries_posted",
    )

    is_locked = models.BooleanField(default=False, db_index=True,
        help_text="Set to True when the fiscal period is closed. Posted "
                  "entries inside a locked period cannot be reversed.")

    class Meta:
        ordering = ["-entry_date", "-id"]
        unique_together = [("hospital", "entry_number")]
        indexes = [
            models.Index(fields=["status", "-entry_date"]),
            models.Index(fields=["-entry_date", "-id"]),
        ]
        verbose_name_plural = "Journal entries"

    def __str__(self):
        return f"{self.entry_number} ({self.entry_date}) — {self.narration[:40]}"

    # ─── Balance helpers ────────────────────────────────────────────────────
    @property
    def total_debit(self):
        return sum((l.debit for l in self.lines.all()), Decimal("0"))

    @property
    def total_credit(self):
        return sum((l.credit for l in self.lines.all()), Decimal("0"))

    @property
    def is_balanced(self):
        return self.total_debit == self.total_credit and self.total_debit > 0

    def post(self, user):
        """Transition DRAFT → POSTED. Validates balance. Records who/when."""
        if self.status == "POSTED":
            raise ValidationError("Entry is already posted.")
        if self.lines.count() < 2:
            raise ValidationError("Entry must have at least 2 lines.")
        if not self.is_balanced:
            raise ValidationError(
                f"Entry is unbalanced: debits={self.total_debit}, "
                f"credits={self.total_credit}. Cannot post."
            )
        from django.utils import timezone
        self.status = "POSTED"
        self.posted_at = timezone.now()
        self.posted_by = user
        self.save(update_fields=["status", "posted_at", "posted_by", "updated_at"])


class JournalLine(TenantBaseModel):
    """One side of a journal entry.

    Invariant: exactly one of (debit, credit) is > 0; the other is 0.
    Enforced in clean().
    """
    entry = models.ForeignKey(
        JournalEntry, on_delete=models.CASCADE, related_name="lines",
    )
    account = models.ForeignKey(
        Account, on_delete=models.PROTECT, related_name="lines",
    )
    debit = models.DecimalField(max_digits=14, decimal_places=2,
                                  default=Decimal("0"))
    credit = models.DecimalField(max_digits=14, decimal_places=2,
                                   default=Decimal("0"))
    narration = models.CharField(max_length=200, blank=True, default="",
        help_text="Optional line-level narration (overrides entry narration in reports).")

    class Meta:
        ordering = ["entry", "id"]
        indexes = [
            models.Index(fields=["account", "entry"]),
            models.Index(fields=["entry"]),
        ]

    def __str__(self):
        side = f"Dr {self.debit}" if self.debit else f"Cr {self.credit}"
        return f"{self.entry.entry_number}: {self.account.code} {side}"

    def clean(self):
        if self.debit < 0 or self.credit < 0:
            raise ValidationError("Debit and credit must be non-negative.")
        if self.debit and self.credit:
            raise ValidationError(
                "A journal line cannot have both debit and credit. Use one."
            )
        if not self.debit and not self.credit:
            raise ValidationError(
                "A journal line must have either a debit or a credit."
            )
        if self.account_id and not self.account.is_postable:
            raise ValidationError({
                "account": f"Account {self.account.code} is a group account; "
                            "use a child leaf account instead.",
            })

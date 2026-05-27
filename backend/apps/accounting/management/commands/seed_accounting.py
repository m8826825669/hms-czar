"""Seed accounting with a starter chart of accounts and a few demo entries.

Run:    python manage.py seed_accounting

Creates:
  - 5 top-level group accounts (Assets, Liabilities, Equity, Income, Expense)
  - ~18 leaf accounts under them (standard Indian hospital chart)
  - 3 demo journal entries (one DRAFT, two POSTED) showing balanced double-entry

Flags:
  --hospital CODE   Use a specific hospital code
"""
from datetime import date, timedelta
from decimal import Decimal

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from apps.core.models import Hospital


# Standard Indian-style chart of accounts for a hospital
# Structure: (code, name, account_type, parent_code, is_postable)
CHART = [
    # ── Assets ────────────────────────────────────────────────────────
    ("1000", "Assets",                 "ASSET",     None,    False),
    ("1100", "Current Assets",         "ASSET",     "1000",  False),
    ("1110", "Cash on Hand",           "ASSET",     "1100",  True),
    ("1120", "Bank Account - Current", "ASSET",     "1100",  True),
    ("1130", "Bank Account - Savings", "ASSET",     "1100",  True),
    ("1140", "Accounts Receivable",    "ASSET",     "1100",  True),
    ("1150", "Pharmacy Inventory",     "ASSET",     "1100",  True),
    ("1200", "Fixed Assets",           "ASSET",     "1000",  False),
    ("1210", "Medical Equipment",      "ASSET",     "1200",  True),
    ("1220", "Furniture & Fixtures",   "ASSET",     "1200",  True),

    # ── Liabilities ───────────────────────────────────────────────────
    ("2000", "Liabilities",            "LIABILITY", None,    False),
    ("2100", "Current Liabilities",    "LIABILITY", "2000",  False),
    ("2110", "Accounts Payable",       "LIABILITY", "2100",  True),
    ("2120", "GST Payable",            "LIABILITY", "2100",  True),
    ("2130", "TDS Payable",            "LIABILITY", "2100",  True),
    ("2140", "Salaries Payable",       "LIABILITY", "2100",  True),

    # ── Equity ────────────────────────────────────────────────────────
    ("3000", "Equity",                 "EQUITY",    None,    False),
    ("3100", "Owner's Capital",        "EQUITY",    "3000",  True),
    ("3200", "Retained Earnings",      "EQUITY",    "3000",  True),

    # ── Income ────────────────────────────────────────────────────────
    ("4000", "Income",                 "INCOME",    None,    False),
    ("4100", "OPD Revenue",            "INCOME",    "4000",  True),
    ("4200", "IPD Revenue",            "INCOME",    "4000",  True),
    ("4300", "Pharmacy Sales",         "INCOME",    "4000",  True),
    ("4400", "Lab Services",           "INCOME",    "4000",  True),
    ("4500", "Other Income",           "INCOME",    "4000",  True),

    # ── Expense ───────────────────────────────────────────────────────
    ("5000", "Expenses",               "EXPENSE",   None,    False),
    ("5100", "Salaries & Wages",       "EXPENSE",   "5000",  True),
    ("5200", "Rent",                   "EXPENSE",   "5000",  True),
    ("5300", "Utilities",              "EXPENSE",   "5000",  True),
    ("5400", "Medical Supplies",       "EXPENSE",   "5000",  True),
    ("5500", "Pharmacy COGS",          "EXPENSE",   "5000",  True),
    ("5600", "Office & Admin",         "EXPENSE",   "5000",  True),
]


class Command(BaseCommand):
    help = "Seed accounting with starter chart + demo journal entries."

    def add_arguments(self, parser):
        parser.add_argument("--hospital", type=str, default=None)

    def handle(self, *args, **opts):
        from apps.accounts.models import User
        from apps.accounting.models import Account, JournalEntry, JournalLine

        code = opts["hospital"] or getattr(settings, "HMS_DEFAULT_HOSPITAL_CODE", "HOSP001")
        try:
            hospital = Hospital.objects.get(code=code)
        except Hospital.DoesNotExist:
            raise CommandError(f"Hospital with code {code!r} not found.")

        user = User.objects.filter(hospital=hospital, is_active=True).first()
        if not user:
            raise CommandError(
                f"Need at least 1 active user in {code} to seed accounting."
            )

        accounts_made = entries_made = 0

        # ─── Chart of Accounts ──────────────────────────────────────────────
        # Pass 1: create all accounts without parents
        by_code = {}
        for acode, aname, atype, _parent_code, postable in CHART:
            obj, created = Account.objects.get_or_create(
                hospital=hospital, code=acode,
                defaults={
                    "created_by": user,
                    "name": aname, "account_type": atype,
                    "is_postable": postable, "is_active": True,
                },
            )
            by_code[acode] = obj
            if created:
                accounts_made += 1

        # Pass 2: wire up parent FKs
        for acode, _aname, _atype, parent_code, _postable in CHART:
            if parent_code is None:
                continue
            child = by_code[acode]
            parent = by_code[parent_code]
            if child.parent_id != parent.id:
                child.parent = parent
                child.save(update_fields=["parent", "updated_at"])

        # ─── Demo Journal Entries ───────────────────────────────────────────
        today = date.today()

        # Entry 1 — POSTED — OPD collection summary for yesterday
        if not JournalEntry.objects.filter(
            hospital=hospital, entry_number="JV-DEMO-001",
        ).exists():
            e = JournalEntry.objects.create(
                hospital=hospital, created_by=user,
                entry_number="JV-DEMO-001",
                entry_date=today - timedelta(days=1),
                narration="OPD collection summary - cash deposits",
                reference="OPD-DAILY-001",
            )
            JournalLine.objects.create(
                hospital=hospital, created_by=user, entry=e,
                account=by_code["1110"],  # Cash on Hand
                debit=Decimal("25000.00"), credit=Decimal("0"),
                narration="OPD cash collection",
            )
            JournalLine.objects.create(
                hospital=hospital, created_by=user, entry=e,
                account=by_code["4100"],  # OPD Revenue
                debit=Decimal("0"), credit=Decimal("25000.00"),
                narration="OPD consultation fees",
            )
            e.post(user=user)
            entries_made += 1

        # Entry 2 — POSTED — Pharmacy sale (cash + GST liability)
        if not JournalEntry.objects.filter(
            hospital=hospital, entry_number="JV-DEMO-002",
        ).exists():
            e = JournalEntry.objects.create(
                hospital=hospital, created_by=user,
                entry_number="JV-DEMO-002",
                entry_date=today,
                narration="Pharmacy counter sales (incl. GST)",
                reference="PHRM-DAILY-001",
            )
            JournalLine.objects.create(
                hospital=hospital, created_by=user, entry=e,
                account=by_code["1110"],  # Cash on Hand
                debit=Decimal("11800.00"), credit=Decimal("0"),
            )
            JournalLine.objects.create(
                hospital=hospital, created_by=user, entry=e,
                account=by_code["4300"],  # Pharmacy Sales
                debit=Decimal("0"), credit=Decimal("10000.00"),
                narration="Sale value (excl. GST)",
            )
            JournalLine.objects.create(
                hospital=hospital, created_by=user, entry=e,
                account=by_code["2120"],  # GST Payable
                debit=Decimal("0"), credit=Decimal("1800.00"),
                narration="GST 18% on pharmacy sales",
            )
            e.post(user=user)
            entries_made += 1

        # Entry 3 — DRAFT — Salary payment (still being prepared)
        if not JournalEntry.objects.filter(
            hospital=hospital, entry_number="JV-DEMO-003",
        ).exists():
            e = JournalEntry.objects.create(
                hospital=hospital, created_by=user,
                entry_number="JV-DEMO-003",
                entry_date=today,
                narration="Monthly salary payment (DRAFT - pending review)",
                reference="PAYROLL-2026-05",
            )
            JournalLine.objects.create(
                hospital=hospital, created_by=user, entry=e,
                account=by_code["5100"],  # Salaries & Wages
                debit=Decimal("180000.00"), credit=Decimal("0"),
                narration="Gross salaries for month",
            )
            JournalLine.objects.create(
                hospital=hospital, created_by=user, entry=e,
                account=by_code["2130"],  # TDS Payable
                debit=Decimal("0"), credit=Decimal("18000.00"),
                narration="TDS deducted",
            )
            JournalLine.objects.create(
                hospital=hospital, created_by=user, entry=e,
                account=by_code["1120"],  # Bank - Current
                debit=Decimal("0"), credit=Decimal("162000.00"),
                narration="Net pay via bank transfer",
            )
            # Leave as DRAFT — accountant must review and post
            entries_made += 1

        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS(
            f"Done. Created {accounts_made} account(s), {entries_made} entry(s) "
            f"in hospital {code}."
        ))
        self.stdout.write(
            "Try: GET /api/v1/accounting/reports/trial-balance/  (2 posted entries)"
        )
        self.stdout.write(
            "Try: GET /api/v1/accounting/reports/pl-summary/      (revenue - expenses)"
        )

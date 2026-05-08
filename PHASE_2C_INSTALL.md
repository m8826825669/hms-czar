# Phase 2c — IPD + GST Reports + Doctor Dashboard

This phase completes Phase 2 of the HMS build. It adds:

1. **IPD module** (`apps/ipd`) — Ward / Room / Bed hierarchy with bed status
   tracking, Admission lifecycle (admit → daily charge accrual → transfer →
   discharge → summary + PDF), automatic invoice generation on discharge that
   rolls up bed rent + nursing + admission services + pharmacy + lab.
2. **GSTR-1 + GSTR-3B reports** (`apps/billing/services/gst_reports.py`) —
   monthly outward supply summaries with B2CS / B2CL / HSN breakdowns and a
   4-sheet Excel workbook export for filing.
3. **Doctor dashboard** (`apps/specialist/dashboard_views.py`) — daily standup
   view aggregating today's appointments, pending consultations, lab orders
   awaiting review, active IPD patients, and recent prescriptions for the
   logged-in doctor.

---

## What's in the zip

```
backend/
  apps/ipd/                                    ← NEW APP
    __init__.py, apps.py, admin.py
    models.py                                  ← Ward/Room/Bed/Admission/DailyCharge/AdmissionService/DischargeSummary
    serializers.py
    views.py                                   ← + bed availability, transfer, discharge actions
    urls.py
    services/
      __init__.py
      admission_service.py                     ← admit, transfer, accrue, discharge, summary upsert
      discharge_pdf.py                         ← ReportLab discharge summary PDF
    management/commands/
      seed_phase2c_ipd.py                      ← 6 wards / 16 rooms / 40 beds
    migrations/__init__.py

  apps/billing/                                ← UPDATED (additive)
    services/gst_reports.py                    ← NEW (GSTR-1, GSTR-3B, Excel workbook)
    gst_views.py                               ← NEW (3 endpoints)
    urls.py                                    ← UPDATED (drop-in: + gst routes)

  apps/specialist/                             ← UPDATED (additive)
    dashboard_views.py                         ← NEW
    urls.py                                    ← UPDATED (drop-in: + dashboard/today)

  config/urls.py                               ← UPDATED (drop-in: + /api/ipd/)

frontend/src/
  types/ipd.ts                                 ← NEW
  lib/api/
    ipd.ts                                     ← NEW
    reports.ts                                 ← NEW (GSTR + doctor dashboard)
  app/dashboard/
    ipd/
      page.tsx                                 ← IPD dashboard
      beds/page.tsx                            ← Visual bed board
      admissions/new/page.tsx                  ← New admission form
      admissions/[id]/page.tsx                 ← Admission detail (workflow centre)
    billing/gst/page.tsx                       ← GSTR-1 / GSTR-3B reports
    doctor/page.tsx                            ← Doctor daily standup

PHASE_2C_INSTALL.md                            ← this file
```

---

## Installation

### 1. Extract the zip

```powershell
cd D:\hms_phase0\hms

# Backup the files we replace
copy backend\apps\billing\urls.py backend\apps\billing\urls.py.phase2b.bak
copy backend\apps\specialist\urls.py backend\apps\specialist\urls.py.phase2b.bak
copy backend\config\urls.py backend\config\urls.py.phase2b.bak

# Extract — overwrite when prompted
Expand-Archive .\hms_phase2c.zip -DestinationPath . -Force
```

> **Note:** The `urls.py` files in this zip are full drop-in replacements that
> preserve all Phase 1a/1b/1c/2a/2b routes and add the Phase 2c routes. The
> `dashboard_views.py` and `services/gst_reports.py` files are entirely new.

### 2. Install `openpyxl` for Excel export

```powershell
.\venv\Scripts\Activate.ps1
pip install openpyxl
```

(Add `openpyxl>=3.1` to your `requirements.txt`.)

### 3. Add the new app to `INSTALLED_APPS`

In `backend/config/settings/base.py`:

```python
INSTALLED_APPS = [
    # ... existing apps (Phase 1 + 2a + 2b)
    "apps.ipd",   # ← Phase 2c
]
```

> Make sure `apps.accounts`, `apps.core`, `apps.specialist`, `apps.billing`,
> `apps.pharmacy`, and `apps.lab` all appear **before** `apps.ipd` in the list
> (the IPD admission_service imports from billing, pharmacy, and lab).

### 4. Make and apply migrations

```powershell
cd backend
python manage.py makemigrations ipd
python manage.py migrate
```

You should see migrations create `Ward`, `Room`, `Bed`, `Admission`,
`DailyCharge`, `AdmissionService`, and `DischargeSummary`.

### 5. Seed wards/rooms/beds

```powershell
python manage.py seed_phase2c_ipd
# or, to wipe existing IPD data and reseed:
python manage.py seed_phase2c_ipd --reset
```

This creates **6 wards / 16 rooms / 40 beds**:

| Ward | Type | Floor | Rate (per day) | GST | Beds |
|---|---|---|---|---|---|
| GEN | General | Ground | ₹500 | 0% | 12 (3 rooms × 4) |
| SEMI | Semi-Private | 1st | ₹1,200 | 0% | 8 (4 rooms × 2) |
| PRIV | Private | 2nd | ₹2,500 | 5% | 4 (4 rooms × 1) |
| ICU | ICU | 1st | ₹4,000 | 5% | 6 (1 room × 6) |
| MAT | Maternity | Ground | ₹1,500 | 5% | 4 (2 rooms × 2) |
| PAED | Paediatric | Ground | ₹600 | 0% | 6 (2 rooms × 3) |

### 6. Restart Daphne (or runserver)

```powershell
daphne -b 127.0.0.1 -p 8000 config.asgi:application
```

### 7. Frontend — wire up the sidebar

If you have a sidebar component, add these three links:

```tsx
// In your sidebar nav config:
{ href: "/dashboard/doctor",     label: "My Day (Doctor)", icon: Stethoscope },
{ href: "/dashboard/ipd",        label: "IPD",             icon: BedDouble },
{ href: "/dashboard/billing/gst", label: "GST Reports",    icon: FileSpreadsheet },
```

### 8. Restart the Next.js dev server

```powershell
cd frontend
npm run dev
```

---

## End-to-end smoke tests

### Scenario A — Visualise the bed board

1. Login as `aslam` / `Password@123`.
2. Navigate to `/dashboard/ipd` — you'll see 5 stat cards (Total Beds: 40,
   Occupied: 0, Available: 40, Reserved: 0, Today's Admissions: 0) and a
   coloured occupancy bar that's all emerald (everything available).
3. Click "View Bed Board" / navigate to `/dashboard/ipd/beds`. You'll see all
   40 beds grouped by ward in a coloured grid.
4. On any AVAILABLE bed click "Reserve" — the bed turns amber. Click "Free" —
   it turns back to emerald.

### Scenario B — Admit a patient

5. From `/dashboard/ipd` click "+ New Admission" (or go to
   `/dashboard/ipd/admissions/new`).
6. Search for a patient (e.g. "John") and select them.
7. Pick an available bed (e.g. ICU-A, Bed A — ₹4,000/day).
8. Set Attending Doctor to `Dr. shahid` and admission_type EMERGENCY.
9. Fill in admission diagnosis "Acute MI", chief complaint "Chest pain x 2 hr".
10. Click "Admit Patient" → you're redirected to the admission detail page.
    Status: **ADMITTED**. The bed turns blue on the bed board.

### Scenario C — Daily charges accrual (idempotent)

11. On the admission detail, scroll to "Daily Charges" → you'll see one row
    for today (₹4,000 bed + ₹0 nursing + 5% GST = ₹4,200).
12. Click "Refresh Charges" again — no duplicate row is created (idempotent).
13. To simulate a multi-day stay, run from Django shell:
    ```powershell
    python manage.py shell
    >>> from apps.ipd.models import Admission
    >>> from apps.ipd.services.admission_service import accrue_daily_charges
    >>> from datetime import date, timedelta
    >>> a = Admission.objects.last()
    >>> accrue_daily_charges(a, up_to=date.today() + timedelta(days=4))
    ```
    Refresh — you'll see 5 daily charge rows.

### Scenario D — Bed transfer

14. In the right sidebar's "Bed" card, click "Transfer to another bed".
15. Pick a different ward (e.g. SEMI Block B, Room 201, Bed A — ₹1,200/day).
16. Reason: "Patient stable, downgraded from ICU".
17. Click "Transfer". The Bed card now shows the new bed; the old ICU bed is
    free; the locked daily rate updates from ₹4,000 to ₹1,200 going forward
    (existing daily charges are kept at the rate they were accrued at).

### Scenario E — Add admission services

18. Use the "Add Service Charge" form to add: "Doctor visit", ₹500, qty 2,
    GST 0%. The service is added with total ₹1,000.
19. Add another: "ECG", ₹300, qty 1, GST 5%. Total ₹315.
20. Both rows appear in "Services". Sidebar's "Accrued Total" updates live.

### Scenario F — Edit & finalize discharge summary

21. Scroll to "Discharge Summary" (collapsed by default). Click to expand.
22. Final Diagnosis is pre-populated from admission_diagnosis.
23. Fill in Course in Hospital ("Patient managed conservatively..."), Procedures
    Done ("Coronary angiography"), Treatment ("Aspirin, Clopidogrel..."),
    Condition at Discharge ("Stable"), Medications, Advice, Follow-up.
24. Click "Save Draft" — the editor remains editable; status badge shows
    "Draft".
25. Click "Finalize & Lock" — the editor becomes read-only; badge shows
    "Finalized". (Note: requires final_diagnosis + course_in_hospital both
    filled.)

### Scenario G — Discharge with auto-invoice

26. Click "Discharge Patient →" on the blue panel.
27. In the modal, leave default settings (ROUTINE + include pharmacy +
    include lab). Click "Confirm Discharge".
28. Status changes to **DISCHARGED**. A green "Discharged" panel appears
    showing the linked invoice code (`INV-...`).
29. Click the invoice — open the billing detail page. The invoice has line
    items for: aggregated Bed Rent, aggregated Nursing, aggregated Other (if
    any), each Admission Service line, plus any unbilled pharmacy orders and
    lab orders that fell within the stay window.
30. The bed is now AVAILABLE again on the bed board.
31. Back on the admission, click "📄 Download Discharge Summary" — a
    multi-section PDF opens with patient demographics, the highlighted Final
    Diagnosis (amber background), and all summary fields filled in.

### Scenario H — Doctor daily standup

32. Logout, login as `drshahid` / `Password@123`.
33. Navigate to `/dashboard/doctor`.
34. You'll see 5 count cards across the top, then sections for: Today's
    Appointments, Pending Consultations, Lab Orders to Review, Active IPD
    Patients (the just-discharged patient is no longer here), Recent
    Prescriptions (last 7 days).
35. Each section's table is clickable — codes link to the relevant detail
    page. The page auto-refreshes every 60 seconds.

### Scenario I — GSTR-1 / GSTR-3B reports

36. Login back as `aslam`. Navigate to `/dashboard/billing/gst`.
37. The current month is selected by default. The black header strip shows
    your hospital's GSTIN and the filing period.
38. **GSTR-1 tab** displays: Period Totals (Taxable Value / CGST / SGST / IGST
    / Total Tax / Grand Total), Document Summary (issued / cancelled /
    refunds), B2CS table (state + rate aggregation), B2CL table (inter-state
    >₹2.5L per-invoice — usually empty for hospital workflows), HSN Summary
    (HSN/SAC code + rate aggregation with quantities).
39. **GSTR-3B tab** displays: Section 3.1 with five sub-rows ((a)-(e)) for
    nature of supplies, Section 4 ITC placeholder, Section 6.1 Tax Payable
    summary (CGST / SGST / IGST / Total).
40. Click "📊 Download Excel Workbook" — saves
    `gstr_<gstin>_<YYYY-MM>.xlsx` with 4 sheets: Summary, GSTR-1 B2CS,
    GSTR-1 HSN, GSTR-3B. The Summary sheet has bold white headers on the
    HMS primary navy (#0c4a6e) background.

---

## Troubleshooting

### `ModuleNotFoundError: openpyxl`

The Excel export endpoint requires openpyxl. Install it inside your venv:
```powershell
.\venv\Scripts\Activate.ps1
pip install openpyxl
```

### "Hospital model has no field 'gstin'"

The GST report builders read `hospital.gstin`. If your `Hospital` model
doesn't have this field yet, add it:
```python
# apps/core/models.py — Hospital
gstin = models.CharField(max_length=15, blank=True, default="")
state_code = models.CharField(max_length=2, blank=True, default="09")  # UP default
```
Then `makemigrations core` + `migrate`. Set the GSTIN in admin or via shell:
```python
>>> from apps.core.models import Hospital
>>> h = Hospital.objects.first()
>>> h.gstin = "09AABCT1234E1Z5"  # 15-char placeholder GSTIN
>>> h.state_code = "09"  # UP
>>> h.save()
```

### Doctor dashboard returns 404 / "Doctor not found for this user"

The endpoint resolves the doctor by `request.user → Doctor.user`. If the
logged-in user has no `Doctor` row, you'll get a 404. Either:
- Ensure each doctor user (e.g. `drshahid`) has a corresponding `Doctor`
  record (the seed scripts do this), or
- Pass `?doctor_id=<id>` as a SUPER_ADMIN to view another doctor's dashboard.

### Admission code race condition under load

`Admission.code` uses `IPD-YYYYMMDD-NNNN`. Under heavy concurrent admit calls,
two transactions might generate the same number. The code generator wraps
the `Admission.objects.filter(code__startswith=...).count() + 1` lookup
inside the same transaction as the admission creation, but for full safety
under high concurrency consider adding a `select_for_update()` on a
hospital-level counter table. Not an issue at typical hospital throughput
(< 50 admissions/day).

### Bed transfer doesn't update locked rates retroactively

By design. Daily charges already accrued at the old bed's rate are kept at
that rate. Only future daily charges (from the transfer date forward) use
the new bed's locked rate. This matches Indian hospital billing convention
where charges are calculated per-day-per-bed.

### Discharge invoice is missing recent pharmacy/lab orders

The discharge service (`discharge_patient`) sweeps in:
- Pharmacy orders with status `COMPLETED` and no linked invoice
- Lab orders not in `CANCELLED` status and not yet linked to an invoice
both filtered to those falling within the admission stay window
(`admitted_at` to `discharged_at`).

If an order was already linked to a separate invoice (e.g. an OPD
consultation finalized while the patient was admitted), it won't be
double-billed. Toggle the include flags in the discharge modal if needed.

---

## Phase 2 status

| Sub-phase | Scope | Status |
|---|---|---|
| **2a** | Department + Pharmacy + 80 batches | ✓ Shipped |
| **2b** | Lab module + Refunds | ✓ Shipped |
| **2c** | IPD + GSTR-1/3B + Doctor dashboard | ✓ Shipped (this zip) |

**Phase 2 complete.** Awaiting your direction for Phase 3 (Operation Theatre,
Blood Bank, Ambulance, Dietary, Laundry, etc. from the original 26-module
spec).

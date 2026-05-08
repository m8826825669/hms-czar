# Phase 2b — Lab Module + Refunds

This phase adds:

1. **Lab module** (`apps/lab`) — orderable test catalog with parameter-level
   reference ranges, lab orders with auto-invoice, sample collection with
   barcode generation, structured result entry with auto-flagging
   (NORMAL / LOW / HIGH / CRITICAL), and PDF report generation.
2. **Refunds module** — a `Refund` model on `apps/billing` with
   REQUESTED → APPROVED → PROCESSED workflow, Razorpay refund API integration,
   and an `amount_refunded` field on `Invoice`.

---

## What's in the zip

```
backend/
  apps/lab/                            ← NEW APP
    __init__.py, apps.py, admin.py
    models.py
    serializers.py
    views.py
    urls.py
    services/
      __init__.py
      order_service.py                 ← finalize, collect, results, release
      pdf_report.py                    ← ReportLab PDF builder
    management/commands/
      seed_phase2b_lab.py              ← 15 tests + ~50 parameters
    migrations/__init__.py             ← (makemigrations will populate)

  apps/billing/                        ← UPDATED (drop-in replacements)
    models.py                          ← + Refund + Invoice.amount_refunded
    serializers.py                     ← + RefundSerializer
    views.py                           ← + RefundViewSet + request-refund action
    urls.py                            ← + refunds router
    admin.py                           ← + RefundAdmin / RefundInline
    services/razorpay_service.py       ← + refund_payment

  config/urls.py                       ← + /api/lab/ include

frontend/src/
  types/
    lab.ts                             ← NEW (Phase 2b types)
    refunds.ts                         ← NEW (additive to existing billing.ts)
  lib/api/
    lab.ts                             ← NEW
    refunds.ts                         ← NEW (or merge into existing billing.ts)
  app/dashboard/lab/
    page.tsx                           ← Lab dashboard
    orders/new/page.tsx                ← Create lab order
    orders/[id]/page.tsx               ← Order detail (workflow centre)
  app/dashboard/billing/refunds/
    page.tsx                           ← Refund list with action buttons
    [id]/page.tsx                      ← Refund detail
  components/billing/
    RefundRequestModal.tsx             ← Drop-in modal
```

---

## Installation

### 1. Extract the zip into your existing project

```powershell
cd D:\hms_phase0\hms
# Backup billing app first (we're replacing several files)
copy backend\apps\billing\models.py backend\apps\billing\models.py.phase1c.bak
copy backend\apps\billing\views.py backend\apps\billing\views.py.phase1c.bak

# Extract — overwrite when prompted
Expand-Archive .\hms_phase2b.zip -DestinationPath . -Force
```

> **Note:** The billing files in this zip are full drop-in replacements for the
> Phase 1c versions — they include all Phase 1c logic plus the Phase 2b
> additions. The Phase 2a files (`apps.department`, `apps.pharmacy`) are
> untouched and continue to work.

### 2. Install Razorpay (already a Phase 1c dependency, but in case)

```powershell
.\venv\Scripts\Activate.ps1
pip install razorpay
```

### 3. Add the new app to `INSTALLED_APPS`

In `backend/config/settings/base.py`:

```python
INSTALLED_APPS = [
    # ... existing apps
    "apps.lab",   # ← Phase 2b
]
```

### 4. Make and apply migrations

```powershell
cd backend
python manage.py makemigrations lab billing
python manage.py migrate
```

The `billing` migration adds the `amount_refunded` field to `Invoice` plus the
`Refund` table. The `lab` migration creates `TestCatalog`, `TestParameter`,
`LabOrder`, `LabOrderItem`, `LabSample`, and `LabResult`.

### 5. Seed lab catalog

```powershell
python manage.py seed_phase2b_lab
# or, to wipe existing lab data and reseed:
python manage.py seed_phase2b_lab --reset
```

You should see ~15 tests with ~50 parameters created.

### 6. Restart Daphne (or runserver)

```powershell
daphne -b 127.0.0.1 -p 8000 config.asgi:application
```

### 7. Frontend — wire up the sidebar

If you have a sidebar component, add these two links:

```tsx
// In your sidebar nav config:
{ href: "/dashboard/lab",            label: "Laboratory",  icon: FlaskConical },
{ href: "/dashboard/billing/refunds", label: "Refunds",     icon: RotateCcw },
```

### 8. Frontend — wire up the refund button on billing detail page

In your existing `frontend/src/app/dashboard/billing/[id]/page.tsx`:

```tsx
import { useState } from "react";
import RefundRequestModal from "@/components/billing/RefundRequestModal";

// inside the component:
const [refundOpen, setRefundOpen] = useState(false);

// in the JSX, near the Pay/Print buttons:
{(invoice.status === "PAID" || invoice.status === "PARTIAL")
  && Number(invoice.amount_paid) > Number(invoice.amount_refunded ?? 0) && (
  <button
    onClick={() => setRefundOpen(true)}
    className="px-3 py-1.5 border border-amber-300 text-amber-700 rounded hover:bg-amber-50 text-sm"
  >
    Request Refund
  </button>
)}

// at the bottom of the JSX (outside main flow):
<RefundRequestModal
  invoice={invoice}
  open={refundOpen}
  onClose={() => setRefundOpen(false)}
  onSuccess={() => refetch()}  // or queryClient.invalidateQueries(...)
/>

// And add to your existing `Invoice` TypeScript type:
//   amount_refunded: string;
//
// (the API already returns it; this is just to satisfy TS)
```

### 9. Restart the Next.js dev server

```powershell
cd frontend
npm run dev
```

---

## End-to-end smoke tests

### Scenario A — Create + finalize a lab order

1. Login as `aslam` / `Password@123`.
2. Navigate to `/dashboard/lab` → click **+ New Lab Order**.
3. Search for any patient (try "John" or use an MRN).
4. Pick the ordering doctor (e.g. `Dr. shahid`).
5. Select tests — try **CBC + LFT + LIPID** to exercise multiple sample types.
6. Set priority to URGENT, add a clinical note.
7. Click **Create Draft Order** — you'll be redirected to the detail page in
   DRAFT status.
8. Click **Finalize & Generate Invoice** — status becomes ORDERED, a linked
   `INV-...` is shown in the sidebar with status PENDING.
9. Open the invoice link → it should show three line items (CBC, LFT, LIPID)
   with the correct prices.

### Scenario B — Sample collection

10. Back on the lab order, click **Collect Samples →**.
    The system auto-creates one sample per unique sample type. With CBC + LFT +
    LIPID you'll see **two** samples: one EDTA (CBC) and one plain (LFT, LIPID).
11. Print the barcodes from the sidebar — `SAM-202605070001-A`, `…-B`.

### Scenario C — Result entry with abnormal preview

12. With status now COLLECTED, scroll to the test sections. Each parameter has
    an inline input with the reference range to its right.
13. Type `8.5` for Haemoglobin (CBC) — the input border turns **amber** and a
    LOW flag appears (ref is 12.0 - 17.0).
14. Type `5.2` for Hb — the input turns **red bold** and a CRITICAL flag
    appears (critical_low is 7.0).
15. Type `13.5` and the flag clears to NORMAL.
16. Fill in remaining CBC parameters and click **Save Results** — the test
    moves to IN_PROGRESS, and the order moves to IN_PROGRESS too.

### Scenario D — Release report + PDF download

17. After entering results for all tests, click **Verify & Release Report**.
    Status moves to REPORTED.
18. Click **Download Report** — a PDF opens with patient header, all results
    grouped by test, abnormal values highlighted, reference ranges, and a
    sign-off line.

### Scenario E — Razorpay refund flow

19. Go to a paid invoice (you can pay one with the cash button or with the
    Razorpay test card `4111 1111 1111 1111`).
20. Click **Request Refund**, enter ₹100, reason "Patient cancelled", method
    auto-selected based on payment.
21. Submit → you're back on the invoice; the new refund shows up in the
    Refunds section as REQUESTED.
22. Navigate to `/dashboard/billing/refunds` → click **Approve** — status
    becomes APPROVED.
23. Click **Process** — for a Razorpay payment this hits the live Razorpay
    refund API and stores the `rfnd_xxx` ID; status becomes PROCESSED.
24. Refresh the invoice — `amount_refunded` is `100.00`, `amount_paid` is
    reduced by 100, status is PARTIAL (or REFUNDED if amount_paid hit zero).

### Scenario F — Cash refund flow

25. From a cash-paid invoice, request a refund — method auto-selects CASH.
26. Approve → Process. No external API call; just records the disbursement and
    updates `amount_refunded`.

---

## Troubleshooting

### "Razorpay refund failed" on Process

- Confirm `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` in `.env` are correct.
- Razorpay sandbox refunds work in test mode — the refund will show as
  `pending` initially, then `processed` after a few seconds (visible in the
  Razorpay test dashboard).
- Razorpay rejects refunds where the original payment is older than 180 days
  in test mode.

### Lab PDF: "PDF generation failed"

- Make sure ReportLab is installed: `pip install reportlab`.
- If you see a font warning, the PDF still generates — only Helvetica is used.

### Reference range NULL handling

- Parameters without `ref_low` / `ref_high` (e.g. all qualitative parameters in
  WIDAL, DENGUE, X-Ray) default to flag NORMAL when any value is entered.
- For qualitative parameters, the `ref_text` field is shown as the reference
  (e.g. "Negative", "< 1:80", "Normal study").

### Migration order issue (`accounts.User` not found)

If `makemigrations lab` complains about a missing app, ensure
`apps.accounts`, `apps.core`, `apps.specialist`, `apps.opd`, `apps.billing`
all appear **before** `apps.lab` in `INSTALLED_APPS`.

---

## Phase 2c preview

Coming next:

- **IPD admission + bed management** — Ward / Room / Bed allocation,
  Admission record with daily charges accrual, Discharge summary auto-filled
  from EMR + lab + pharmacy data.
- **GSTR-1 / GSTR-3B reports** — monthly export to JSON/Excel for filing,
  HSN-wise summary, B2B/B2C split.
- **Doctor dashboard** — today's appointments, pending consultations, pending
  lab results awaiting verification, prescription summary.

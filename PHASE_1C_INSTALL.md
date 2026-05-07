# HMS Phase 1c — Installation Guide

**Prerequisite:** Phases 0, 1a, 1b installed at `D:\hms_phase0\hms\` with daphne running.

Phase 1c adds:
- **Billing module** — Service catalog (HSN/GST), invoices with CGST+SGST/IGST split, cash + Razorpay payments, thermal-format PDF print
- **Public module** — No-auth views: QR-scannable prescription page (`/p/rx/<uuid>`), waiting-room TV queue display (`/p/queue/<hospital_id>`)
- **50-patient sample seed** — Realistic Indian patients across age groups + sample appointments + completed consultations + invoices in mixed payment states

---

## 1. Install new Python dependencies

Open backend terminal:

```powershell
cd D:\hms_phase0\hms\backend
.\venv\Scripts\activate
pip install razorpay reportlab
```

If you want to lock these in `requirements.txt`, add:

```
razorpay>=1.4.2
reportlab>=4.0.0
```

---

## 2. Configure Razorpay credentials

Phase 1c needs three Razorpay env vars in your `.env` file at `backend/.env`:

```env
# Razorpay (test mode)
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxxxxxx
RAZORPAY_WEBHOOK_SECRET=any_strong_random_string
```

> Get test keys from your Razorpay dashboard → **Settings → API Keys → Generate Test Key**.

Then in `backend/config/settings/dev.py` (or `base.py`), add at the bottom:

```python
import os
RAZORPAY_KEY_ID = os.environ.get("RAZORPAY_KEY_ID", "")
RAZORPAY_KEY_SECRET = os.environ.get("RAZORPAY_KEY_SECRET", "")
RAZORPAY_WEBHOOK_SECRET = os.environ.get("RAZORPAY_WEBHOOK_SECRET", "")
```

Also add the new apps to `INSTALLED_APPS`:

```python
INSTALLED_APPS = [
    # ...
    "apps.billing",   # Phase 1c
    "apps.public",    # Phase 1c
]
```

> If you previously enabled `"apps.opd"` and `"apps.emr"` for Phase 1b, just add the two above to that list.

---

## 3. Extract Phase 1c zip

Extract `hms_phase1c.zip` over `D:\hms_phase0\hms\`. New files:

| Backend | Purpose |
|---------|---------|
| `apps/billing/` | Models, views, admin, serializers, services |
| `apps/billing/services/razorpay_service.py` | Order create + signature verify + webhook verify |
| `apps/billing/services/thermal_print.py` | 80mm PDF generator (ReportLab) |
| `apps/billing/services/invoice_service.py` | GST split (INTRA/INTER) helper |
| `apps/public/` | No-auth Rx + queue endpoints |
| `apps/notifications/management/commands/seed_billing_templates.py` | INVOICE_GENERATED + PAYMENT_RECEIVED templates |
| `apps/core/management/commands/seed_phase1c.py` | 30 services + 50 patients + sample data |
| `config/urls.py` *(overwritten)* | Adds `billing/` + `public/` routes |

| Frontend | Purpose |
|----------|---------|
| `app/dashboard/billing/page.tsx` | Daily billing dashboard |
| `app/dashboard/billing/new/page.tsx` | Invoice builder (3-step) |
| `app/dashboard/billing/[id]/page.tsx` | Invoice detail + payment + Razorpay |
| `app/dashboard/services/page.tsx` | Service catalog admin |
| `app/p/layout.tsx` | Minimal no-auth layout |
| `app/p/rx/[uuid]/page.tsx` | Public Rx (QR target) |
| `app/p/queue/[hospitalId]/page.tsx` | Waiting-room TV display |
| `lib/api/billing.ts` | Billing + public API helpers |
| `types/billing.ts` | Service/Invoice/Payment types |

> No existing files are overwritten on the frontend — your Phase 1b sidebar/types/etc. remain intact.

---

## 4. Run migrations

```powershell
cd D:\hms_phase0\hms\backend
python manage.py makemigrations billing public
python manage.py migrate
```

Expected output mentions:
```
Migrations for 'billing':
  apps\billing\migrations\0001_initial.py
    - Create model ServiceCatalog
    - Create model Invoice
    - Create model InvoiceItem
    - Create model Payment
```

> The `public` app has no models — `makemigrations public` is a no-op.

---

## 5. Seed templates + sample data

```powershell
# Notification templates (INVOICE_GENERATED, PAYMENT_RECEIVED)
# Additive — does NOT touch your manually-fixed Phase 1a templates
python manage.py seed_billing_templates

# 30 services + 50 patients + sample appointments/consults/invoices
python manage.py seed_phase1c
```

Expected output:
```
Seeding services...
  ✓ 30 services created/updated
Seeding 50 patients...
  ✓ 50 patients created
Creating sample appointments + consults + invoices...
  ✓ 30 appointments, ~12 consults, ~12 invoices

✅ Phase 1c seed complete!
```

To re-run cleanly: `python manage.py seed_phase1c --reset`
(This deletes only `[seed1c]`-tagged records; existing patients/invoices are untouched.)

---

## 6. Restart daphne (and add new INSTALLED_APPS)

```powershell
# Stop existing daphne (Ctrl+C in its terminal)
# Restart
daphne -b 0.0.0.0 -p 8000 config.asgi:application
```

Frontend dev server doesn't need restart, but run `npm run dev` if not running.

---

## 7. Add sidebar entries

Edit `frontend/src/components/shared/sidebar.tsx`, add to the nav array:

```ts
{ label: "Billing",  href: "/dashboard/billing",  icon: Receipt },
{ label: "Services", href: "/dashboard/services", icon: Tag },
```

---

## 8. End-to-end verification

### A. Service catalog
1. Visit `/dashboard/services` → 30 seeded services visible (CONS-GEN, CBC, X-Ray, etc.)
2. Filter by category → see groupings
3. Add a custom service → it appears immediately

### B. Create invoice + cash payment
1. Visit `/dashboard/billing` → see today's collection stats from seeded data
2. Click **New Invoice**
3. Search a patient (try one from seed e.g. type a name — should find matches)
4. Add 2 services from catalog (CONS-GEN + CBC)
5. Click **Finalize** → invoice moves DRAFT → PENDING
6. SMS template `INVOICE_GENERATED` fires (visible in `notifications` admin or console for dev)
7. On detail page, record cash payment → status → PAID
8. SMS template `PAYMENT_RECEIVED` fires
9. Click **Print Invoice (80mm)** → PDF opens in new tab

### C. Razorpay flow (test mode)

1. On a PENDING invoice, click **Pay ₹X via Razorpay**
2. Razorpay Checkout modal opens
3. Use test card: **`4111 1111 1111 1111`** with any future expiry (e.g. `12/30`) and any CVV (e.g. `123`)
4. UPI test: `success@razorpay`
5. Click Pay → modal handler fires → `/payments/verify/` checks signature → invoice marked PAID
6. Payment row appears in detail page with **✓ verified** flag

### D. Webhook (production-style)

For local testing of webhooks, use **ngrok**:

```powershell
ngrok http 8000
```

Copy the public HTTPS URL (e.g. `https://abc123.ngrok-free.app`), then in Razorpay Dashboard:
- **Settings → Webhooks → Add new webhook**
- URL: `https://abc123.ngrok-free.app/api/v1/billing/webhooks/razorpay/`
- Secret: same value as `RAZORPAY_WEBHOOK_SECRET` in your `.env`
- Active events: `payment.captured`, `payment.failed`

After completing a Razorpay test payment, you'll see two `Payment` rows for the same invoice (one from frontend handler, one from webhook), but **only the first** marks PAID — the webhook is idempotent via `razorpay_payment_id` `get_or_create`.

### E. Public Rx (QR-scannable)

1. After completing any Phase 1b consultation, get the prescription's `prescription_uuid` (visible in Django admin under **OPD → Prescriptions**)
2. Visit `http://localhost:3000/p/rx/<uuid>` → see formatted prescription
3. **No login required** — works in any browser, mobile-friendly
4. Click Print → clean A4 layout (top bar hidden)
5. Production: encode this URL into a QR on the printed thermal Rx

### F. Public queue TV display

1. Open `http://localhost:3000/p/queue/1` on a waiting-room TV browser (replace `1` with your hospital ID)
2. Page shows:
   - Big green tokens for **Now Serving**
   - Amber tokens for **Waiting**
   - Live clock + last-updated timestamp
   - Stats footer (now serving / waiting / completed today)
3. Auto-refreshes every 5 seconds — no manual refresh needed
4. Optional filters: `?doctor=5` or `?location=2`
5. Hide cursor on TV: `cursor: none` CSS in browser kiosk mode

---

## 9. Troubleshooting

### "razorpay package not installed"
Run `pip install razorpay` in the backend venv.

### "RAZORPAY_KEY_ID / SECRET not configured"
Re-check `.env` and that `dev.py` imports them. Restart daphne.

### Razorpay modal opens but no Pay button
Browser blocked the Razorpay JS load. Allow `checkout.razorpay.com` in any ad-blockers.

### Webhook always returns 400 invalid signature
- Verify the secret in Razorpay Dashboard matches `RAZORPAY_WEBHOOK_SECRET` exactly (no quotes, no whitespace)
- ngrok forwards must use HTTPS
- Razorpay computes signature on raw body — Django middleware that re-encodes JSON breaks it. The webhook view uses `request.body` (raw bytes) directly to avoid this

### PDF print fails with "ReportLab not installed"
Run `pip install reportlab`.

### Invoice GST split is wrong
Phase 1c looks at `Patient.state` vs `Hospital.state`. If your hospital's state isn't set (admin → Hospital → state), it defaults to "INTRA" (CGST + SGST). Set the hospital state correctly for accurate inter-state GST.

---

## What's in this zip

```
backend/
├── apps/
│   ├── billing/                            (NEW MODULE)
│   │   ├── models.py                       (ServiceCatalog/Invoice/InvoiceItem/Payment)
│   │   ├── serializers.py
│   │   ├── views.py                        (3 ViewSets + verify + webhook)
│   │   ├── services/
│   │   │   ├── razorpay_service.py         (order create + 2 verify methods)
│   │   │   ├── thermal_print.py            (80mm PDF via ReportLab)
│   │   │   └── invoice_service.py          (GST split helper)
│   │   ├── admin.py
│   │   └── urls.py
│   ├── public/                             (NEW MODULE - no auth)
│   │   ├── views.py                        (Rx by UUID + queue display)
│   │   └── urls.py
│   ├── notifications/management/commands/
│   │   └── seed_billing_templates.py       (additive — preserves manual fixes)
│   └── core/management/commands/
│       └── seed_phase1c.py                 (30 services + 50 patients + sample data)
└── config/
    └── urls.py                             (UPDATED: billing/ + public/)

frontend/
└── src/
    ├── types/billing.ts                    (Service/Invoice/Payment types)
    ├── lib/api/billing.ts                  (servicesApi/invoicesApi/publicApi)
    └── app/
        ├── dashboard/
        │   ├── billing/
        │   │   ├── page.tsx                (today's collection dashboard)
        │   │   ├── new/page.tsx            (invoice builder)
        │   │   └── [id]/page.tsx           (detail + Razorpay)
        │   └── services/
        │       └── page.tsx                (catalog admin)
        └── p/                              (NEW: public route group)
            ├── layout.tsx                  (no auth, no sidebar)
            ├── rx/[uuid]/page.tsx          (QR-scan prescription)
            └── queue/[hospitalId]/page.tsx (waiting room TV display)
```

---

## Phase 2 preview (next zip)

- **Pharmacy module** — drug inventory + dispensing against prescription, batch/expiry tracking
- **Lab module** — sample collection workflow + result entry + report generation
- **IPD admission/bed management** — bed allocation, transfer, discharge summary
- **GSTR-1 / GSTR-3B reports** — month-wise GST returns ready for filing
- **Doctor dashboard** — own consults, pending Rx signing, today's revenue split
- **Refunds module** — partial/full refund flow with audit trail

Bolo "Phase 2 chalu karo" jab ready ho.

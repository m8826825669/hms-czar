# HMS Phase 2a — Installation Guide

**Prerequisite:** Phases 0, 1a, 1b, 1c installed and working at `D:\hms_phase0\hms\`.

Phase 2a adds:
- **Department module** — Hospital organizational units (Cardiology, Pharmacy, Radiology, etc.)
- **Pharmacy module** — Batch-tracked inventory with FEFO (First Expiry First Out) allocation, stock receive workflow, dispense-against-prescription, low-stock + near-expiry reports
- **Auto-generated invoice** when a pharmacy order is dispensed (links to existing Phase 1c billing)

---

## 1. Extract zip

Extract `hms_phase2a.zip` over `D:\hms_phase0\hms\`. New + updated files:

| Backend | Purpose |
|---------|---------|
| `apps/department/` | Department model, views, urls, admin |
| `apps/pharmacy/` | DrugBatch + StockMovement + PharmacyOrder + PharmacyOrderItem |
| `apps/pharmacy/services/inventory.py` | FEFO allocator + preview + insufficient-stock error |
| `apps/pharmacy/services/dispense.py` | Atomic dispense workflow (decrement batches → create invoice) |
| `apps/core/management/commands/seed_phase2a.py` | 10 departments + ~80 batches seed |
| `config/urls.py` *(overwritten)* | Adds `department/` + `pharmacy/` routes |

| Frontend | Purpose |
|----------|---------|
| `app/dashboard/pharmacy/page.tsx` | Dashboard with sales/low-stock/near-expiry |
| `app/dashboard/pharmacy/receive/page.tsx` | Stock receive form |
| `app/dashboard/pharmacy/stock/page.tsx` | Browse all batches |
| `app/dashboard/pharmacy/dispense/page.tsx` | Search Rx or walk-in patient |
| `app/dashboard/pharmacy/dispense/[rxId]/page.tsx` | Order detail with FEFO preview + dispense |
| `lib/api/pharmacy.ts` | Pharmacy + Department API helpers |
| `types/pharmacy.ts` | Pharmacy types |

---

## 2. Add to INSTALLED_APPS

In `backend/config/settings/dev.py` (or `base.py`), add:

```python
INSTALLED_APPS = [
    # ... existing apps ...
    "apps.department",   # Phase 2a
    "apps.pharmacy",     # Phase 2a
]
```

---

## 3. Run migrations

```powershell
cd D:\hms_phase0\hms\backend
.\venv\Scripts\activate
python manage.py makemigrations department pharmacy
python manage.py migrate
```

Expected:
```
Migrations for 'department':
  apps\department\migrations\0001_initial.py
    - Create model Department
Migrations for 'pharmacy':
  apps\pharmacy\migrations\0001_initial.py
    - Create model DrugBatch
    - Create model StockMovement
    - Create model PharmacyOrder
    - Create model PharmacyOrderItem
```

---

## 4. Seed departments + batches

```powershell
python manage.py seed_phase2a
```

Creates:
- 10 departments (CARDIO, ORTHO, PEDIA, DERMA, RADIO, PATH, **PHARM**, ICU, OT, ADMIN)
- 1–2 batches per drug with realistic Indian MRPs (Crocin ₹1.50–₹3, Augmentin ₹15–₹25, Becosules ₹4–₹8, etc.) and varied expiry (6–30 months out)
- Auto-generated `PURCHASE_IN` stock movements

To re-run cleanly: `python manage.py seed_phase2a --reset`
(Wipes all departments + batches + movements, leaves drugs/patients/invoices intact.)

---

## 5. Restart daphne

```powershell
daphne -b 0.0.0.0 -p 8000 config.asgi:application
```

---

## 6. Sidebar entry

Add to `frontend/src/components/shared/sidebar.tsx`:

```ts
{ label: "Pharmacy", href: "/dashboard/pharmacy", icon: Pill },
```

---

## 7. End-to-end verification

### A. Stock dashboard

1. Visit `/dashboard/pharmacy` → see 4 stat cards
2. Low stock + near expiry lists populated from seed
3. Today's sales = 0 initially

### B. Receive new stock

1. Click **Receive Stock** → search a drug (e.g. "paracetamol")
2. Pick Crocin → fill batch details:
   - Batch: `TEST001`
   - Expiry: 6 months out
   - Qty: 500
   - MRP: 2.50
   - Supplier: any
3. Click **Receive Stock** → batch added, success toast
4. Verify in **Browse Stock** → new batch with 500 units

### C. Dispense from prescription

1. From Phase 1b, you have completed consultations with prescriptions. Find one in admin under **OPD → Prescriptions**.
2. Visit `/dashboard/pharmacy/dispense` → search by Rx code or patient name
3. Click on a Rx → backend FEFO-allocates batches, creates DRAFT order with auto-quantities
4. **Review the order:**
   - Each item shows the allocated batch + earliest expiry
   - If a drug had insufficient stock or no master entry, a warning appears
5. Adjust quantities (remove items, add more drugs manually with Add Drug form)
6. **Live FEFO preview** — typing quantity shows which batch(es) will be picked
7. Click **Dispense & Generate Bill**:
   - All batches decrement atomically
   - StockMovement records created (`DISPENSE_OUT`)
   - **Invoice auto-generated** in PENDING status
   - Order → COMPLETED
   - Click **Open Invoice** to collect payment via the Phase 1c billing flow (cash / Razorpay)

### D. Walk-in OTC sale

1. Visit `/dashboard/pharmacy/dispense` → switch to **Walk-in Sale** tab
2. Search a patient → DRAFT order created
3. Manually add drugs via the right sidebar (FEFO auto-allocates)
4. Dispense → Invoice generated

### E. Stock reports

- Low stock: `/api/v1/pharmacy/reports/low-stock/?threshold=50` (or visible on dashboard)
- Near expiry: `/api/v1/pharmacy/reports/near-expiry/?days=90`
- Drug availability: `/api/v1/pharmacy/drugs/<id>/availability/` — total + per-batch breakdown

### F. Audit trail

Every stock change is logged in **`StockMovement`** (admin → Pharmacy → Stock movements):
- `PURCHASE_IN` — when stock received
- `DISPENSE_OUT` — when order dispensed (one row per item)
- `RETURN_IN` / `EXPIRED_OUT` / `DAMAGED_OUT` / `ADJUSTMENT_*` — manual via admin

---

## 8. Important: GST on MRP

In India, drug MRP is **GST-inclusive** (printed on the strip). The pharmacy module
correctly back-calculates the pre-GST subtotal from MRP for invoice generation:

```
subtotal = MRP × qty / (1 + gst_rate / 100)
gst_amount = MRP × qty − subtotal
total = MRP × qty
```

So if you sell 10 tabs of Crocin (MRP ₹2.50) at 12% GST:
- Total: ₹25.00
- Pre-GST subtotal: ₹22.32
- GST: ₹2.68 (CGST ₹1.34 + SGST ₹1.34 if intra-state)

The invoice items in Phase 1c **store unit_price as MRP** (GST-inclusive) — the
billing module's per-line GST calc then matches. This is consistent with how
Indian pharmacy POS systems work.

---

## 9. Troubleshooting

### "InsufficientStockError" when adding item
Drug has unexpired stock < requested qty. Check `Browse Stock` for available qty,
or receive new stock via the Receive Stock workflow.

### "Item has no batch assigned" on dispense
Item was created without batch FK. Should not happen via UI; check admin if you
created order manually.

### Order stuck in DRAFT
Pharmacy orders only finalize via the **Dispense** action which decrements batches
atomically. Cancel via the Cancel button if you want to abandon.

### Frequencies → quantity estimation seems off
The `start-from-prescription` endpoint estimates qty from `dose × frequency × duration`:
- BD (twice daily) × 5 days × 1 tab = 10 units
- TDS (3×) × 7 days × 1 tab = 21 units

If the dose contains "10ml" or "2 tabs", it parses the leading number. Edge cases
(e.g. "1/2 tab", "as needed") fall back to defaults — adjust manually.

---

## What's in this zip

```
backend/
├── apps/
│   ├── department/                       (NEW)
│   │   ├── models.py                     (Department)
│   │   ├── serializers.py
│   │   ├── views.py
│   │   ├── urls.py
│   │   └── admin.py
│   ├── pharmacy/                         (NEW)
│   │   ├── models.py                     (DrugBatch, StockMovement, PharmacyOrder, Item)
│   │   ├── serializers.py
│   │   ├── views.py                      (3 ViewSets + 5 standalone endpoints)
│   │   ├── services/
│   │   │   ├── inventory.py              (FEFO allocator + preview)
│   │   │   └── dispense.py               (atomic dispense → invoice)
│   │   ├── urls.py
│   │   └── admin.py
│   └── core/management/commands/
│       └── seed_phase2a.py               (10 depts + ~80 batches)
└── config/
    └── urls.py                           (UPDATED: department/ + pharmacy/)

frontend/
└── src/
    ├── types/pharmacy.ts                 (Department/DrugBatch/PharmacyOrder types)
    ├── lib/api/pharmacy.ts               (departmentsApi/batchesApi/stockApi/pharmacyOrdersApi)
    └── app/dashboard/pharmacy/
        ├── page.tsx                      (dashboard)
        ├── receive/page.tsx              (stock-in)
        ├── stock/page.tsx                (browse batches)
        └── dispense/
            ├── page.tsx                  (Rx search / walk-in)
            └── [rxId]/page.tsx           (order detail + FEFO + dispense)
```

---

## Phase 2b preview (next zip)

- **Lab module** — Test catalog (CBC, LFT, KFT, X-Ray, USG…), sample collection workflow,
  result entry with reference ranges, abnormal-flagging, PDF report generation
- **Refunds module** — Partial/full refund flow with Razorpay refund API integration,
  audit trail, automatic invoice status update

Bolo "Phase 2b chalu karo" jab ready.

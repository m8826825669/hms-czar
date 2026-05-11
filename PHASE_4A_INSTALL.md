# HMS Phase 4a — Install Instructions

**Modules added:** Inventory / Stores · Asset Register · Housekeeping

**Pre-requisites:** Phases 1a-3b installed and working.

---

## 1. Extract

Extract `hms_phase4a.zip` over `D:\hms_phase0\hms\`.

```
backend/apps/inventory/
backend/apps/assets/
backend/apps/housekeeping/
backend/config/urls.py
frontend/src/types/phase4a.ts
frontend/src/lib/api/phase4a.ts
frontend/src/app/dashboard/inventory/
frontend/src/app/dashboard/assets/
frontend/src/app/dashboard/housekeeping/
PHASE_4A_INSTALL.md
```

## 2. `INSTALLED_APPS`

Add to `backend/config/settings.py`:

```python
INSTALLED_APPS = [
    # ... existing ...
    "apps.inventory",
    "apps.assets",
    "apps.housekeeping",
]
```

## 3. `config/urls.py`

Add to `urlpatterns`:

```python
path("api/inventory/",    include("apps.inventory.urls")),
path("api/assets/",       include("apps.assets.urls")),
path("api/housekeeping/", include("apps.housekeeping.urls")),
```

## 4. Migrate

```powershell
cd backend
.\venv\Scripts\Activate.ps1
python manage.py makemigrations inventory assets housekeeping
python manage.py migrate
```

## 5. Seed

```powershell
python manage.py seed_phase4a_inventory --with-stock    # 7 stores, 18 items, 18 batches
python manage.py seed_phase4a_assets                    # 7 categories, 19 sample assets (Philips/Hamilton/Siemens etc)
python manage.py seed_phase4a_housekeeping              # 12 zones, 7 staff, 19 task templates
```

`--reset` to wipe and re-seed.

## 6. Frontend sidebar

```tsx
<NavLink href="/dashboard/inventory">Inventory</NavLink>
<NavLink href="/dashboard/assets">Assets</NavLink>
<NavLink href="/dashboard/housekeeping">Housekeeping</NavLink>
```

## 7. End-to-end test scenarios

**PO → GRN → Stock flow:**

1. Django Admin → Inventory → Purchase Orders → Add
2. Pick supplier + store, add POLines (item + qty + unit_price)
3. `/dashboard/inventory/purchase-orders` → see DRAFT → click Submit → click Approve
4. Admin → GRNs → Add → link to your PO → add GRNLines (batch_number + accepted_quantity + expiry_date)
5. Save → stock batch auto-created in target store; PO status → PARTIAL/RECEIVED
6. `/dashboard/inventory` → see new stock in summary

**Requisition → Issue flow:**

1. Admin → Stock Requisitions → Add → pick dept + source store → add lines
2. `/dashboard/inventory/requisitions` → click Approve on the SUBMITTED row
3. POST to `/api/inventory/requisitions/{id}/issue/` with `line_issues: [{requisition_line_id, batch_id, quantity}]`
4. Stock deducted from chosen batch; issue record created

**Asset register flow:**

1. `/dashboard/assets` → see seeded assets with depreciation
2. Admin → Asset → pick asset → schedule maintenance → mark complete
3. `/dashboard/assets/maintenance` → see completed log

**Housekeeping flow:**

1. `/dashboard/housekeeping` → click "Auto-generate Today's Tasks"
2. ~80+ task assignments created from 19 templates
3. Click "Start" on a row → IN_PROGRESS
4. Click "Complete" → done
5. Counters update on top stats

## 8. Troubleshooting

* **Auto-generate creates 0 tasks** — check that templates are `is_active=True`
* **PO total = 0** — line items must save before totals recalc; refresh the PO
* **Asset book value = ₹0** — check `purchase_date` and `purchase_cost` on the asset
* **`No Hospital found`** — ensure Phase 1a seed has run (`python manage.py seed_phase1a_core`)

## 9. What's next

* **4b:** HR + Payroll + Attendance + Security
* **4c:** Insurance/TPA + Vaccination + Complaints/Feedback
* **4d:** Analytics + cross-module reports + go-live checklist

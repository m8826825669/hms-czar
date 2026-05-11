# HMS Phase 3a — Install Instructions

**Modules added:** Operation Theatre + Blood Bank
**Pre-requisites:** Phases 1a, 1b, 1c, 2a, 2b, 2c installed and working

---

## 1. Extract files

Extract `hms_phase3a.zip` over your existing `D:\hms_phase0\hms\` directory. The zip mirrors that structure:

```
backend/apps/ot/
backend/apps/blood_bank/
backend/config/urls.py            ← see step 2 — DO NOT replace blindly
frontend/src/types/ot.ts
frontend/src/types/blood_bank.ts
frontend/src/lib/api/ot.ts
frontend/src/lib/api/blood_bank.ts
frontend/src/app/dashboard/ot/...
frontend/src/app/dashboard/blood-bank/...
PHASE_3A_INSTALL.md
```

## 2. Decide on `config/urls.py`

If your existing `config/urls.py` has any custom edits (extra app routes, debug toolbar, custom auth endpoints), **do not overwrite it.** Instead:

```bash
# Backup
cp backend/config/urls.py backend/config/urls.py.phase2c.bak
```

Then open your existing file and add these two lines to the `urlpatterns` list:

```python
path("api/ot/",          include("apps.ot.urls")),
path("api/blood-bank/",  include("apps.blood_bank.urls")),
```

If your Phase 2c install is clean (no customizations), the bundled `config/urls.py` is a safe drop-in.

## 3. Register the apps

Edit `backend/config/settings.py` → `INSTALLED_APPS` and add:

```python
INSTALLED_APPS = [
    # ... existing apps ...
    "apps.ot",
    "apps.blood_bank",
]
```

**Load order:** `apps.ot` and `apps.blood_bank` reference `apps.ipd`, `apps.billing`, `apps.specialist`, and `apps.department` via FK — make sure those appear *before* the new apps in the list.

## 4. Migrations

```powershell
cd backend
.\.venv\Scripts\Activate.ps1   # Windows PowerShell venv

python manage.py makemigrations ot blood_bank
python manage.py migrate
```

You should see:

```
Migrations for 'ot':
  apps/ot/migrations/0001_initial.py
    - Create model OperationTheatre
    - Create model SurgicalProcedure
    - Create model SurgeryBooking
    - Create model SurgeryTeam
    - Create model OTRegister
    - Create model OTConsumable
Migrations for 'blood_bank':
  apps/blood_bank/migrations/0001_initial.py
    - Create model BloodDonor
    - Create model BloodDonation
    - Create model BloodBag
    - Create model BloodRequisition
    - Create model CrossMatch
    - Create model BloodIssue
```

## 5. Seed data

```powershell
# OT — 5 theatres + 20 procedures
python manage.py seed_phase3a_ot

# Blood Bank — 10 donors + 6 sample donations + bags (for inventory)
python manage.py seed_phase3a_blood_bank --with-bags
```

The `--with-bags` flag creates 6 sample passed donations across blood groups so the inventory dashboard isn't empty on first login.

To wipe and re-seed:

```powershell
python manage.py seed_phase3a_ot --reset
python manage.py seed_phase3a_blood_bank --reset --with-bags
```

## 6. Restart backend

```powershell
# Daphne (with WebSocket support)
daphne -b 0.0.0.0 -p 8000 config.asgi:application
```

## 7. Frontend sidebar links

Open `frontend/src/components/Sidebar.tsx` (or wherever your nav lives) and add:

```tsx
<NavLink href="/dashboard/ot">Operation Theatre</NavLink>
<NavLink href="/dashboard/blood-bank">Blood Bank</NavLink>
```

Restart Next.js dev server:

```powershell
cd frontend
npm run dev
```

## 8. End-to-end test scenarios

**Scenario A — Day-care surgery (no admission):**

1. Go to `/dashboard/ot` → "+ Book Surgery"
2. Pick a patient, select OT-MINOR, pick "Lipoma Excision" (LIPOMA)
3. Pick a surgeon, schedule for now
4. Save → opens detail page with `SCHEDULED` status
5. Click "Check-In Patient" → status `CHECKED_IN`
6. Click "Start Surgery" → status `IN_PROGRESS`, theatre status `OCCUPIED`
7. Add a consumable: "Lignocaine 2%, qty 1, ₹50, GST 0%"
8. Click "Complete Surgery" → confirms, status `COMPLETED`, theatre `CLEANING`
9. Verify a new invoice appears in sidebar with procedure + consumable lines
10. Expand "OT Register", fill `surgical_steps` and `intra_op_findings`, click "Finalize"
11. Click "↓ Register PDF" — verifies the formal surgical record PDF

**Scenario B — IPD surgery rolled into admission:**

1. Create an IPD admission first (Phase 2c)
2. Book a surgery, pass the admission ID in the optional field
3. Complete the surgery — verify no new invoice is created; instead the procedure + consumables show up as `AdmissionService` rows on the admission
4. Discharge the patient — final IPD invoice rolls in OT charges automatically

**Scenario C — Blood bank donor → bag → issue:**

1. `/dashboard/blood-bank/donors/new` — register a donor (age 18-65, weight ≥ 50 kg)
2. `/dashboard/blood-bank/donations/new` — pick the donor, fill vitals
3. Step 2 of donation form — submit screening (all NEGATIVE), tick `["WHOLE", "PRBC"]` for components
4. `/dashboard/blood-bank` — verify new bags appear in the inventory matrix
5. `/dashboard/blood-bank/requisitions/new` — create a requisition for a patient
6. On requisition detail → "Compatible Bags" list shows FIFO-ordered candidates
7. Click "✓ Compatible" on one row → cross-match recorded
8. Click "Reserve" → bag status `RESERVED`
9. Click "Issue Bag" inline → fill issued_to / received_by / unit_price, "Bill" toggle
10. Issue confirmed → bag status `ISSUED`, requisition status `ISSUED` (when units_required matched)
11. Optional: in "Issued Bags" section, "Complete Transfusion" form records vitals + reactions

**Scenario D — Inventory dashboard validation:**

1. After seeding `--with-bags`, open `/dashboard/blood-bank`
2. Verify 5 stat cards show non-zero values (Available count > 0)
3. Verify 8×5 stock matrix has counts in O+ × {WHOLE, PRBC} cells
4. Try POSTing to `/api/blood-bank/expire-old-bags/` to test the expiry sweep

## 9. Troubleshooting

**`ModuleNotFoundError: No module named 'reportlab'`** — install it:

```powershell
pip install reportlab
```

**`ValidationError: Donor age must be between 18 and 65`** — birth date in donor form is being parsed wrong. Use ISO format (YYYY-MM-DD).

**Cross-match button missing** — bag status must be `AVAILABLE`. Check the bag's status in admin.

**`COMPATIBILITY` map edge case** — the map encodes ABO + Rh compatibility. If you need additional rules (e.g. Kell antigen for chronic transfusion patients), edit `apps/blood_bank/models.py` → `COMPATIBILITY` dict.

**Bag expiry not running automatically** — set up Celery beat:

```python
# config/celery.py
app.conf.beat_schedule = {
    "expire-blood-bags-daily": {
        "task": "apps.blood_bank.tasks.expire_old_bags",
        "schedule": crontab(hour=2, minute=0),  # 2 AM daily
    },
}
```

(Or call `POST /api/blood-bank/expire-old-bags/` manually from the dashboard.)

## 10. What's next — Phase 3b roadmap

Phase 3b will add: **Ambulance, Dietary, Laundry, Gas Cylinder** — hospital operations modules. Same shape, similar zip drop-in.

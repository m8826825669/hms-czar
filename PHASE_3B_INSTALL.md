# HMS Phase 3b — Install Instructions

**Modules added:** Ambulance · Dietary · Laundry · Gas Cylinder

**Pre-requisites:** Phases 1a-3a installed and working.

---

## 1. Extract

Extract `hms_phase3b.zip` over `D:\hms_phase0\hms\`. Structure:

```
backend/apps/ambulance/
backend/apps/dietary/
backend/apps/laundry/
backend/apps/gas_cylinder/
backend/config/urls.py
frontend/src/types/phase3b.ts
frontend/src/lib/api/phase3b.ts
frontend/src/app/dashboard/ambulance/...
frontend/src/app/dashboard/dietary/...
frontend/src/app/dashboard/laundry/...
frontend/src/app/dashboard/gas-cylinder/...
PHASE_3B_INSTALL.md
```

## 2. `config/urls.py`

If customized, back it up and add only these four lines to `urlpatterns`:

```python
path("api/ambulance/",     include("apps.ambulance.urls")),
path("api/dietary/",       include("apps.dietary.urls")),
path("api/laundry/",       include("apps.laundry.urls")),
path("api/gas-cylinder/",  include("apps.gas_cylinder.urls")),
```

## 3. `INSTALLED_APPS`

Add to `backend/config/settings.py`:

```python
INSTALLED_APPS = [
    # ... existing ...
    "apps.ambulance",
    "apps.dietary",
    "apps.laundry",
    "apps.gas_cylinder",
]
```

**Load order:** these reference `apps.ipd`, `apps.billing`, `apps.specialist`, `apps.department` via FK — those must appear before the new apps.

## 4. Migrations

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
python manage.py makemigrations ambulance dietary laundry gas_cylinder
python manage.py migrate
```

## 5. Seed

```powershell
python manage.py seed_phase3b_ambulance        # 5 ambulances, 7 drivers
python manage.py seed_phase3b_dietary          # 8 diet types, 24 meal items
python manage.py seed_phase3b_laundry          # 8 linen items, 1 sample batch
python manage.py seed_phase3b_gas_cylinder     # 7 cylinder types, 13 cylinders
```

To wipe and re-seed any module, add `--reset`.

## 6. Frontend sidebar links

```tsx
<NavLink href="/dashboard/ambulance">Ambulance</NavLink>
<NavLink href="/dashboard/dietary">Dietary</NavLink>
<NavLink href="/dashboard/laundry">Laundry</NavLink>
<NavLink href="/dashboard/gas-cylinder">Gas Cylinders</NavLink>
```

## 7. End-to-end test scenarios

**Ambulance dispatch flow:**

1. `/dashboard/ambulance` → "+ New Dispatch"
2. Fill caller info, pickup address, chief complaint → "Create Dispatch"
3. On detail page, sidebar "Quick Assign" → pick available ambulance + driver → Assign
4. Click "Start En-route" → "Arrived On Scene" → "Patient Picked Up" → "Arrived at Hospital" → "Mark Complete"
5. Once completed (and patient is linked), click "Generate Bill", enter distance km → invoice created

**Dietary kitchen production:**

1. Create an IPD admission (Phase 2c)
2. In admin or via API POST `/api/dietary/diet-plans/`, create a DietPlan
3. `/dashboard/dietary` → click "Auto-generate Meals" — creates PatientMeal rows for all active plans
4. View kitchen production sheet broken down by meal type with quantities

**Laundry batch flow:**

1. `/dashboard/laundry` → tab "Laundry Batches"
2. (For now, batches must be created via admin / API; UI form is at `/api/laundry/batches/` POST)
3. On a COLLECTED batch, click "Send to Laundry" → status SENT
4. Use API `POST /api/laundry/batches/{id}/receive-back/` to mark RECEIVED

**Gas cylinder issue/return:**

1. `/dashboard/gas-cylinder` → tab "All Cylinders"
2. On any AVAILABLE cylinder, click "Actions" → "Issue" → enter location → IN_USE
3. To return, click "Actions" → "Return" → enter fill % → updates inventory
4. Tab "Inventory Summary" — see stock matrix + hydro-test alerts

## 8. Troubleshooting

**`apps.dietary` admin shows no DietType options** — Run the seed: `python manage.py seed_phase3b_dietary`.

**Auto-generate Meals creates 0 meals** — There must be at least one ACTIVE DietPlan; check `/api/dietary/diet-plans/`.

**Dispatch "Cannot bill" error** — The dispatch must have `patient` (registered) set, not just `patient_name_temp`. Update the Dispatch in admin to link a Patient record first.

**Hydro test alerts not appearing** — Set `next_hydro_test_due` on cylinders in admin; alerts fire ≤30 days ahead.

## 9. What's next — Phase 4 roadmap

* **4a:** Inventory/Stores + Asset Register + Housekeeping
* **4b:** HR + Payroll + Attendance + Security
* **4c:** Insurance/TPA + Vaccination + Complaints/Feedback
* **4d:** Analytics dashboard + cross-module reports + go-live checklist

# Data Migration Playbook — Legacy → HMS Phase 0–4d

This playbook covers the one-time migration of operational data from a
legacy hospital system (Excel sheets, an older HIS, or a custom DB) into
the new HMS. The goal is a clean, idempotent migration that can be
re-run safely up to the cutover moment.

## Principles

1. **One entity at a time, in dependency order.** Hospital → Department → User → Doctor → Patient → Service → Inventory → Encounters → Invoices.
2. **Idempotent.** Each migration script must be safe to re-run; use `get_or_create` keyed on a stable legacy ID.
3. **Map, don't overwrite.** Keep an `external_id` field on every imported row that holds the legacy primary key. Use it for cross-reference resolution.
4. **Validate after each phase.** Row-count and total-value SQL checks must match before moving to the next entity.
5. **Dry-run first.** Run every script with `--dry-run` against staging before cutover day.

## Extraction strategy

| Legacy format | Recommended approach |
|---------------|----------------------|
| Excel / CSV   | Place files in `migration/data/`; load with `pandas.read_excel`/`read_csv` |
| MySQL/PG dump | `pg_restore` to a separate staging DB, query directly via `psycopg2` |
| Custom DB     | Export views to CSV first; treat as Excel case |
| Paper records | Manual data entry post-cutover; migrate only the *outstanding* balance |

## Entity-by-entity order

### Step 1 — Master data

#### 1.1 Hospitals + Departments

```python
# migration/01_hospitals.py
from apps.core.models import Hospital
from apps.department.models import Department

h, _ = Hospital.objects.get_or_create(
    code="HOSP01",
    defaults={"name": "City Hospital, Ghaziabad", "gstin": "09AAACX0000A1Z5"},
)
for code, name in [("OPD","Out-patient"),("IPD","In-patient"),("PHARMACY","Pharmacy"),
                   ("LAB","Lab"),("OT","Operation Theatre"),("RAD","Radiology")]:
    Department.objects.get_or_create(hospital=h, code=code, defaults={"name": name})
```

#### 1.2 Users + Doctors

```python
# migration/02_users_doctors.py
import pandas as pd
from django.contrib.auth import get_user_model
from apps.specialist.models import Doctor

User = get_user_model()
df = pd.read_excel("migration/data/doctors.xlsx")

for _, row in df.iterrows():
    user, _ = User.objects.get_or_create(
        username=row["email"],
        defaults={
            "email": row["email"],
            "first_name": row["first_name"],
            "last_name": row["last_name"],
        },
    )
    Doctor.objects.update_or_create(
        external_id=row["legacy_id"],
        defaults={
            "user": user,
            "specialty": row["specialty"],
            "registration_number": row["mci_reg"],
            "consultation_fee": row["consultation_fee"],
            "hospital_id": 1,
        },
    )
```

#### 1.3 Service catalogue

```python
# migration/03_services.py
df = pd.read_excel("migration/data/services.xlsx")
for _, r in df.iterrows():
    ServiceCatalog.objects.update_or_create(
        external_id=r["legacy_id"],
        defaults={
            "code": r["code"], "name": r["name"], "price": r["price"],
            "gst_rate": r["gst_rate"], "department_id": dept_map[r["dept_code"]],
        },
    )
```

### Step 2 — Operational data

#### 2.1 Patients

```python
# migration/04_patients.py
df = pd.read_csv("migration/data/patients.csv")
for _, r in df.iterrows():
    Patient.objects.update_or_create(
        external_id=r["legacy_id"],
        defaults={
            "first_name": r["first_name"], "last_name": r["last_name"],
            "dob": parse_date(r["dob"]), "gender": r["gender"],
            "phone": r["phone"], "email": r.get("email") or "",
            "address": r.get("address") or "", "hospital_id": 1,
            "abha_id": r.get("abha_id") or "",
        },
    )
```

Validation: `SELECT count(*) FROM reception_patient` should equal the legacy patient count minus any documented exclusions.

#### 2.2 Inventory items + opening stock

```python
# migration/05_inventory.py
for _, r in pd.read_excel("migration/data/items.xlsx").iterrows():
    item, _ = InventoryItem.objects.update_or_create(
        external_id=r["legacy_id"],
        defaults={"code": r["code"], "name": r["name"], "unit": r["unit"], "hospital_id": 1},
    )
# Opening stock as a single GRN with date = cutover_date - 1
```

#### 2.3 Employees

```python
# migration/06_employees.py
for _, r in pd.read_excel("migration/data/employees.xlsx").iterrows():
    Employee.objects.update_or_create(
        employee_code=r["emp_code"],
        defaults={
            "first_name": r["first_name"], "last_name": r["last_name"],
            "department_id": dept_map[r["dept_code"]],
            "designation": r["designation"], "date_of_joining": parse_date(r["doj"]),
            "status": "ACTIVE", "hospital_id": 1,
        },
    )
```

### Step 3 — Open balances (cutover day only)

Migrate only **open** transactions, not historical:

- IPD admissions where `discharge_date IS NULL`
- Invoices where `status IN ('PENDING','PARTIAL')`
- Insurance claims where `status NOT IN ('SETTLED','REJECTED')`
- Open complaints

Historical data stays in the legacy system, kept read-only for reference.

## ID mapping tables

For every migrated entity, the migration script records the mapping:

```python
# migration/utils.py
class IDMap(models.Model):
    entity = models.CharField(max_length=40)
    legacy_id = models.CharField(max_length=80)
    new_id = models.BigIntegerField()
    class Meta:
        unique_together = ("entity", "legacy_id")
```

This makes cross-reference resolution explicit and auditable.

## Validation queries

```sql
-- Counts
SELECT 'patients' AS entity, count(*) FROM reception_patient UNION ALL
SELECT 'doctors',  count(*) FROM specialist_doctor UNION ALL
SELECT 'services', count(*) FROM billing_servicecatalog UNION ALL
SELECT 'items',    count(*) FROM inventory_inventoryitem UNION ALL
SELECT 'employees',count(*) FROM hr_employee UNION ALL
SELECT 'open_admissions', count(*) FROM ipd_admission WHERE discharge_date IS NULL UNION ALL
SELECT 'open_invoices',   count(*) FROM billing_invoice WHERE status IN ('PENDING','PARTIAL');

-- Total open AR (must match legacy AR statement)
SELECT sum(grand_total - amount_paid) AS open_ar
FROM billing_invoice
WHERE status NOT IN ('PAID','CANCELLED','REFUNDED');

-- Stock value (must match legacy stock register)
SELECT sum(quantity * cost_per_unit) AS stock_value
FROM pharmacy_batch
WHERE expiry_date >= current_date;
```

## Rollback

If any validation fails by more than 0.5 %:

1. Stop the migration scripts.
2. Truncate the affected tables (in reverse dependency order).
3. Investigate the discrepancy with the legacy system owner.
4. Re-run only the failed step. The idempotent design means no partial state.

If a *post-migration* discrepancy is discovered after cutover, do not retry the migration — adjust through normal operational entries (manual journal voucher, stock adjustment) and document the variance.

## Cutover-day timeline

| Time | Activity |
|------|----------|
| T-3 days | Final dry-run on staging |
| T-1 day  | Migrate master data (steps 1.1 – 1.3) |
| T-12 hr  | Migrate patients and employees |
| T-2 hr   | Legacy freeze; export final open transactions |
| T-30 min | Run step 3 (open balances) |
| T-0      | Validation queries; smoke test |
| T+0      | Go-live announcement |

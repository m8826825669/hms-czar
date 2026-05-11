# HMS Phase 4c — Install Instructions

**Modules added:** Insurance & TPA · Vaccination · Complaints & Feedback

**Pre-requisites:** Phases 1a–4b installed.

---

## 1. Extract

Extract `hms_phase4c.zip` over `D:\hms_phase0\hms\`.

```
backend/apps/insurance/
backend/apps/vaccination/
backend/apps/complaints/
backend/config/urls.py
frontend/src/types/phase4c.ts
frontend/src/lib/api/phase4c.ts
frontend/src/app/dashboard/insurance/
frontend/src/app/dashboard/vaccination/
frontend/src/app/dashboard/complaints/
```

## 2. `INSTALLED_APPS`

```python
INSTALLED_APPS = [
    # ... existing ...
    "apps.insurance",
    "apps.vaccination",
    "apps.complaints",
]
```

## 3. `config/urls.py`

```python
path("api/insurance/",   include("apps.insurance.urls")),
path("api/vaccination/", include("apps.vaccination.urls")),
path("api/complaints/",  include("apps.complaints.urls")),
```

## 4. Migrate

```powershell
cd backend
.\venv\Scripts\Activate.ps1
python manage.py makemigrations insurance vaccination complaints
python manage.py migrate
```

## 5. Seed

```powershell
python manage.py seed_phase4c_insurance      # 10 insurers, 6 TPAs (Star/HDFC/ICICI/CGHS/Ayushman + Medi Assist/Paramount etc)
python manage.py seed_phase4c_vaccination    # 18 vaccines + 35 IAP schedule entries (BCG-OPV-DPT-HEP-MMR-COVID etc)
python manage.py seed_phase4c_complaints     # categories + sample tickets + NPS responses
```

## 6. Frontend sidebar

```tsx
<NavLink href="/dashboard/insurance">Insurance</NavLink>
<NavLink href="/dashboard/vaccination">Vaccination</NavLink>
<NavLink href="/dashboard/complaints">Complaints</NavLink>
```

## 7. End-to-end scenarios

**Insurance — Pre-auth + claim:**

1. Admin → Insurance → Policies → create policy for a patient (link insurance company)
2. Admin → Pre-Auths → Add → fill diagnosis + treatment plan + requested_amount
3. `/dashboard/insurance` → see pending pre-auth → click Approve → enter approved amount
4. Admin → Claims → Add → link policy + invoice + bill_amount/co_pay/deductions
5. Auto-computes claim_amount = bill - co_pay - deductions
6. POST `/api/insurance/claims/{id}/settle/` with `settled_amount` → marks SETTLED

**Vaccination — Administer + history:**

1. Admin → Vaccination → Records → Add → pick patient + vaccine + dose_number
2. Save → certificate auto-generated with VC-YYYYMMDD-NNNN number
3. `/dashboard/vaccination` → enter patient ID → see full immunization history + due/overdue list (IAP schedule-based)
4. UIP vaccines (BCG/OPV/DPT/Measles/Hep B/Rota/IPV/PCV) are free; private ones (HPV ₹3500, PCV ₹3500, Varicella ₹1800) have prices

**Complaints — Ticket workflow:**

1. POST `/api/complaints/tickets/` with category + title + description + reporter_name
2. SLA target auto-set based on category.target_resolution_hours
3. `/dashboard/complaints` → see open ticket → click Resolve → enter resolution
4. Ticket → RESOLVED; if past SLA target, `is_sla_breached=true`
5. Click Close → status → CLOSED with timestamp
6. POST `/api/complaints/nps/` with score 0-10 → NPS computed: %promoters (9-10) minus %detractors (0-6)

## 8. Troubleshooting

* **NPS = 0 with empty data** — `nps_metrics` returns zeros when no responses exist. Submit a few via POST to test.
* **Pre-auth `submit` fails with "DRAFT"** — pre-auths auto-submit on create. To save as draft, use admin and edit status field.
* **Vaccination history misses scheduled doses** — `get_due_vaccinations` requires `patient.date_of_birth` to be set. Check patient profile.
* **`No Hospital found`** — re-run Phase 1a core seed first.

## 9. What's next

* **4d:** Analytics dashboard + cross-module reports + go-live checklist

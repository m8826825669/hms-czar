# HMS Phase 4b — Install Instructions

**Modules added:** HR · Payroll · Attendance · Security

**Pre-requisites:** Phases 1a–4a installed.

---

## 1. Extract

Extract `hms_phase4b.zip` over `D:\hms_phase0\hms\`.

```
backend/apps/hr/
backend/apps/payroll/
backend/apps/attendance/
backend/apps/security_module/
backend/config/urls.py
frontend/src/types/phase4b.ts
frontend/src/lib/api/phase4b.ts
frontend/src/app/dashboard/hr/
frontend/src/app/dashboard/payroll/
frontend/src/app/dashboard/attendance/
frontend/src/app/dashboard/security/
```

## 2. `INSTALLED_APPS`

```python
INSTALLED_APPS = [
    # ... existing ...
    "apps.hr",
    "apps.payroll",
    "apps.attendance",
    "apps.security_module",
]
```

## 3. `config/urls.py`

```python
path("api/hr/",         include("apps.hr.urls")),
path("api/payroll/",    include("apps.payroll.urls")),
path("api/attendance/", include("apps.attendance.urls")),
path("api/security/",   include("apps.security_module.urls")),
```

## 4. Migrate

```powershell
cd backend
.\venv\Scripts\Activate.ps1
python manage.py makemigrations hr payroll attendance security_module
python manage.py migrate
```

## 5. Seed

```powershell
python manage.py seed_phase4b_hr                      # 18 designations, 6 leave types, 20 employees (Indian names)
python manage.py seed_phase4b_payroll --structures    # 11 components + auto-generate structures for all employees
python manage.py seed_phase4b_attendance              # 5 shifts, 8 2026 holidays
python manage.py seed_phase4b_security                # 6 guards + sample passes/incidents
```

## 6. Frontend sidebar

```tsx
<NavLink href="/dashboard/hr">HR</NavLink>
<NavLink href="/dashboard/payroll">Payroll</NavLink>
<NavLink href="/dashboard/attendance">Attendance</NavLink>
<NavLink href="/dashboard/security">Security</NavLink>
```

## 7. End-to-end scenarios

**HR — Onboard + leave flow:**

1. `/dashboard/hr` → see 20 seeded employees
2. Admin → HR → Leave Requests → Add → pick employee + leave_type + dates
3. `/dashboard/hr` → see pending request → Approve / Reject
4. Admin → Leave Balances → see `used` incremented, `pending` decremented

**Payroll — Monthly run:**

1. `/dashboard/payroll` → click "Create Run for [current month]"
2. Click "Process" → all active employees get payslips computed
3. Total Gross / Total Net populate
4. Click "Approve" → status → APPROVED
5. Click "Mark Paid" → status → PAID, all payslips → PAID
6. Click any run row → see individual payslips with earnings + deductions breakdown

**Attendance — Punch in/out:**

1. `/dashboard/attendance` → select employee from dropdown
2. Click "Punch IN" → log created, DailyAttendance auto-created with check_in_time
3. Click "Punch OUT" → check_out_time set, hours_worked computed
4. Today's summary updates: Present count +1

**Security — Visitor / gate pass / incident:**

1. Admin → Security → Visitor Passes → Add → fill in visitor details
2. `/dashboard/security` → see active visitor → click "Log Exit" → status → EXITED
3. Admin → Gate Passes → Add → returnable, with vehicle number
4. `/dashboard/security` → click "Mark Returned" → status → RETURNED
5. Admin → Incidents → Add → severity HIGH → see on dashboard with critical badge

## 8. Troubleshooting

* **`SecurityModule` app label conflict** — the app uses `label = "security_module"` to avoid clashing with Django's contrib. Use that label in references.
* **No salary structure for employee** — run `seed_phase4b_payroll --structures` after seeding HR.
* **Payslip net pay = 0** — employee has no SalaryStructure assigned. Check admin → Payroll → Salary Structures.
* **Punch in/out doesn't update DailyAttendance** — punch_time must be on today's date.
* **`No Hospital found`** — re-run Phase 1a core seed first.

## 9. What's next

* **4c:** Insurance/TPA + Vaccination + Complaints/Feedback (next zip)
* **4d:** Analytics dashboard + cross-module reports + go-live checklist

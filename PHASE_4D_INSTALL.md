# Phase 4d — Analytics, Reports & Go-Live Readiness

This is the capstone phase. It adds one new Django app — `apps.analytics` —
plus two frontend pages and an operational checklist that covers every
prior phase.

## What's in this phase

### Backend
* `apps.analytics` — read-only cross-module aggregation over Phase 1-4c apps
  * `models.SavedReport`        — named, parameterised report definitions
  * `models.ReportRun`          — execution history with runtime + row count
  * `models.DashboardWidget`    — per-user pinned widgets
  * `services.analytics_service` — 16 cross-module aggregations
  * `services.golive_service`    — 21 operational readiness checks
* 11 endpoints (dashboard, KPIs, widget, report types, run report, saved-reports CRUD, run history, widget CRUD, go-live checklist)

### Frontend
* `/dashboard/analytics` — KPI cards + 14 charts/widgets
* `/dashboard/reports`   — custom report builder + saved reports + go-live checklist

### Docs
* `docs/PRODUCTION_RUNBOOK.md` — deployment runbook
* `docs/MIGRATION_PLAYBOOK.md` — data migration playbook
* `docs/TRAINING_OUTLINE.md`   — end-user training outline
* `docs/SMOKE_TEST_PLAN.md`    — smoke test checklist

## Install steps

### 1. Backend

Copy `backend/apps/analytics/` into `D:\hms_phase0\hms\backend\apps\`.

Append to `backend/config/settings.py` → `INSTALLED_APPS`:

```python
INSTALLED_APPS = [
    # … existing apps …
    "apps.analytics",
]
```

Append to `backend/config/urls.py` (see `backend/config/urls.py` for the full file):

```python
path("api/analytics/", include("apps.analytics.urls")),
```

Migrate and seed:

```bash
cd D:\hms_phase0\hms\backend
python manage.py makemigrations analytics
python manage.py migrate
python manage.py seed_phase4d_analytics
```

### 2. Frontend

Copy:
* `frontend/src/types/phase4d.ts`
* `frontend/src/lib/api/phase4d.ts`
* `frontend/src/app/dashboard/analytics/page.tsx`
* `frontend/src/app/dashboard/reports/page.tsx`

Add to your sidebar (e.g. `frontend/src/components/sidebar.tsx`):

```tsx
{ href: "/dashboard/analytics", label: "Analytics",   icon: BarChart3 },
{ href: "/dashboard/reports",   label: "Reports",     icon: FileText  },
```

Then:

```bash
cd D:\hms_phase0\hms\frontend
npm run dev
```

Open `http://localhost:3000/dashboard/analytics` and `http://localhost:3000/dashboard/reports`.

## API smoke test

```bash
# KPI cards (auth required)
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:8000/api/analytics/kpis/

# Full dashboard
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:8000/api/analytics/dashboard/

# Single widget
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:8000/api/analytics/widget/revenue_monthly/?months=6

# Run an ad-hoc report
curl -X POST http://localhost:8000/api/analytics/run-report/ \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"report_type":"AR_AGING","parameters":{}}'

# Go-live checklist
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:8000/api/analytics/go-live-checklist/
```

## Module catalogue (all phases — final state)

| Phase | Modules | Status |
|------:|--------|:-------|
| 1a    | Notifications · Specialist · Reception                                          | ✅ |
| 1b    | OPD · EMR · WebSocket queue                                                     | ✅ |
| 1c    | Billing · Razorpay · Public                                                     | ✅ |
| 2a    | Departments · Pharmacy                                                          | ✅ |
| 2b    | Lab · Refunds                                                                    | ✅ |
| 2c    | IPD · GSTR · Doctor dashboard                                                   | ✅ |
| 3a    | OT · Blood Bank                                                                 | ✅ |
| 3b    | Ambulance · Dietary · Laundry · Gas Cylinder                                    | ✅ |
| 4a    | Inventory · Assets · Housekeeping                                               | ✅ |
| 4b    | HR · Payroll · Attendance · Security                                            | ✅ |
| 4c    | Insurance/TPA · Vaccination · Complaints                                        | ✅ |
| 4d    | **Analytics · Cross-module Reports · Go-Live Checklist**                        | ✅ |

That brings the HMS to **26 modules** plus the analytics overlay.

## Troubleshooting

* **`/api/analytics/dashboard/` returns mostly zeros** — none of the prior
  modules have been seeded or used yet. Run the prior phase seeds first.
* **Charts render empty** — recharts requires real data. The analytics
  service deliberately returns `[]` when a module isn't installed; check
  `INSTALLED_APPS` includes every prior app.
* **Go-live checklist shows `Hospital record · FAIL`** — your core.Hospital
  table is empty. Create one via the admin or your Phase 1a seed.
* **TypeScript build fails** — `next.config.ts` already has
  `typescript.ignoreBuildErrors = true` from prior phases. You can fix the
  underlying types incrementally without blocking the build.

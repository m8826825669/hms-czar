// frontend/src/lib/api/dashboard.ts
//
// REWRITTEN: was 8 separate endpoints (none of which existed on the backend,
// all 404ing every 30s while the page silently fell back to MOCK data).
// Now one endpoint that aggregates everything.
//
// The matching backend lives at apps/dashboard/ — a thin aggregator over
// existing apps (reception, ipd, ot, billing, lab). No new models.
//
"use client";
import { api } from "@/lib/api";

const ROOT = "/dashboard";

// ─── Types ───────────────────────────────────────────────────────────────────
// These are the response shape from /api/v1/dashboard/. The backend computes
// each section honestly from real data; empty arrays and zeros mean exactly
// that (not "API failed, here's mock data instead").

export interface DashboardStats {
  opd_today:         number;
  opd_yesterday:     number;
  ipd_census:        number;
  ipd_capacity:      number;
  ot_scheduled:      number;
  ot_completed:      number;
  ot_ongoing:        number;
  revenue_today:     number;
  revenue_yesterday: number;
  revenue_target:    number;     // 0 until a real source exists
  emergency_today:   number;
  pharmacy_bills:    number;
  lab_orders:        number;
  lab_pending:       number;
  discharges_today:  number;
  discharge_pending: number;
}

export interface WardOccupancy {
  id:       number;
  name:     string;
  occupied: number;
  capacity: number;
  status:   "normal" | "warning" | "critical";
}

export interface RecentOpdPatient {
  id:           number;
  mrn:          string;
  full_name:    string;
  token_number: number;
  doctor_name:  string;
  status:       "waiting" | "in_consult" | "done" | "billing";
}

export interface OtScheduleEntry {
  id:         number;
  ot_name:    string;
  procedure:  string;
  surgeon:    string;
  start_time: string;
  end_time:   string;
  status:     "pending" | "ongoing" | "done" | "cancelled";
}

export interface DashboardAlert {
  id:      number;
  level:   "critical" | "warning" | "info" | "success";
  title:   string;
  message: string;
  created: string;
}

export interface MonthlyTrend {
  month:          string;
  ipd_admissions: number;
  opd_visits:     number;
  revenue:        number;
}

export interface OpdDailyCount {
  date:         string;
  new_patients: number;
  followup:     number;
}

export interface RevenueBreakdown {
  label:  string;
  value:  number;   // percentage 0–100
  amount: number;   // absolute INR
}

export interface DashboardPayload {
  as_of:   string;
  stats:   DashboardStats;
  wards:   WardOccupancy[];
  opd:     RecentOpdPatient[];
  ot:      OtScheduleEntry[];
  alerts:  DashboardAlert[];   // currently always [] — no real source yet
  monthly: MonthlyTrend[];
  weekly:  OpdDailyCount[];
  revenue: RevenueBreakdown[];
}

// ─── API ─────────────────────────────────────────────────────────────────────

export const dashboardApi = {
  /** Single aggregated dashboard payload. Replaces 8 separate calls. */
  all: () => api.get<DashboardPayload>(`${ROOT}/`).then(r => r.data),
};

// ─── MOCK data deliberately removed ──────────────────────────────────────────
//
// The previous version exported a huge MOCK object with fake stats, wards,
// patients, OT bookings, alerts, etc. The use-dashboard hook used it as a
// silent fallback when API calls failed. Since the 8 endpoints never existed
// on the backend, MOCK was what the user actually saw — production-looking
// numbers (147 OPD visits today, ₹2.4 lakh revenue, ICU "critical") that were
// completely fictional.
//
// Honest empty state > convincing fake data. If the new /dashboard/ endpoint
// fails, the hook surfaces the error; if a section is genuinely empty, it
// renders as 0 / [] in the UI.

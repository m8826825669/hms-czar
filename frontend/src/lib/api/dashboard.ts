// frontend/src/lib/api/dashboard.ts
"use client";
import { api } from "@/lib/api";

const ROOT = "/dashboard";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DashboardStats {
  opd_today:        number;
  ipd_census:       number;
  ipd_capacity:     number;
  ot_scheduled:     number;
  ot_completed:     number;
  ot_ongoing:       number;
  revenue_today:    number;
  revenue_target:   number;
  emergency_today:  number;
  pharmacy_bills:   number;
  lab_orders:       number;
  lab_pending:      number;
  discharges_today: number;
  discharge_pending:number;
  opd_yesterday:    number;
  revenue_yesterday:number;
}

export interface WardOccupancy {
  id:       number;
  name:     string;
  occupied: number;
  capacity: number;
  status:   "normal" | "warning" | "critical";
}

export interface RecentOpdPatient {
  id:          number;
  mrn:         string;
  full_name:   string;
  token_number:number;
  doctor_name: string;
  status:      "waiting" | "in_consult" | "done" | "billing";
}

export interface OtScheduleEntry {
  id:          number;
  ot_name:     string;
  procedure:   string;
  surgeon:     string;
  start_time:  string;
  end_time:    string;
  status:      "pending" | "ongoing" | "done" | "cancelled";
}

export interface DashboardAlert {
  id:       number;
  level:    "critical" | "warning" | "info" | "success";
  title:    string;
  message:  string;
  created:  string;
}

export interface MonthlyTrend {
  month:         string;
  ipd_admissions:number;
  opd_visits:    number;
  revenue:       number;
}

export interface OpdDailyCount {
  date:       string;
  new_patients: number;
  followup:     number;
}

export interface RevenueBreakdown {
  label:      string;
  value:      number;
  amount:     number;
}

// ─── API calls ───────────────────────────────────────────────────────────────

export const dashboardApi = {
  stats: () =>
    api.get<DashboardStats>(`${ROOT}/stats/`).then(r => r.data),
  wardOccupancy: () =>
    api.get<WardOccupancy[]>(`${ROOT}/ward-occupancy/`).then(r => r.data),
  recentOpd: () =>
    api.get<RecentOpdPatient[]>(`${ROOT}/recent-opd/`).then(r => r.data),
  otSchedule: () =>
    api.get<OtScheduleEntry[]>(`${ROOT}/ot-schedule/`).then(r => r.data),
  alerts: () =>
    api.get<DashboardAlert[]>(`${ROOT}/alerts/`).then(r => r.data),
  monthlyTrend: () =>
    api.get<MonthlyTrend[]>(`${ROOT}/monthly-trend/`).then(r => r.data),
  opdWeekly: () =>
    api.get<OpdDailyCount[]>(`${ROOT}/opd-weekly/`).then(r => r.data),
  revenueBreakdown: () =>
    api.get<RevenueBreakdown[]>(`${ROOT}/revenue-breakdown/`).then(r => r.data),
};

// ─── Fallback mock data ──────────────────────────────────────────────────────

export const MOCK: {
  stats: DashboardStats;
  wards: WardOccupancy[];
  opd: RecentOpdPatient[];
  ot: OtScheduleEntry[];
  alerts: DashboardAlert[];
  monthly: MonthlyTrend[];
  weekly: OpdDailyCount[];
  revenue: RevenueBreakdown[];
} = {
  stats: {
    opd_today: 147,       opd_yesterday: 131,
    ipd_census: 83,       ipd_capacity: 120,
    ot_scheduled: 9,      ot_completed: 3,  ot_ongoing: 4,
    revenue_today: 240000,revenue_target: 220000, revenue_yesterday: 222000,
    emergency_today: 14,  pharmacy_bills: 312,
    lab_orders: 89,       lab_pending: 23,
    discharges_today: 11, discharge_pending: 3,
  },
  wards: [
    { id:1, name:"General Ward",  occupied:38, capacity:50, status:"warning"  },
    { id:2, name:"ICU / ICCU",    occupied:8,  capacity:10, status:"critical" },
    { id:3, name:"Maternity",     occupied:12, capacity:20, status:"normal"   },
    { id:4, name:"Pediatrics",    occupied:10, capacity:20, status:"normal"   },
    { id:5, name:"Surgical",      occupied:15, capacity:20, status:"warning"  },
    { id:6, name:"Private Rooms", occupied:8,  capacity:10, status:"warning"  },
  ],
  opd: [
    { id:1, mrn:"MRN-00482", full_name:"Ramesh Kumar",  token_number:147, doctor_name:"Dr. Sharma", status:"done"       },
    { id:2, mrn:"MRN-00389", full_name:"Priya Devi",    token_number:146, doctor_name:"Dr. Mehta",  status:"in_consult" },
    { id:3, mrn:"MRN-00501", full_name:"Arun Singh",    token_number:145, doctor_name:"Dr. Gupta",  status:"waiting"    },
    { id:4, mrn:"MRN-00271", full_name:"Sunita Joshi",  token_number:144, doctor_name:"Dr. Sharma", status:"done"       },
    { id:5, mrn:"MRN-00198", full_name:"Mohan Kaul",    token_number:143, doctor_name:"Dr. Patel",  status:"billing"    },
  ],
  ot: [
    { id:1, ot_name:"OT-1", procedure:"Appendectomy",    surgeon:"Dr. Arora",  start_time:"08:00", end_time:"10:00", status:"done"    },
    { id:2, ot_name:"OT-2", procedure:"Knee Replacement", surgeon:"Dr. Kapoor", start_time:"09:30", end_time:"13:30", status:"ongoing" },
    { id:3, ot_name:"OT-1", procedure:"Cholecystectomy",  surgeon:"Dr. Arora",  start_time:"11:00", end_time:"13:00", status:"ongoing" },
    { id:4, ot_name:"OT-3", procedure:"C-Section",        surgeon:"Dr. Rao",    start_time:"14:00", end_time:"16:00", status:"pending" },
    { id:5, ot_name:"OT-2", procedure:"CABG",             surgeon:"Dr. Kapoor", start_time:"15:00", end_time:"19:00", status:"pending" },
  ],
  alerts: [
    { id:1, level:"critical", title:"ICU Bed 3 — critical vitals",     message:"Patient MRN-00341 · O₂ sat 88% · 10 min ago",      created:"" },
    { id:2, level:"critical", title:"Blood stock critical — B−",        message:"Blood bank · Only 2 units remaining",               created:"" },
    { id:3, level:"warning",  title:"5 discharge summaries pending",    message:"Ward A · Patients waiting since 10:00 AM",          created:"" },
    { id:4, level:"warning",  title:"Lab results — 23 pending",         message:"Avg TAT exceeded by 40 min",                        created:"" },
    { id:5, level:"info",     title:"Pharmacy low stock — 5 items",     message:"Paracetamol, Amoxicillin +3 need reorder",          created:"" },
    { id:6, level:"success",  title:"OT-2 maintenance scheduled",       message:"Tomorrow 06:00–08:00 AM · Biomedical team",         created:"" },
  ],
  monthly: [
    { month:"Jan", ipd_admissions:310, opd_visits:2800, revenue:42 },
    { month:"Feb", ipd_admissions:295, opd_visits:2650, revenue:39 },
    { month:"Mar", ipd_admissions:342, opd_visits:3100, revenue:48 },
    { month:"Apr", ipd_admissions:388, opd_visits:3450, revenue:55 },
    { month:"May", ipd_admissions:421, opd_visits:3800, revenue:61 },
  ],
  weekly: [
    { date:"Mon 6",  new_patients:52, followup:68 },
    { date:"Tue 7",  new_patients:61, followup:74 },
    { date:"Wed 8",  new_patients:48, followup:65 },
    { date:"Thu 9",  new_patients:65, followup:82 },
    { date:"Fri 10", new_patients:58, followup:71 },
    { date:"Sat 11", new_patients:40, followup:52 },
    { date:"Sun 12", new_patients:44, followup:62 },
  ],
  revenue: [
    { label:"OPD",      value:32, amount:76800  },
    { label:"IPD",      value:28, amount:67200  },
    { label:"OT",       value:22, amount:52800  },
    { label:"Lab",      value:10, amount:24000  },
    { label:"Pharmacy", value:8,  amount:19200  },
  ],
};

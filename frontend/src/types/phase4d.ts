// Phase 4d — Analytics, Reports, Go-Live readiness

export interface KPICards {
  as_of: string;
  today_opd_visits: number;
  today_admissions: number;
  today_discharges: number;
  occupied_beds: number;
  total_beds: number;
  occupancy_pct: number;
  today_ot_cases: number;
  today_lab_orders: number;
  today_pharmacy_sales: number;
  today_revenue: number;
  ar_outstanding: number;
  blood_units_in_stock: number;
  active_staff: number;
  open_complaints: number;
}

export interface RevenueMonthlyPoint {
  month: string;
  revenue: number;
  invoices: number;
}

export interface OPDVolumePoint {
  date: string;
  visits: number;
}

export interface DepartmentRevenue {
  department: string;
  revenue: number;
}

export interface OTUtilization {
  theatre: string;
  cases: number;
}

export interface WardOccupancy {
  ward: string;
  total: number;
  occupied: number;
  occupancy_pct: number;
}

export interface ARBucket {
  bucket: string;
  amount: number;
  count: number;
}

export interface ARAging {
  buckets: ARBucket[];
}

export interface DiagnosisCount {
  diagnosis: string;
  count: number;
}

export interface BloodInventoryRow {
  blood_group: string;
  units: number;
}

export interface HeadcountRow {
  department: string;
  headcount: number;
}

export interface AttendanceSummary {
  present: number;
  absent: number;
  late: number;
  on_leave: number;
  half_day: number;
  unmarked: number;
}

export interface PharmacyTurnoverPoint {
  month: string;
  revenue: number;
  transactions: number;
}

export interface LabTurnoverPoint {
  month: string;
  orders: number;
}

export interface AssetCategoryBreakdown {
  category: string;
  acquisition_value: number;
  current_value: number;
  depreciation: number;
}

export interface AssetDepreciation {
  category_breakdown: AssetCategoryBreakdown[];
  totals: {
    acquisition_value: number;
    current_value: number;
    depreciation: number;
  };
}

export interface InsuranceByStatus {
  status: string;
  count: number;
}

export interface InsuranceByMonth {
  month: string;
  claims: number;
  amount: number;
}

export interface InsuranceClaimSummary {
  by_status: InsuranceByStatus[];
  by_month: InsuranceByMonth[];
}

export interface ComplaintsStatusRow {
  status: string;
  count: number;
}

export interface ComplaintsSLA {
  by_status: ComplaintsStatusRow[];
  avg_resolution_hours: number;
}

export interface DashboardPayload {
  kpis: KPICards;
  revenue_monthly: RevenueMonthlyPoint[];
  opd_volume: OPDVolumePoint[];
  revenue_by_dept: DepartmentRevenue[];
  ot_utilization: OTUtilization[];
  ipd_occupancy: WardOccupancy[];
  ar_aging: ARAging;
  top_diagnoses: DiagnosisCount[];
  blood_inventory: BloodInventoryRow[];
  hr_headcount: HeadcountRow[];
  attendance: AttendanceSummary;
  pharmacy_turn: PharmacyTurnoverPoint[];
  lab_turnover: LabTurnoverPoint[];
  asset_deprec: AssetDepreciation;
  insurance: InsuranceClaimSummary;
  complaints: ComplaintsSLA;
}

export interface ReportType {
  code: string;
  label: string;
}

export interface SavedReport {
  id: number;
  hospital: number;
  name: string;
  description: string;
  report_type: string;
  parameters: Record<string, unknown>;
  is_pinned: boolean;
  created_by: number | null;
  created_by_name: string;
  created_at: string;
  updated_at: string;
}

export interface ReportRun {
  id: number;
  report: number | null;
  report_name: string;
  report_type: string;
  parameters: Record<string, unknown>;
  status: "RUNNING" | "COMPLETED" | "FAILED";
  row_count: number;
  runtime_ms: number;
  error_message: string;
  run_by: number | null;
  run_by_name: string;
  started_at: string;
  finished_at: string | null;
}

export interface ReportRunResult<T = unknown> {
  run_id: number;
  report_type: string;
  parameters: Record<string, unknown>;
  row_count: number;
  runtime_ms: number;
  data: T;
}

export type GoLiveStatus = "PASS" | "WARN" | "FAIL";

export interface GoLiveRow {
  check: string;
  category: string;
  status: GoLiveStatus;
  message: string;
  action: string;
}

export interface GoLiveSummary {
  total: number;
  pass: number;
  warn: number;
  fail: number;
  ready_for_golive: boolean;
  readiness_pct: number;
}

export interface GoLiveReport {
  summary: GoLiveSummary;
  rows: GoLiveRow[];
}

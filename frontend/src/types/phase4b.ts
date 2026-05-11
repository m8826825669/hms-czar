// Phase 4b types — HR, Payroll, Attendance, Security

export interface Employee {
  id: number;
  employee_code: string;
  full_name: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  gender: string;
  designation: number;
  designation_title: string;
  department: number | null;
  department_name: string | null;
  employment_type: string;
  employment_type_label: string;
  date_of_joining: string;
  status: string;
  status_label: string;
  years_of_service: number;
}

export interface Designation {
  id: number;
  code: string;
  title: string;
  grade: string;
  grade_label: string;
  base_salary: string;
  is_active: boolean;
}

export interface LeaveType {
  id: number;
  code: string;
  name: string;
  days_per_year: string;
  is_paid: boolean;
  is_active: boolean;
}

export interface LeaveRequest {
  id: number;
  code: string;
  employee: number;
  employee_code: string;
  employee_name: string;
  leave_type: number;
  leave_type_code: string;
  leave_type_name: string;
  start_date: string;
  end_date: string;
  num_days: string;
  reason: string;
  status: string;
  status_label: string;
  applied_at: string;
}

export interface LeaveBalance {
  id: number;
  employee: number;
  employee_name: string;
  leave_type: number;
  leave_type_code: string;
  leave_type_name: string;
  year: number;
  allocated: string;
  used: string;
  pending: string;
  available: string;
}

export interface SalaryComponent {
  id: number;
  code: string;
  name: string;
  component_type: string;
  component_type_label: string;
  calculation_type: string;
  default_value: string;
  is_active: boolean;
}

export interface PayrollRun {
  id: number;
  code: string;
  year: number;
  month: number;
  status: string;
  status_label: string;
  total_employees: number;
  total_gross: string;
  total_deductions: string;
  total_net: string;
  processed_at: string | null;
  approved_at: string | null;
  paid_at: string | null;
}

export interface Payslip {
  id: number;
  code: string;
  employee_code: string;
  employee_name: string;
  payroll_run: number;
  days_worked: string;
  gross_earnings: string;
  gross_deductions: string;
  net_pay: string;
  status: string;
  status_label: string;
  lines?: PayslipLine[];
}

export interface PayslipLine {
  id: number;
  component_code: string;
  component_name: string;
  amount: string;
  is_earning: boolean;
}

export interface Shift {
  id: number;
  code: string;
  name: string;
  start_time: string;
  end_time: string;
  work_hours: string;
  is_night_shift: boolean;
}

export interface AttendanceLog {
  id: number;
  employee: number;
  employee_code: string;
  employee_name: string;
  punch_time: string;
  punch_type: "IN" | "OUT";
  punch_type_label: string;
  source: string;
}

export interface DailyAttendance {
  id: number;
  employee: number;
  employee_name: string;
  work_date: string;
  status: string;
  status_label: string;
  check_in_time: string | null;
  check_out_time: string | null;
  hours_worked: string;
}

export interface AttendanceTodaySummary {
  date: string;
  total_active_employees: number;
  counts: {
    present: number;
    absent: number;
    late: number;
    on_leave: number;
    half_day: number;
  };
  marked_total: number;
  unmarked: number;
}

export interface VisitorPass {
  id: number;
  pass_number: string;
  visitor_name: string;
  visitor_phone: string;
  visit_type: string;
  visit_type_label: string;
  purpose: string;
  visiting_patient_name: string | null;
  visiting_person: string;
  department_name: string | null;
  room_number: string;
  entry_time: string;
  expected_exit_time: string | null;
  actual_exit_time: string | null;
  status: string;
  status_label: string;
}

export interface GatePass {
  id: number;
  pass_number: string;
  pass_type: string;
  pass_type_label: string;
  items_description: string;
  purpose: string;
  issued_to_party: string;
  vehicle_number: string;
  issued_at: string;
  expected_return_at: string | null;
  actual_return_at: string | null;
  estimated_value: string;
  status: string;
  status_label: string;
}

export interface Incident {
  id: number;
  incident_number: string;
  incident_type: string;
  incident_type_label: string;
  severity: string;
  severity_label: string;
  status: string;
  status_label: string;
  occurred_at: string;
  location: string;
  title: string;
  description: string;
  estimated_loss: string;
  fir_number: string;
  police_involved: boolean;
}

export interface SecurityDashboard {
  active_visitors: number;
  visitors_today: number;
  open_gate_passes: number;
  recent_incidents: number;
  critical_incidents: number;
}

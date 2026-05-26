// frontend/src/lib/api/phase4b.ts
"use client";
import { api } from "@/lib/api";
import type {
  Employee, Designation, LeaveType, LeaveRequest, LeaveBalance,
  SalaryComponent, PayrollRun, Payslip,
  Shift, AttendanceLog, DailyAttendance, AttendanceTodaySummary,
  VisitorPass, GatePass, Incident, SecurityDashboard,
} from "@/types/phase4b";

// ─── HR ──────────────────────────────────────────────────────────────────────
const HR = "/hr";

export const employeesApi = {
  list: (params?: Record<string, unknown>) =>
    api.get<Employee[]>(`${HR}/employees/`, { params }).then(r => r.data),
  get: (id: number) =>
    api.get<Employee>(`${HR}/employees/${id}/`).then(r => r.data),
  create: (data: Partial<Employee>) =>
    api.post<Employee>(`${HR}/employees/`, data).then(r => r.data),
};

export const designationsApi = {
  list: () =>
    api.get<Designation[]>(`${HR}/designations/`).then(r => r.data),
};

export const leaveTypesApi = {
  list: () =>
    api.get<LeaveType[]>(`${HR}/leave-types/`).then(r => r.data),
};

export const leaveRequestsApi = {
  list: (params?: Record<string, unknown>) =>
    api.get<LeaveRequest[]>(`${HR}/leave-requests/`, { params }).then(r => r.data),
  create: (data: Partial<LeaveRequest>) =>
    api.post(`${HR}/leave-requests/`, data).then(r => r.data),
  approve: (id: number, data?: Record<string, unknown>) =>
    api.post(`${HR}/leave-requests/${id}/approve/`, data ?? {}).then(r => r.data),
  reject: (id: number, data?: Record<string, unknown>) =>
    api.post(`${HR}/leave-requests/${id}/reject/`, data ?? {}).then(r => r.data),
};

export const leaveBalancesApi = {
  list: (params?: Record<string, unknown>) =>
    api.get<LeaveBalance[]>(`${HR}/leave-balances/`, { params }).then(r => r.data),
};

// ─── Payroll ─────────────────────────────────────────────────────────────────
const PAY = "/payroll";

export const salaryComponentsApi = {
  list: () =>
    api.get<SalaryComponent[]>(`${PAY}/components/`).then(r => r.data),
};

export const payrollRunsApi = {
  list: () =>
    api.get<PayrollRun[]>(`${PAY}/runs/`).then(r => r.data),
  get: (id: number) =>
    api.get<PayrollRun>(`${PAY}/runs/${id}/`).then(r => r.data),
  create: (data: Partial<PayrollRun>) =>
    api.post<PayrollRun>(`${PAY}/runs/`, data).then(r => r.data),
  process: (id: number) =>
    api.post(`${PAY}/runs/${id}/process/`).then(r => r.data),
  approve: (id: number) =>
    api.post(`${PAY}/runs/${id}/approve/`).then(r => r.data),
  markPaid: (id: number) =>
    api.post(`${PAY}/runs/${id}/mark-paid/`).then(r => r.data),
};

export const payslipsApi = {
  list: (params?: Record<string, unknown>) =>
    api.get<Payslip[]>(`${PAY}/payslips/`, { params }).then(r => r.data),
  get: (id: number) =>
    api.get<Payslip>(`${PAY}/payslips/${id}/`).then(r => r.data),
};

// ─── Attendance ──────────────────────────────────────────────────────────────
const ATT = "/attendance";

export const shiftsApi = {
  list: () =>
    api.get<Shift[]>(`${ATT}/shifts/`).then(r => r.data),
};

export const attendanceLogsApi = {
  list: (params?: Record<string, unknown>) =>
    api.get<AttendanceLog[]>(`${ATT}/logs/`, { params }).then(r => r.data),
  punch: (data: { employee_id: number; punch_type: "IN" | "OUT"; source?: string }) =>
    api.post<AttendanceLog>(`${ATT}/logs/punch/`, data).then(r => r.data),
};

export const dailyAttendanceApi = {
  list: (params?: Record<string, unknown>) =>
    api.get<DailyAttendance[]>(`${ATT}/daily/`, { params }).then(r => r.data),
};

export const attendanceTodayApi = {
  summary: () =>
    api.get<AttendanceTodaySummary>(`${ATT}/today-summary/`).then(r => r.data),
};

// ─── Security ────────────────────────────────────────────────────────────────
const SEC = "/security";

export const visitorPassesApi = {
  list: (params?: Record<string, unknown>) =>
    api.get<VisitorPass[]>(`${SEC}/visitor-passes/`, { params }).then(r => r.data),
  create: (data: Partial<VisitorPass>) =>
    api.post<VisitorPass>(`${SEC}/visitor-passes/`, data).then(r => r.data),
  logExit: (id: number, data?: Record<string, unknown>) =>
    api.post(`${SEC}/visitor-passes/${id}/log-exit/`, data ?? {}).then(r => r.data),
};

export const gatePassesApi = {
  list: (params?: Record<string, unknown>) =>
    api.get<GatePass[]>(`${SEC}/gate-passes/`, { params }).then(r => r.data),
  create: (data: Partial<GatePass>) =>
    api.post<GatePass>(`${SEC}/gate-passes/`, data).then(r => r.data),
  markReturned: (id: number, data?: Record<string, unknown>) =>
    api.post(`${SEC}/gate-passes/${id}/mark-returned/`, data ?? {}).then(r => r.data),
};

export const incidentsApi = {
  list: (params?: Record<string, unknown>) =>
    api.get<Incident[]>(`${SEC}/incidents/`, { params }).then(r => r.data),
  create: (data: Partial<Incident>) =>
    api.post<Incident>(`${SEC}/incidents/`, data).then(r => r.data),
  escalate: (id: number, data?: Record<string, unknown>) =>
    api.post(`${SEC}/incidents/${id}/escalate/`, data ?? {}).then(r => r.data),
};

export const securityDashboardApi = {
  get: () =>
    api.get<SecurityDashboard>(`${SEC}/dashboard/`).then(r => r.data),
};

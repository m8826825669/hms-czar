import { apiClient } from "@/lib/api/client";
import type {
  Employee, Designation, LeaveType, LeaveRequest, LeaveBalance,
  SalaryComponent, PayrollRun, Payslip,
  Shift, AttendanceLog, DailyAttendance, AttendanceTodaySummary,
  VisitorPass, GatePass, Incident, SecurityDashboard,
} from "@/types/phase4b";

// HR
export const employeesApi = {
  list: (params?: Record<string, string>) =>
    apiClient.get<Employee[]>("/api/hr/employees/", { params }),
  get: (id: number) => apiClient.get<Employee>(`/api/hr/employees/${id}/`),
  create: (data: any) => apiClient.post<Employee>("/api/hr/employees/", data),
};
export const designationsApi = {
  list: () => apiClient.get<Designation[]>("/api/hr/designations/"),
};
export const leaveTypesApi = {
  list: () => apiClient.get<LeaveType[]>("/api/hr/leave-types/"),
};
export const leaveRequestsApi = {
  list: (params?: Record<string, string>) =>
    apiClient.get<LeaveRequest[]>("/api/hr/leave-requests/", { params }),
  create: (data: any) => apiClient.post("/api/hr/leave-requests/", data),
  approve: (id: number, data?: any) =>
    apiClient.post(`/api/hr/leave-requests/${id}/approve/`, data ?? {}),
  reject: (id: number, data?: any) =>
    apiClient.post(`/api/hr/leave-requests/${id}/reject/`, data ?? {}),
};
export const leaveBalancesApi = {
  list: (params?: Record<string, string>) =>
    apiClient.get<LeaveBalance[]>("/api/hr/leave-balances/", { params }),
};

// Payroll
export const salaryComponentsApi = {
  list: () => apiClient.get<SalaryComponent[]>("/api/payroll/components/"),
};
export const payrollRunsApi = {
  list: () => apiClient.get<PayrollRun[]>("/api/payroll/runs/"),
  get: (id: number) => apiClient.get<PayrollRun>(`/api/payroll/runs/${id}/`),
  create: (data: any) => apiClient.post<PayrollRun>("/api/payroll/runs/", data),
  process: (id: number) => apiClient.post(`/api/payroll/runs/${id}/process/`),
  approve: (id: number) => apiClient.post(`/api/payroll/runs/${id}/approve/`),
  markPaid: (id: number) => apiClient.post(`/api/payroll/runs/${id}/mark-paid/`),
};
export const payslipsApi = {
  list: (params?: Record<string, string>) =>
    apiClient.get<Payslip[]>("/api/payroll/payslips/", { params }),
  get: (id: number) => apiClient.get<Payslip>(`/api/payroll/payslips/${id}/`),
};

// Attendance
export const shiftsApi = {
  list: () => apiClient.get<Shift[]>("/api/attendance/shifts/"),
};
export const attendanceLogsApi = {
  list: (params?: Record<string, string>) =>
    apiClient.get<AttendanceLog[]>("/api/attendance/logs/", { params }),
  punch: (data: { employee_id: number; punch_type: "IN" | "OUT"; source?: string }) =>
    apiClient.post<AttendanceLog>("/api/attendance/logs/punch/", data),
};
export const dailyAttendanceApi = {
  list: (params?: Record<string, string>) =>
    apiClient.get<DailyAttendance[]>("/api/attendance/daily/", { params }),
};
export const attendanceTodayApi = {
  summary: () =>
    apiClient.get<AttendanceTodaySummary>("/api/attendance/today-summary/"),
};

// Security
export const visitorPassesApi = {
  list: (params?: Record<string, string>) =>
    apiClient.get<VisitorPass[]>("/api/security/visitor-passes/", { params }),
  create: (data: any) => apiClient.post<VisitorPass>("/api/security/visitor-passes/", data),
  logExit: (id: number, data?: any) =>
    apiClient.post(`/api/security/visitor-passes/${id}/log-exit/`, data ?? {}),
};
export const gatePassesApi = {
  list: (params?: Record<string, string>) =>
    apiClient.get<GatePass[]>("/api/security/gate-passes/", { params }),
  create: (data: any) => apiClient.post<GatePass>("/api/security/gate-passes/", data),
  markReturned: (id: number, data?: any) =>
    apiClient.post(`/api/security/gate-passes/${id}/mark-returned/`, data ?? {}),
};
export const incidentsApi = {
  list: (params?: Record<string, string>) =>
    apiClient.get<Incident[]>("/api/security/incidents/", { params }),
  create: (data: any) => apiClient.post<Incident>("/api/security/incidents/", data),
  escalate: (id: number, data?: any) =>
    apiClient.post(`/api/security/incidents/${id}/escalate/`, data ?? {}),
};
export const securityDashboardApi = {
  get: () => apiClient.get<SecurityDashboard>("/api/security/dashboard/"),
};

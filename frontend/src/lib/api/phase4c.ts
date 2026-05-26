// frontend/src/lib/api/phase4c.ts
"use client";
import { api } from "@/lib/api";
import type {
  InsuranceCompany, TPA, PolicyCoverage, PreAuth, Claim,
  Vaccine, VaccinationRecord,
  TicketCategory, Ticket, NPSResponse,
  TicketsDashboard, InsuranceDashboard,
} from "@/types/phase4c";

// ─── Insurance ───────────────────────────────────────────────────────────────
const INS = "/insurance";

export const insuranceCompaniesApi = {
  list: () =>
    api.get<InsuranceCompany[]>(`${INS}/companies/`).then(r => r.data),
};

export const tpasApi = {
  list: () =>
    api.get<TPA[]>(`${INS}/tpas/`).then(r => r.data),
};

export const policiesApi = {
  list: (params?: Record<string, unknown>) =>
    api.get<PolicyCoverage[]>(`${INS}/policies/`, { params }).then(r => r.data),
  create: (data: Partial<PolicyCoverage>) =>
    api.post<PolicyCoverage>(`${INS}/policies/`, data).then(r => r.data),
};

export const preAuthsApi = {
  list: (params?: Record<string, unknown>) =>
    api.get<PreAuth[]>(`${INS}/pre-auths/`, { params }).then(r => r.data),
  create: (data: Partial<PreAuth>) =>
    api.post<PreAuth>(`${INS}/pre-auths/`, data).then(r => r.data),
  approve: (id: number, data: Record<string, unknown>) =>
    api.post(`${INS}/pre-auths/${id}/approve/`, data).then(r => r.data),
  reject: (id: number, reason: string) =>
    api.post(`${INS}/pre-auths/${id}/reject/`, { reason }).then(r => r.data),
};

export const claimsApi = {
  list: (params?: Record<string, unknown>) =>
    api.get<Claim[]>(`${INS}/claims/`, { params }).then(r => r.data),
  create: (data: Partial<Claim>) =>
    api.post<Claim>(`${INS}/claims/`, data).then(r => r.data),
  settle: (id: number, data: Record<string, unknown>) =>
    api.post(`${INS}/claims/${id}/settle/`, data).then(r => r.data),
};

export const insuranceDashboardApi = {
  get: () =>
    api.get<InsuranceDashboard>(`${INS}/dashboard/`).then(r => r.data),
};

// ─── Vaccination ─────────────────────────────────────────────────────────────
const VAC = "/vaccination";

export const vaccinesApi = {
  list: () =>
    api.get<Vaccine[]>(`${VAC}/vaccines/`).then(r => r.data),
};

export const vaccinationRecordsApi = {
  list: (params?: Record<string, unknown>) =>
    api.get<VaccinationRecord[]>(`${VAC}/records/`, { params }).then(r => r.data),
  create: (data: Partial<VaccinationRecord>) =>
    api.post<VaccinationRecord>(`${VAC}/records/`, data).then(r => r.data),
};

export const patientVaccinationApi = {
  history: (patientId: number) =>
    api.get<{
      patient_id: number;
      patient_name: string;
      history: VaccinationRecord[];
      due_vaccinations: Array<{
        vaccine_code: string;
        vaccine_name: string;
        dose_number: number;
        due_age: string;
        overdue_days: number;
      }>;
    }>(`${VAC}/patient/${patientId}/history/`).then(r => r.data),
};

// ─── Complaints ──────────────────────────────────────────────────────────────
const CMP = "/complaints";

export const ticketCategoriesApi = {
  list: () =>
    api.get<TicketCategory[]>(`${CMP}/categories/`).then(r => r.data),
};

export const ticketsApi = {
  list: (params?: Record<string, unknown>) =>
    api.get<Ticket[]>(`${CMP}/tickets/`, { params }).then(r => r.data),
  get: (id: number) =>
    api.get<Ticket>(`${CMP}/tickets/${id}/`).then(r => r.data),
  create: (data: Partial<Ticket>) =>
    api.post<Ticket>(`${CMP}/tickets/`, data).then(r => r.data),
  assign: (id: number, user_id: number) =>
    api.post(`${CMP}/tickets/${id}/assign/`, { user_id }).then(r => r.data),
  addComment: (id: number, data: Record<string, unknown>) =>
    api.post(`${CMP}/tickets/${id}/add-comment/`, data).then(r => r.data),
  resolve: (id: number, resolution: string) =>
    api.post(`${CMP}/tickets/${id}/resolve/`, { resolution }).then(r => r.data),
  close: (id: number, satisfaction_rating?: number) =>
    api.post(`${CMP}/tickets/${id}/close/`, { satisfaction_rating }).then(r => r.data),
  reopen: (id: number, reason: string) =>
    api.post(`${CMP}/tickets/${id}/reopen/`, { reason }).then(r => r.data),
};

export const npsApi = {
  list: () =>
    api.get<NPSResponse[]>(`${CMP}/nps/`).then(r => r.data),
  submit: (data: Partial<NPSResponse>) =>
    api.post<NPSResponse>(`${CMP}/nps/`, data).then(r => r.data),
};

export const complaintsDashboardApi = {
  get: () =>
    api.get<TicketsDashboard>(`${CMP}/tickets-dashboard/`).then(r => r.data),
  npsMetrics: () =>
    api.get(`${CMP}/nps-metrics/`).then(r => r.data),
};

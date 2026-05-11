import { apiClient } from "@/lib/api/client";
import type {
  InsuranceCompany, TPA, PolicyCoverage, PreAuth, Claim,
  Vaccine, VaccinationRecord,
  TicketCategory, Ticket, NPSResponse,
  ComplaintsDashboard, InsuranceDashboard,
} from "@/types/phase4c";

// Insurance
export const insuranceCompaniesApi = {
  list: () => apiClient.get<InsuranceCompany[]>("/api/insurance/companies/"),
};
export const tpasApi = {
  list: () => apiClient.get<TPA[]>("/api/insurance/tpas/"),
};
export const policiesApi = {
  list: (params?: Record<string, string>) =>
    apiClient.get<PolicyCoverage[]>("/api/insurance/policies/", { params }),
  create: (data: any) => apiClient.post<PolicyCoverage>("/api/insurance/policies/", data),
};
export const preAuthsApi = {
  list: (params?: Record<string, string>) =>
    apiClient.get<PreAuth[]>("/api/insurance/pre-auths/", { params }),
  create: (data: any) => apiClient.post<PreAuth>("/api/insurance/pre-auths/", data),
  approve: (id: number, data: any) =>
    apiClient.post(`/api/insurance/pre-auths/${id}/approve/`, data),
  reject: (id: number, reason: string) =>
    apiClient.post(`/api/insurance/pre-auths/${id}/reject/`, { reason }),
};
export const claimsApi = {
  list: (params?: Record<string, string>) =>
    apiClient.get<Claim[]>("/api/insurance/claims/", { params }),
  create: (data: any) => apiClient.post<Claim>("/api/insurance/claims/", data),
  settle: (id: number, data: any) =>
    apiClient.post(`/api/insurance/claims/${id}/settle/`, data),
};
export const insuranceDashboardApi = {
  get: () => apiClient.get<InsuranceDashboard>("/api/insurance/dashboard/"),
};

// Vaccination
export const vaccinesApi = {
  list: () => apiClient.get<Vaccine[]>("/api/vaccination/vaccines/"),
};
export const vaccinationRecordsApi = {
  list: (params?: Record<string, string>) =>
    apiClient.get<VaccinationRecord[]>("/api/vaccination/records/", { params }),
  create: (data: any) =>
    apiClient.post<VaccinationRecord>("/api/vaccination/records/", data),
};
export const patientVaccinationApi = {
  history: (patientId: number) =>
    apiClient.get<{
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
    }>(`/api/vaccination/patient/${patientId}/history/`),
};

// Complaints
export const ticketCategoriesApi = {
  list: () => apiClient.get<TicketCategory[]>("/api/complaints/categories/"),
};
export const ticketsApi = {
  list: (params?: Record<string, string>) =>
    apiClient.get<Ticket[]>("/api/complaints/tickets/", { params }),
  get: (id: number) => apiClient.get<Ticket>(`/api/complaints/tickets/${id}/`),
  create: (data: any) => apiClient.post<Ticket>("/api/complaints/tickets/", data),
  assign: (id: number, user_id: number) =>
    apiClient.post(`/api/complaints/tickets/${id}/assign/`, { user_id }),
  addComment: (id: number, data: any) =>
    apiClient.post(`/api/complaints/tickets/${id}/add-comment/`, data),
  resolve: (id: number, resolution: string) =>
    apiClient.post(`/api/complaints/tickets/${id}/resolve/`, { resolution }),
  close: (id: number, satisfaction_rating?: number) =>
    apiClient.post(`/api/complaints/tickets/${id}/close/`,
                     { satisfaction_rating }),
  reopen: (id: number, reason: string) =>
    apiClient.post(`/api/complaints/tickets/${id}/reopen/`, { reason }),
};
export const npsApi = {
  list: () => apiClient.get<NPSResponse[]>("/api/complaints/nps/"),
  submit: (data: any) => apiClient.post<NPSResponse>("/api/complaints/nps/", data),
};
export const complaintsDashboardApi = {
  get: () => apiClient.get<ComplaintsDashboard>("/api/complaints/tickets-dashboard/"),
  npsMetrics: () => apiClient.get("/api/complaints/nps-metrics/"),
};

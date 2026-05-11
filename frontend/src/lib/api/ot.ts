import { apiClient } from "@/lib/api/client";
import type {
  OperationTheatre, SurgicalProcedure, SurgeryBooking,
  SurgeryTeamMember, OTConsumable, OTRegister, OTDashboard,
} from "@/types/ot";


export const theatresApi = {
  list: () => apiClient.get<OperationTheatre[]>("/api/ot/theatres/"),
  get: (id: number) => apiClient.get<OperationTheatre>(`/api/ot/theatres/${id}/`),
  create: (data: Partial<OperationTheatre>) =>
    apiClient.post<OperationTheatre>("/api/ot/theatres/", data),
  update: (id: number, data: Partial<OperationTheatre>) =>
    apiClient.patch<OperationTheatre>(`/api/ot/theatres/${id}/`, data),
};

export const proceduresApi = {
  list: (params?: Record<string, string>) =>
    apiClient.get<SurgicalProcedure[]>("/api/ot/procedures/", { params }),
  get: (id: number) => apiClient.get<SurgicalProcedure>(`/api/ot/procedures/${id}/`),
  create: (data: Partial<SurgicalProcedure>) =>
    apiClient.post<SurgicalProcedure>("/api/ot/procedures/", data),
};

export const bookingsApi = {
  list: (params?: Record<string, string>) =>
    apiClient.get<SurgeryBooking[]>("/api/ot/bookings/", { params }),
  get: (id: number) => apiClient.get<SurgeryBooking>(`/api/ot/bookings/${id}/`),
  create: (data: any) => apiClient.post<SurgeryBooking>("/api/ot/bookings/", data),
  today: () => apiClient.get<OTDashboard>("/api/ot/bookings/today/"),
  calendar: (start: string, end: string) =>
    apiClient.get<SurgeryBooking[]>("/api/ot/bookings/calendar/", {
      params: { start, end },
    }),

  // State transitions
  checkIn: (id: number) =>
    apiClient.post<SurgeryBooking>(`/api/ot/bookings/${id}/check-in/`),
  start: (id: number) =>
    apiClient.post<SurgeryBooking>(`/api/ot/bookings/${id}/start/`),
  complete: (id: number, generate_invoice = true) =>
    apiClient.post<SurgeryBooking>(`/api/ot/bookings/${id}/complete/`,
      { generate_invoice }),
  cancel: (id: number, reason: string) =>
    apiClient.post<SurgeryBooking>(`/api/ot/bookings/${id}/cancel/`, { reason }),
  postpone: (id: number, new_start: string, new_end: string, reason = "") =>
    apiClient.post<SurgeryBooking>(`/api/ot/bookings/${id}/postpone/`,
      { new_start, new_end, reason }),

  // Team + consumables
  addTeamMember: (id: number, data: {
    role: string; doctor_id?: number; member_name?: string; notes?: string;
  }) => apiClient.post<SurgeryTeamMember>(
    `/api/ot/bookings/${id}/add-team-member/`, data,
  ),
  addConsumable: (id: number, data: {
    item_name: string; quantity: string; unit_price: string;
    unit?: string; gst_rate?: string; notes?: string;
  }) => apiClient.post<OTConsumable>(
    `/api/ot/bookings/${id}/add-consumable/`, data,
  ),

  // Register
  getRegister: (id: number) =>
    apiClient.get<OTRegister>(`/api/ot/bookings/${id}/register/`),
  upsertRegister: (id: number, data: Partial<OTRegister> & {
    finalize?: boolean; prepared_by_id?: number;
  }) => apiClient.post<OTRegister>(`/api/ot/bookings/${id}/register/`, data),
  registerPdfUrl: (id: number) => `/api/ot/bookings/${id}/register-pdf/`,
};

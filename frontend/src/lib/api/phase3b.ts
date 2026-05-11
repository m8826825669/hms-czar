import { apiClient } from "@/lib/api/client";
import type {
  Ambulance, AmbulanceDriver, Dispatch,
  DietType, MealItem, DietPlan, PatientMeal, KitchenSummary,
  LinenItem, LaundryBatch,
  CylinderType, Cylinder, CylinderInventory,
} from "@/types/phase3b";

// ═══════════════════════════════════════════════
// Ambulance
// ═══════════════════════════════════════════════
export const ambulancesApi = {
  list: (params?: Record<string, string>) =>
    apiClient.get<Ambulance[]>("/api/ambulance/ambulances/", { params }),
  available: () =>
    apiClient.get<Ambulance[]>("/api/ambulance/ambulances/available/"),
  get: (id: number) => apiClient.get<Ambulance>(`/api/ambulance/ambulances/${id}/`),
  create: (data: any) => apiClient.post<Ambulance>("/api/ambulance/ambulances/", data),
  update: (id: number, data: Partial<Ambulance>) =>
    apiClient.patch<Ambulance>(`/api/ambulance/ambulances/${id}/`, data),
};

export const driversApi = {
  list: (params?: Record<string, string>) =>
    apiClient.get<AmbulanceDriver[]>("/api/ambulance/drivers/", { params }),
  onDuty: () =>
    apiClient.get<AmbulanceDriver[]>("/api/ambulance/drivers/on_duty/"),
};

export const dispatchesApi = {
  list: (params?: Record<string, string>) =>
    apiClient.get<Dispatch[]>("/api/ambulance/dispatches/", { params }),
  active: () =>
    apiClient.get<Dispatch[]>("/api/ambulance/dispatches/active/"),
  get: (id: number) => apiClient.get<Dispatch>(`/api/ambulance/dispatches/${id}/`),
  create: (data: any) => apiClient.post<Dispatch>("/api/ambulance/dispatches/", data),
  assign: (id: number, data: { ambulance_id: number; driver_id?: number; paramedic_id?: number }) =>
    apiClient.post<Dispatch>(`/api/ambulance/dispatches/${id}/assign/`, data),
  updateStatus: (id: number, data: { new_status: string; lat?: string; lng?: string; note?: string }) =>
    apiClient.post<Dispatch>(`/api/ambulance/dispatches/${id}/update-status/`, data),
  cancel: (id: number, reason: string) =>
    apiClient.post<Dispatch>(`/api/ambulance/dispatches/${id}/cancel/`, { reason }),
  bill: (id: number, data: { distance_km: string; gst_rate?: string }) =>
    apiClient.post<Dispatch>(`/api/ambulance/dispatches/${id}/bill/`, data),
};


// ═══════════════════════════════════════════════
// Dietary
// ═══════════════════════════════════════════════
export const dietTypesApi = {
  list: () => apiClient.get<DietType[]>("/api/dietary/diet-types/"),
};
export const mealItemsApi = {
  list: (params?: Record<string, string>) =>
    apiClient.get<MealItem[]>("/api/dietary/meal-items/", { params }),
};
export const dietPlansApi = {
  list: (params?: Record<string, string>) =>
    apiClient.get<DietPlan[]>("/api/dietary/diet-plans/", { params }),
  get: (id: number) => apiClient.get<DietPlan>(`/api/dietary/diet-plans/${id}/`),
  create: (data: any) => apiClient.post<DietPlan>("/api/dietary/diet-plans/", data),
  generateMeals: (id: number, date?: string) =>
    apiClient.post(`/api/dietary/diet-plans/${id}/generate-meals/`, { date }),
  setNpo: (id: number, npo_until: string | null, npo_reason: string = "") =>
    apiClient.post(`/api/dietary/diet-plans/${id}/set-npo/`, { npo_until, npo_reason }),
};
export const patientMealsApi = {
  list: (params?: Record<string, string>) =>
    apiClient.get<PatientMeal[]>("/api/dietary/patient-meals/", { params }),
  updateStatus: (id: number, data: any) =>
    apiClient.post<PatientMeal>(`/api/dietary/patient-meals/${id}/update-status/`, data),
};
export const kitchenApi = {
  today: (date?: string) =>
    apiClient.get<KitchenSummary>("/api/dietary/kitchen-today/", {
      params: date ? { date } : undefined,
    }),
  generateAll: (date?: string) =>
    apiClient.post<{ created: number; date: string }>(
      "/api/dietary/generate-all-meals/", date ? { date } : {},
    ),
};


// ═══════════════════════════════════════════════
// Laundry
// ═══════════════════════════════════════════════
export const linenItemsApi = {
  list: () => apiClient.get<LinenItem[]>("/api/laundry/items/"),
};
export const laundryBatchesApi = {
  list: (params?: Record<string, string>) =>
    apiClient.get<LaundryBatch[]>("/api/laundry/batches/", { params }),
  get: (id: number) => apiClient.get<LaundryBatch>(`/api/laundry/batches/${id}/`),
  create: (data: any) =>
    apiClient.post<LaundryBatch>("/api/laundry/batches/", data),
  sendToLaundry: (id: number) =>
    apiClient.post<LaundryBatch>(`/api/laundry/batches/${id}/send-to-laundry/`),
  receiveBack: (id: number, data: any) =>
    apiClient.post<LaundryBatch>(`/api/laundry/batches/${id}/receive-back/`, data),
};


// ═══════════════════════════════════════════════
// Gas Cylinder
// ═══════════════════════════════════════════════
export const cylinderTypesApi = {
  list: () => apiClient.get<CylinderType[]>("/api/gas-cylinder/cylinder-types/"),
};
export const cylindersApi = {
  list: (params?: Record<string, string>) =>
    apiClient.get<Cylinder[]>("/api/gas-cylinder/cylinders/", { params }),
  get: (id: number) => apiClient.get<Cylinder>(`/api/gas-cylinder/cylinders/${id}/`),
  issue: (id: number, data: { department_id?: number; location?: string; received_by?: string }) =>
    apiClient.post<Cylinder>(`/api/gas-cylinder/cylinders/${id}/issue/`, data),
  returnCyl: (id: number, data: { fill_percentage: number; notes?: string }) =>
    apiClient.post<Cylinder>(`/api/gas-cylinder/cylinders/${id}/return/`, data),
  addInspection: (id: number, data: any) =>
    apiClient.post(`/api/gas-cylinder/cylinders/${id}/add-inspection/`, data),
};
export const cylinderInventoryApi = {
  summary: () => apiClient.get<CylinderInventory>("/api/gas-cylinder/inventory/"),
};

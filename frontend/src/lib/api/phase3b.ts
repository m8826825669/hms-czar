// frontend/src/lib/api/phase3b.ts
"use client";
import { api } from "@/lib/api";
import type {
  Ambulance, AmbulanceDriver, Dispatch,
  DietType, MealItem, DietPlan, PatientMeal, KitchenSummary,
  LinenItem, LaundryBatch,
  CylinderType, Cylinder, CylinderInventory,
} from "@/types/phase3b";

// ─── Ambulance ───────────────────────────────────────────────────────────────
const AMB = "/ambulance";

export const ambulancesApi = {
  list: (params?: Record<string, unknown>) =>
    api.get<Ambulance[]>(`${AMB}/ambulances/`, { params }).then(r => r.data),
  available: () =>
    api.get<Ambulance[]>(`${AMB}/ambulances/available/`).then(r => r.data),
  get: (id: number) =>
    api.get<Ambulance>(`${AMB}/ambulances/${id}/`).then(r => r.data),
  create: (data: Partial<Ambulance>) =>
    api.post<Ambulance>(`${AMB}/ambulances/`, data).then(r => r.data),
  update: (id: number, data: Partial<Ambulance>) =>
    api.patch<Ambulance>(`${AMB}/ambulances/${id}/`, data).then(r => r.data),
};

export const driversApi = {
  list: (params?: Record<string, unknown>) =>
    api.get<AmbulanceDriver[]>(`${AMB}/drivers/`, { params }).then(r => r.data),
  onDuty: () =>
    api.get<AmbulanceDriver[]>(`${AMB}/drivers/on_duty/`).then(r => r.data),
};

export const dispatchesApi = {
  list: (params?: Record<string, unknown>) =>
    api.get<Dispatch[]>(`${AMB}/dispatches/`, { params }).then(r => r.data),
  active: () =>
    api.get<Dispatch[]>(`${AMB}/dispatches/active/`).then(r => r.data),
  get: (id: number) =>
    api.get<Dispatch>(`${AMB}/dispatches/${id}/`).then(r => r.data),
  create: (data: Partial<Dispatch>) =>
    api.post<Dispatch>(`${AMB}/dispatches/`, data).then(r => r.data),
  assign: (id: number, data: { ambulance_id: number; driver_id?: number; paramedic_id?: number }) =>
    api.post<Dispatch>(`${AMB}/dispatches/${id}/assign/`, data).then(r => r.data),
  updateStatus: (id: number, data: { new_status: string; lat?: string; lng?: string; note?: string }) =>
    api.post<Dispatch>(`${AMB}/dispatches/${id}/update-status/`, data).then(r => r.data),
  cancel: (id: number, reason: string) =>
    api.post<Dispatch>(`${AMB}/dispatches/${id}/cancel/`, { reason }).then(r => r.data),
  bill: (id: number, data: { distance_km: string; gst_rate?: string }) =>
    api.post<Dispatch>(`${AMB}/dispatches/${id}/bill/`, data).then(r => r.data),
};

// ─── Dietary ─────────────────────────────────────────────────────────────────
const DIET = "/dietary";

export const dietTypesApi = {
  list: () =>
    api.get<DietType[]>(`${DIET}/diet-types/`).then(r => r.data),
};

export const mealItemsApi = {
  list: (params?: Record<string, unknown>) =>
    api.get<MealItem[]>(`${DIET}/meal-items/`, { params }).then(r => r.data),
};

export const dietPlansApi = {
  list: (params?: Record<string, unknown>) =>
    api.get<DietPlan[]>(`${DIET}/diet-plans/`, { params }).then(r => r.data),
  get: (id: number) =>
    api.get<DietPlan>(`${DIET}/diet-plans/${id}/`).then(r => r.data),
  create: (data: Partial<DietPlan>) =>
    api.post<DietPlan>(`${DIET}/diet-plans/`, data).then(r => r.data),
  generateMeals: (id: number, date?: string) =>
    api.post(`${DIET}/diet-plans/${id}/generate-meals/`, { date }).then(r => r.data),
  setNpo: (id: number, npo_until: string | null, npo_reason: string = "") =>
    api.post(`${DIET}/diet-plans/${id}/set-npo/`, { npo_until, npo_reason }).then(r => r.data),
};

export const patientMealsApi = {
  list: (params?: Record<string, unknown>) =>
    api.get<PatientMeal[]>(`${DIET}/patient-meals/`, { params }).then(r => r.data),
  updateStatus: (id: number, data: Record<string, unknown>) =>
    api.post<PatientMeal>(`${DIET}/patient-meals/${id}/update-status/`, data).then(r => r.data),
};

export const kitchenApi = {
  today: (date?: string) =>
    api.get<KitchenSummary>(`${DIET}/kitchen-today/`, {
      params: date ? { date } : undefined,
    }).then(r => r.data),
  generateAll: (date?: string) =>
    api.post<{ created: number; date: string }>(
      `${DIET}/generate-all-meals/`, date ? { date } : {},
    ).then(r => r.data),
};

// ─── Laundry ─────────────────────────────────────────────────────────────────
const LAUNDRY = "/laundry";

export const linenItemsApi = {
  list: () =>
    api.get<LinenItem[]>(`${LAUNDRY}/items/`).then(r => r.data),
};

export const laundryBatchesApi = {
  list: (params?: Record<string, unknown>) =>
    api.get<LaundryBatch[]>(`${LAUNDRY}/batches/`, { params }).then(r => r.data),
  get: (id: number) =>
    api.get<LaundryBatch>(`${LAUNDRY}/batches/${id}/`).then(r => r.data),
  create: (data: Partial<LaundryBatch>) =>
    api.post<LaundryBatch>(`${LAUNDRY}/batches/`, data).then(r => r.data),
  // sendToLaundry / receiveBack are wrappers over the single backend
  // `transition` action. The backend status enum:
  //   CREATED → PICKED_UP → WASHING → READY → RETURNED
  // "Send to laundry" = mark PICKED_UP; "receive back" = mark RETURNED.
  // Any extra `data` keys are forwarded for forward-compat (e.g. damage
  // notes once the backend transition view accepts more than new_status).
  sendToLaundry: (id: number) =>
    api.post<LaundryBatch>(`${LAUNDRY}/batches/${id}/transition/`,
      { new_status: "PICKED_UP" }).then(r => r.data),
  receiveBack: (id: number, data: Record<string, unknown> = {}) =>
    api.post<LaundryBatch>(`${LAUNDRY}/batches/${id}/transition/`,
      { new_status: "RETURNED", ...data }).then(r => r.data),
};

// ─── Gas Cylinder ────────────────────────────────────────────────────────────
const CYL = "/gas-cylinder";

export const cylinderTypesApi = {
  list: () =>
    api.get<CylinderType[]>(`${CYL}/cylinder-types/`).then(r => r.data),
};

export const cylindersApi = {
  list: (params?: Record<string, unknown>) =>
    api.get<Cylinder[]>(`${CYL}/cylinders/`, { params }).then(r => r.data),
  get: (id: number) =>
    api.get<Cylinder>(`${CYL}/cylinders/${id}/`).then(r => r.data),
  issue: (id: number, data: { department_id?: number; location?: string; received_by?: string }) =>
    api.post<Cylinder>(`${CYL}/cylinders/${id}/issue/`, data).then(r => r.data),
  returnCyl: (id: number, data: { fill_percentage: number; notes?: string }) =>
    api.post<Cylinder>(`${CYL}/cylinders/${id}/return/`, data).then(r => r.data),
  addInspection: (id: number, data: Record<string, unknown>) =>
    api.post(`${CYL}/cylinders/${id}/add-inspection/`, data).then(r => r.data),
};

export const cylinderInventoryApi = {
  summary: () =>
    api.get<CylinderInventory>(`${CYL}/inventory/`).then(r => r.data),
};

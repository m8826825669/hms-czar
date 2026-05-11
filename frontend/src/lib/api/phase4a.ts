import { apiClient } from "@/lib/api/client";
import type {
  StoreLocation, StockItem, StockBatch, Supplier,
  PurchaseOrder, StockRequisition, StockSummaryRow,
  AssetCategory, Asset, AssetMaintenanceLog, AssetMetrics,
  HKZone, HKStaff, HKTaskTemplate, HKTaskAssignment, HKTodaySummary,
} from "@/types/phase4a";

// ═══ Inventory ═══
export const storesApi = {
  list: () => apiClient.get<StoreLocation[]>("/api/inventory/stores/"),
};
export const stockItemsApi = {
  list: (params?: Record<string, string>) =>
    apiClient.get<StockItem[]>("/api/inventory/items/", { params }),
};
export const stockBatchesApi = {
  list: (params?: Record<string, string>) =>
    apiClient.get<StockBatch[]>("/api/inventory/batches/", { params }),
};
export const suppliersApi = {
  list: () => apiClient.get<Supplier[]>("/api/inventory/suppliers/"),
};
export const purchaseOrdersApi = {
  list: (params?: Record<string, string>) =>
    apiClient.get<PurchaseOrder[]>("/api/inventory/purchase-orders/", { params }),
  get: (id: number) => apiClient.get<PurchaseOrder>(`/api/inventory/purchase-orders/${id}/`),
  create: (data: any) =>
    apiClient.post<PurchaseOrder>("/api/inventory/purchase-orders/", data),
  submit: (id: number) =>
    apiClient.post<PurchaseOrder>(`/api/inventory/purchase-orders/${id}/submit/`),
  approve: (id: number) =>
    apiClient.post<PurchaseOrder>(`/api/inventory/purchase-orders/${id}/approve/`),
};
export const requisitionsApi = {
  list: (params?: Record<string, string>) =>
    apiClient.get<StockRequisition[]>("/api/inventory/requisitions/", { params }),
  get: (id: number) => apiClient.get<StockRequisition>(`/api/inventory/requisitions/${id}/`),
  create: (data: any) =>
    apiClient.post<StockRequisition>("/api/inventory/requisitions/", data),
  approve: (id: number, line_approvals?: Record<number, string>) =>
    apiClient.post<StockRequisition>(`/api/inventory/requisitions/${id}/approve/`,
                                       { line_approvals }),
  issue: (id: number, data: any) =>
    apiClient.post(`/api/inventory/requisitions/${id}/issue/`, data),
};
export const stockSummaryApi = {
  get: (params?: Record<string, string>) =>
    apiClient.get<{ summary: StockSummaryRow[] }>("/api/inventory/stock-summary/",
                                                     { params }),
  expiring: (days: number = 30) =>
    apiClient.get<StockBatch[]>("/api/inventory/expiring-soon/",
                                  { params: { days: String(days) } }),
};


// ═══ Assets ═══
export const assetCategoriesApi = {
  list: () => apiClient.get<AssetCategory[]>("/api/assets/categories/"),
};
export const assetsApi = {
  list: (params?: Record<string, string>) =>
    apiClient.get<Asset[]>("/api/assets/assets/", { params }),
  get: (id: number) => apiClient.get<Asset>(`/api/assets/assets/${id}/`),
  create: (data: any) => apiClient.post<Asset>("/api/assets/assets/", data),
  scheduleMaintenance: (id: number, data: any) =>
    apiClient.post<AssetMaintenanceLog>(
      `/api/assets/assets/${id}/schedule-maintenance/`, data),
  dispose: (id: number, data: any) =>
    apiClient.post(`/api/assets/assets/${id}/dispose/`, data),
};
export const maintenanceLogsApi = {
  list: (params?: Record<string, string>) =>
    apiClient.get<AssetMaintenanceLog[]>("/api/assets/maintenance-logs/", { params }),
  complete: (id: number, data: any) =>
    apiClient.post<AssetMaintenanceLog>(
      `/api/assets/maintenance-logs/${id}/complete/`, data),
};
export const assetMetricsApi = {
  get: () => apiClient.get<AssetMetrics>("/api/assets/metrics/"),
};


// ═══ Housekeeping ═══
export const hkZonesApi = {
  list: () => apiClient.get<HKZone[]>("/api/housekeeping/zones/"),
};
export const hkStaffApi = {
  list: () => apiClient.get<HKStaff[]>("/api/housekeeping/staff/"),
};
export const hkTemplatesApi = {
  list: () => apiClient.get<HKTaskTemplate[]>("/api/housekeeping/task-templates/"),
};
export const hkAssignmentsApi = {
  list: (params?: Record<string, string>) =>
    apiClient.get<HKTaskAssignment[]>("/api/housekeeping/task-assignments/", { params }),
  start: (id: number) =>
    apiClient.post<HKTaskAssignment>(`/api/housekeeping/task-assignments/${id}/start/`),
  complete: (id: number, notes?: string) =>
    apiClient.post<HKTaskAssignment>(
      `/api/housekeeping/task-assignments/${id}/complete/`, { notes }),
  inspect: (id: number, data: any) =>
    apiClient.post<HKTaskAssignment>(
      `/api/housekeeping/task-assignments/${id}/inspect/`, data),
};
export const hkTodayApi = {
  summary: () => apiClient.get<HKTodaySummary>("/api/housekeeping/today-summary/"),
  generate: (date?: string) =>
    apiClient.post<{ created: number; date: string }>(
      "/api/housekeeping/generate-daily-tasks/", date ? { date } : {}),
};

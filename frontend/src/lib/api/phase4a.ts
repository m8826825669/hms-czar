// frontend/src/lib/api/phase4a.ts
"use client";
import { api } from "@/lib/api";
import type {
  StoreLocation, StockItem, StockBatch, Supplier,
  PurchaseOrder, StockRequisition, StockSummaryRow,
  AssetCategory, Asset, AssetMaintenanceLog, AssetMetrics,
  HKZone, HKStaff, HKTaskTemplate, HKTaskAssignment, HKTodaySummary,
} from "@/types/phase4a";

// ─── Inventory ───────────────────────────────────────────────────────────────
const INV = "/inventory";

export const storesApi = {
  list: () =>
    api.get<StoreLocation[]>(`${INV}/stores/`).then(r => r.data),
};

export const stockItemsApi = {
  list: (params?: Record<string, unknown>) =>
    api.get<StockItem[]>(`${INV}/items/`, { params }).then(r => r.data),
};

export const stockBatchesApi = {
  list: (params?: Record<string, unknown>) =>
    api.get<StockBatch[]>(`${INV}/batches/`, { params }).then(r => r.data),
};

export const suppliersApi = {
  list: () =>
    api.get<Supplier[]>(`${INV}/suppliers/`).then(r => r.data),
};

export const purchaseOrdersApi = {
  list: (params?: Record<string, unknown>) =>
    api.get<PurchaseOrder[]>(`${INV}/purchase-orders/`, { params }).then(r => r.data),
  get: (id: number) =>
    api.get<PurchaseOrder>(`${INV}/purchase-orders/${id}/`).then(r => r.data),
  create: (data: Partial<PurchaseOrder>) =>
    api.post<PurchaseOrder>(`${INV}/purchase-orders/`, data).then(r => r.data),
  submit: (id: number) =>
    api.post<PurchaseOrder>(`${INV}/purchase-orders/${id}/submit/`).then(r => r.data),
  approve: (id: number) =>
    api.post<PurchaseOrder>(`${INV}/purchase-orders/${id}/approve/`).then(r => r.data),
};

export const requisitionsApi = {
  list: (params?: Record<string, unknown>) =>
    api.get<StockRequisition[]>(`${INV}/requisitions/`, { params }).then(r => r.data),
  get: (id: number) =>
    api.get<StockRequisition>(`${INV}/requisitions/${id}/`).then(r => r.data),
  create: (data: Partial<StockRequisition>) =>
    api.post<StockRequisition>(`${INV}/requisitions/`, data).then(r => r.data),
  approve: (id: number, line_approvals?: Record<number, string>) =>
    api.post<StockRequisition>(`${INV}/requisitions/${id}/approve/`,
      { line_approvals }).then(r => r.data),
  issue: (id: number, data: Record<string, unknown>) =>
    api.post(`${INV}/requisitions/${id}/issue/`, data).then(r => r.data),
};

export const stockSummaryApi = {
  get: (params?: Record<string, unknown>) =>
    api.get<{ summary: StockSummaryRow[] }>(`${INV}/stock-summary/`, { params }).then(r => r.data),
  expiring: (days: number = 30) =>
    api.get<StockBatch[]>(`${INV}/expiring-soon/`,
      { params: { days: String(days) } }).then(r => r.data),
};

// ─── Assets ──────────────────────────────────────────────────────────────────
const ASSETS = "/assets";

export const assetCategoriesApi = {
  list: () =>
    api.get<AssetCategory[]>(`${ASSETS}/categories/`).then(r => r.data),
};

export const assetsApi = {
  list: (params?: Record<string, unknown>) =>
    api.get<Asset[]>(`${ASSETS}/assets/`, { params }).then(r => r.data),
  get: (id: number) =>
    api.get<Asset>(`${ASSETS}/assets/${id}/`).then(r => r.data),
  create: (data: Partial<Asset>) =>
    api.post<Asset>(`${ASSETS}/assets/`, data).then(r => r.data),
  scheduleMaintenance: (id: number, data: Record<string, unknown>) =>
    api.post<AssetMaintenanceLog>(
      `${ASSETS}/assets/${id}/schedule-maintenance/`, data).then(r => r.data),
  dispose: (id: number, data: Record<string, unknown>) =>
    api.post(`${ASSETS}/assets/${id}/dispose/`, data).then(r => r.data),
};

export const maintenanceLogsApi = {
  list: (params?: Record<string, unknown>) =>
    api.get<AssetMaintenanceLog[]>(`${ASSETS}/maintenance-logs/`, { params }).then(r => r.data),
  complete: (id: number, data: Record<string, unknown>) =>
    api.post<AssetMaintenanceLog>(
      `${ASSETS}/maintenance-logs/${id}/complete/`, data).then(r => r.data),
};

export const assetMetricsApi = {
  get: () =>
    api.get<AssetMetrics>(`${ASSETS}/metrics/`).then(r => r.data),
};

// ─── Housekeeping ────────────────────────────────────────────────────────────
const HK = "/housekeeping";

export const hkZonesApi = {
  list: () =>
    api.get<HKZone[]>(`${HK}/zones/`).then(r => r.data),
};

export const hkStaffApi = {
  list: () =>
    api.get<HKStaff[]>(`${HK}/staff/`).then(r => r.data),
};

export const hkTemplatesApi = {
  list: () =>
    api.get<HKTaskTemplate[]>(`${HK}/task-templates/`).then(r => r.data),
};

export const hkAssignmentsApi = {
  list: (params?: Record<string, unknown>) =>
    api.get<HKTaskAssignment[]>(`${HK}/task-assignments/`, { params }).then(r => r.data),
  start: (id: number) =>
    api.post<HKTaskAssignment>(`${HK}/task-assignments/${id}/start/`).then(r => r.data),
  complete: (id: number, notes?: string) =>
    api.post<HKTaskAssignment>(
      `${HK}/task-assignments/${id}/complete/`, { notes }).then(r => r.data),
  inspect: (id: number, data: Record<string, unknown>) =>
    api.post<HKTaskAssignment>(
      `${HK}/task-assignments/${id}/inspect/`, data).then(r => r.data),
};

export const hkTodayApi = {
  summary: () =>
    api.get<HKTodaySummary>(`${HK}/today-summary/`).then(r => r.data),
  generate: (date?: string) =>
    api.post<{ created: number; date: string }>(
      `${HK}/generate-daily-tasks/`, date ? { date } : {}).then(r => r.data),
};

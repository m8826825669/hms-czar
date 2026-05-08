"use client";
import { api } from "@/lib/api";
import type {
  Department, DrugBatch, StockMovement, PharmacyOrder, PharmacyOrderItem,
  AvailabilityResponse, LowStockRow, OrderWithWarnings,
} from "@/types/pharmacy";
import type { Paginated } from "@/types/hms";

export const departmentsApi = {
  list: (params?: Record<string, unknown>) =>
    api.get<Paginated<Department>>("/department/departments/", { params }).then(r => r.data),
  get: (id: number) =>
    api.get<Department>(`/department/departments/${id}/`).then(r => r.data),
  create: (data: Partial<Department>) =>
    api.post<Department>("/department/departments/", data).then(r => r.data),
  update: (id: number, data: Partial<Department>) =>
    api.patch<Department>(`/department/departments/${id}/`, data).then(r => r.data),
};

export const batchesApi = {
  list: (params?: Record<string, unknown>) =>
    api.get<Paginated<DrugBatch>>("/pharmacy/batches/", { params }).then(r => r.data),
  search: (q: string) =>
    api.get<Paginated<DrugBatch>>("/pharmacy/batches/", { params: { search: q, page_size: 30 } })
       .then(r => r.data.results),
  get: (id: number) =>
    api.get<DrugBatch>(`/pharmacy/batches/${id}/`).then(r => r.data),
};

export const stockApi = {
  receive: (data: {
    drug_id: number;
    batch_no: string;
    expiry_date: string;
    mfg_date?: string;
    qty_purchased: number;
    mrp: number;
    purchase_price?: number;
    supplier_name?: string;
    supplier_invoice_no?: string;
    hsn_code?: string;
    gst_rate?: number;
    notes?: string;
  }) =>
    api.post<DrugBatch>("/pharmacy/receive-stock/", data).then(r => r.data),

  availability: (drugId: number) =>
    api.get<AvailabilityResponse>(`/pharmacy/drugs/${drugId}/availability/`).then(r => r.data),

  allocatePreview: (drugId: number, qty: number) =>
    api.post("/pharmacy/allocate-preview/", { drug_id: drugId, qty })
       .then(r => r.data as {
         allocations: Array<{
           batch_id: number; batch_no: string; expiry_date: string;
           available: number; take: number; mrp: string;
         }>;
         shortfall: number;
         total_available: number;
         qty_requested: number;
       }),

  movements: (params?: Record<string, unknown>) =>
    api.get<Paginated<StockMovement>>("/pharmacy/movements/", { params }).then(r => r.data),

  lowStock: (threshold = 20) =>
    api.get<{ threshold: number; count: number; drugs: LowStockRow[] }>(
      "/pharmacy/reports/low-stock/", { params: { threshold } }
    ).then(r => r.data),

  nearExpiry: (days = 90) =>
    api.get<{ days: number; count: number; batches: DrugBatch[] }>(
      "/pharmacy/reports/near-expiry/", { params: { days } }
    ).then(r => r.data),
};

export const pharmacyOrdersApi = {
  list: (params?: Record<string, unknown>) =>
    api.get<Paginated<PharmacyOrder>>("/pharmacy/orders/", { params }).then(r => r.data),
  get: (id: number) =>
    api.get<PharmacyOrder>(`/pharmacy/orders/${id}/`).then(r => r.data),
  create: (data: Partial<PharmacyOrder>) =>
    api.post<PharmacyOrder>("/pharmacy/orders/", data).then(r => r.data),
  startFromPrescription: (prescription_id: number) =>
    api.post<OrderWithWarnings>("/pharmacy/orders/start-from-prescription/",
                                { prescription_id }).then(r => r.data),
  addItem: (orderId: number, data: { drug_id: number; quantity: number; discount_pct?: number; unit_mrp?: number }) =>
    api.post<PharmacyOrder>(`/pharmacy/orders/${orderId}/add-item/`, data).then(r => r.data),
  removeItem: (orderId: number, itemId: number) =>
    api.post<PharmacyOrder>(`/pharmacy/orders/${orderId}/remove-item/${itemId}/`).then(r => r.data),
  dispense: (id: number) =>
    api.post<PharmacyOrder>(`/pharmacy/orders/${id}/dispense/`).then(r => r.data),
  cancel: (id: number, reason: string) =>
    api.post<PharmacyOrder>(`/pharmacy/orders/${id}/cancel/`, { reason }).then(r => r.data),
};

// ─── Refunds (Phase 2a billing extension) ──────────
export interface Refund {
  id: number;
  code: string;
  invoice: number;
  invoice_code: string;
  payment: number | null;
  payment_method: string;
  amount: string;
  method: "CASH" | "RAZORPAY" | "BANK_TRANSFER" | "ADJUSTMENT";
  method_label: string;
  reason: string;
  status: "REQUESTED" | "APPROVED" | "PROCESSED" | "REJECTED";
  status_label: string;
  requested_at: string;
  approved_at: string | null;
  processed_at: string | null;
  approved_by: number | null;
  approved_by_name: string;
  razorpay_refund_id: string;
  razorpay_status: string;
  rejection_reason: string;
  notes: string;
}

export const refundsApi = {
  list: (params?: Record<string, unknown>) =>
    api.get<Paginated<Refund>>("/billing/refunds/", { params }).then(r => r.data),
  get: (id: number) =>
    api.get<Refund>(`/billing/refunds/${id}/`).then(r => r.data),
  request: (invoiceId: number, data: {
    amount: number; reason: string; method?: string; payment_id?: number;
  }) =>
    api.post<Refund>(`/billing/invoices/${invoiceId}/request-refund/`, data)
       .then(r => r.data),
  approve: (id: number) =>
    api.post<Refund>(`/billing/refunds/${id}/approve/`).then(r => r.data),
  process: (id: number) =>
    api.post<Refund>(`/billing/refunds/${id}/process/`).then(r => r.data),
  reject: (id: number, reason: string) =>
    api.post<Refund>(`/billing/refunds/${id}/reject/`, { reason }).then(r => r.data),
};

export const pharmacyDashboardApi = {
  fetch: () =>
    api.get<{
      as_of: string;
      total_drugs: number;
      out_of_stock_count: number;
      out_of_stock_items: Array<{ drug_id: number; drug_name: string; strength: string; dosage_form: string }>;
      low_stock_count: number;
      low_stock_items: Array<{ drug_id: number; drug_name: string; strength: string; dosage_form: string; on_hand: number; reorder_level: number }>;
      expiring_soon_count: number;
      expiring_soon_batches: DrugBatch[];
      today_orders_count: number;
      today_completed_count: number;
      today_revenue: string;
    }>("/pharmacy/dashboard/").then(r => r.data),
};

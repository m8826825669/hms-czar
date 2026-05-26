// frontend/src/lib/api/billing.ts
"use client";
import axios from "axios";
import { api } from "@/lib/api";
import type {
  Service, Invoice, InvoiceItem, Payment, RazorpayInitResponse,
  PublicPrescriptionView, PublicQueueView,
} from "@/types/billing";
import type { Paginated } from "@/types/hms";

const ROOT = "/billing";

// ─── Services (catalogue) ────────────────────────────────────────────────────
export const servicesApi = {
  list: (params?: Record<string, unknown>) =>
    api.get<Paginated<Service>>(`${ROOT}/services/`, { params }).then(r => r.data),
  search: (q: string) =>
    api.get<Paginated<Service>>(`${ROOT}/services/`, {
      params: { search: q, page_size: 20 },
    }).then(r => r.data.results),
  get: (id: number) =>
    api.get<Service>(`${ROOT}/services/${id}/`).then(r => r.data),
  create: (data: Partial<Service>) =>
    api.post<Service>(`${ROOT}/services/`, data).then(r => r.data),
  update: (id: number, data: Partial<Service>) =>
    api.patch<Service>(`${ROOT}/services/${id}/`, data).then(r => r.data),
  delete: (id: number) =>
    api.delete(`${ROOT}/services/${id}/`).then(() => undefined),
};

// ─── Invoices ────────────────────────────────────────────────────────────────
export const invoicesApi = {
  list: (params?: Record<string, unknown>) =>
    api.get<Paginated<Invoice>>(`${ROOT}/invoices/`, { params }).then(r => r.data),
  get: (id: number) =>
    api.get<Invoice>(`${ROOT}/invoices/${id}/`).then(r => r.data),
  today: () =>
    api.get<{
      date: string;
      invoice_count: number;
      total_billed: string;
      total_collected: string;
      total_due: string;
      by_status: Record<string, number>;
      invoices: Invoice[];
    }>(`${ROOT}/invoices/today/`).then(r => r.data),
  create: (data: Partial<Invoice>) =>
    api.post<Invoice>(`${ROOT}/invoices/`, data).then(r => r.data),
  addItem: (invoiceId: number, item: Partial<InvoiceItem>) =>
    api.post<Invoice>(`${ROOT}/invoices/${invoiceId}/add-item/`, item).then(r => r.data),
  removeItem: (invoiceId: number, itemId: number) =>
    api.post<Invoice>(`${ROOT}/invoices/${invoiceId}/remove-item/${itemId}/`).then(r => r.data),
  finalize: (id: number) =>
    api.post<Invoice>(`${ROOT}/invoices/${id}/finalize/`).then(r => r.data),
  cancel: (id: number, reason: string) =>
    api.post<Invoice>(`${ROOT}/invoices/${id}/cancel/`, { reason }).then(r => r.data),
  payCash: (id: number, data: { amount: number; method: string; reference?: string; notes?: string }) =>
    api.post<{ invoice: Invoice; payment: Payment }>(
      `${ROOT}/invoices/${id}/pay-cash/`, data,
    ).then(r => r.data),
  payOnline: (id: number) =>
    api.post<RazorpayInitResponse>(`${ROOT}/invoices/${id}/pay-online/`).then(r => r.data),
  verifyPayment: (data: {
    invoice_id: number;
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) =>
    api.post<{ verified: boolean; invoice: Invoice; payment: Payment }>(
      `${ROOT}/payments/verify/`, data,
    ).then(r => r.data),
  printUrl: (id: number) =>
    `${process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000"}/api/v1${ROOT}/invoices/${id}/print/`,
};

// ─── Public (no-auth) endpoints ──────────────────────────────────────────────
// Uses a separate axios instance so the JWT interceptor doesn't run.
const publicAxios = axios.create({
  baseURL: `${process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000"}/api/v1/public`,
});

export const publicApi = {
  prescription: (uuid: string) =>
    publicAxios.get<PublicPrescriptionView>(`/rx/${uuid}/`).then(r => r.data),
  queue: (hospitalId: number, params?: { location?: number; doctor?: number }) =>
    publicAxios.get<PublicQueueView>(`/queue/${hospitalId}/`, { params }).then(r => r.data),
};

"use client";
import axios from "axios";
import { api } from "@/lib/api";
import type {
  Service, Invoice, InvoiceItem, Payment, RazorpayInitResponse,
  PublicPrescriptionView, PublicQueueView,
} from "@/types/billing";
import type { Paginated } from "@/types/hms";

export const servicesApi = {
  list: (params?: Record<string, unknown>) =>
    api.get<Paginated<Service>>("/billing/services/", { params }).then(r => r.data),
  search: (q: string) =>
    api.get<Paginated<Service>>("/billing/services/", { params: { search: q, page_size: 20 } })
       .then(r => r.data.results),
  get: (id: number) =>
    api.get<Service>(`/billing/services/${id}/`).then(r => r.data),
  create: (data: Partial<Service>) =>
    api.post<Service>("/billing/services/", data).then(r => r.data),
  update: (id: number, data: Partial<Service>) =>
    api.patch<Service>(`/billing/services/${id}/`, data).then(r => r.data),
  delete: (id: number) =>
    api.delete(`/billing/services/${id}/`).then(r => r.data),
};

export const invoicesApi = {
  list: (params?: Record<string, unknown>) =>
    api.get<Paginated<Invoice>>("/billing/invoices/", { params }).then(r => r.data),
  get: (id: number) =>
    api.get<Invoice>(`/billing/invoices/${id}/`).then(r => r.data),
  today: () =>
    api.get<{
      date: string;
      invoice_count: number;
      total_billed: string;
      total_collected: string;
      total_due: string;
      by_status: Record<string, number>;
      invoices: Invoice[];
    }>("/billing/invoices/today/").then(r => r.data),
  create: (data: Partial<Invoice>) =>
    api.post<Invoice>("/billing/invoices/", data).then(r => r.data),
  addItem: (invoiceId: number, item: Partial<InvoiceItem>) =>
    api.post<Invoice>(`/billing/invoices/${invoiceId}/add-item/`, item).then(r => r.data),
  removeItem: (invoiceId: number, itemId: number) =>
    api.post<Invoice>(`/billing/invoices/${invoiceId}/remove-item/${itemId}/`).then(r => r.data),
  finalize: (id: number) =>
    api.post<Invoice>(`/billing/invoices/${id}/finalize/`).then(r => r.data),
  cancel: (id: number, reason: string) =>
    api.post<Invoice>(`/billing/invoices/${id}/cancel/`, { reason }).then(r => r.data),
  payCash: (id: number, data: { amount: number; method: string; reference?: string; notes?: string }) =>
    api.post<{ invoice: Invoice; payment: Payment }>(`/billing/invoices/${id}/pay-cash/`, data).then(r => r.data),
  payOnline: (id: number) =>
    api.post<RazorpayInitResponse>(`/billing/invoices/${id}/pay-online/`).then(r => r.data),
  verifyPayment: (data: {
    invoice_id: number;
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) =>
    api.post<{ verified: boolean; invoice: Invoice; payment: Payment }>(
      "/billing/payments/verify/", data
    ).then(r => r.data),
  printUrl: (id: number) =>
    `${process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000"}/api/v1/billing/invoices/${id}/print/`,
};

// Public (no-auth) endpoints — uses raw axios, no JWT header
const publicAxios = axios.create({
  baseURL: `${process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000"}/api/v1/public`,
});

export const publicApi = {
  prescription: (uuid: string) =>
    publicAxios.get<PublicPrescriptionView>(`/rx/${uuid}/`).then(r => r.data),
  queue: (hospitalId: number, params?: { location?: number; doctor?: number }) =>
    publicAxios.get<PublicQueueView>(`/queue/${hospitalId}/`, { params }).then(r => r.data),
};

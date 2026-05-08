"use client";
import { api } from "@/lib/api";
import type { Refund } from "@/types/refunds";

interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

/**
 * Phase 2b Refunds API.
 *
 * IMPORTANT: This is additive to your existing Phase 1c lib/api/billing.ts.
 * Either copy the `refundsApi` export below into that file, or keep this
 * separate file and import from "@/lib/api/refunds".
 */
export const refundsApi = {
  list: (params?: Record<string, unknown>) =>
    api.get<Paginated<Refund>>("/billing/refunds/", { params }).then(r => r.data),

  pending: () =>
    api.get<Refund[]>("/billing/refunds/pending/").then(r => r.data),

  get: (id: number) =>
    api.get<Refund>(`/billing/refunds/${id}/`).then(r => r.data),

  /** Open a refund request from an invoice context. */
  request: (
    invoiceId: number,
    data: { amount: number | string; reason: string; method?: string; payment_id?: number },
  ) =>
    api.post<Refund>(`/billing/invoices/${invoiceId}/request-refund/`, data)
       .then(r => r.data),

  approve: (id: number) =>
    api.post<Refund>(`/billing/refunds/${id}/approve/`).then(r => r.data),

  process: (id: number) =>
    api.post<Refund>(`/billing/refunds/${id}/process/`).then(r => r.data),

  reject: (id: number, reason: string) =>
    api.post<Refund>(`/billing/refunds/${id}/reject/`, { reason }).then(r => r.data),
};

// frontend/src/lib/api/refunds.ts
"use client";
import { api } from "@/lib/api";
import type { Refund } from "@/types/refunds";

const ROOT = "/billing";

interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

/**
 * Phase 2b Refunds API.
 *
 * This is additive to lib/api/billing.ts. Import from either; behaviour is
 * identical because both go through the same axios instance.
 */
export const refundsApi = {
  list: (params?: Record<string, unknown>) =>
    api.get<Paginated<Refund>>(`${ROOT}/refunds/`, { params }).then(r => r.data),

  pending: () =>
    api.get<Refund[]>(`${ROOT}/refunds/pending/`).then(r => r.data),

  get: (id: number) =>
    api.get<Refund>(`${ROOT}/refunds/${id}/`).then(r => r.data),

  /** Open a refund request from an invoice context. */
  request: (
    invoiceId: number,
    data: { amount: number | string; reason: string; method?: string; payment_id?: number },
  ) =>
    api.post<Refund>(`${ROOT}/invoices/${invoiceId}/request-refund/`, data).then(r => r.data),

  approve: (id: number) =>
    api.post<Refund>(`${ROOT}/refunds/${id}/approve/`).then(r => r.data),

  process: (id: number) =>
    api.post<Refund>(`${ROOT}/refunds/${id}/process/`).then(r => r.data),

  reject: (id: number, reason: string) =>
    api.post<Refund>(`${ROOT}/refunds/${id}/reject/`, { reason }).then(r => r.data),
};

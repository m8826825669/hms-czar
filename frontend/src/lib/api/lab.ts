"use client";
import { api } from "@/lib/api";
import type {
  TestCatalog,
  TestParameter,
  LabOrder,
  LabOrderItem,
  LabSample,
  LabResult,
  LabTodayDashboard,
} from "@/types/lab";

interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

// ─────────────────────────────── Test catalog ───────────────────────────────────

export const labTestsApi = {
  list: (params?: Record<string, unknown>) =>
    api.get<Paginated<TestCatalog>>("/lab/tests/", { params }).then(r => r.data),

  search: (q: string) =>
    api.get<Paginated<TestCatalog>>("/lab/tests/", {
      params: { search: q, is_active: true, page_size: 20 },
    }).then(r => r.data.results),

  byCategory: (category: string) =>
    api.get<Paginated<TestCatalog>>("/lab/tests/", {
      params: { category, is_active: true, page_size: 100 },
    }).then(r => r.data.results),

  get: (id: number) =>
    api.get<TestCatalog>(`/lab/tests/${id}/`).then(r => r.data),

  parameters: (id: number) =>
    api.get<TestParameter[]>(`/lab/tests/${id}/parameters/`).then(r => r.data),
};

// ────────────────────────────────── Orders ──────────────────────────────────────

export const labOrdersApi = {
  list: (params?: Record<string, unknown>) =>
    api.get<Paginated<LabOrder>>("/lab/orders/", { params }).then(r => r.data),

  get: (id: number) =>
    api.get<LabOrder>(`/lab/orders/${id}/`).then(r => r.data),

  create: (data: Partial<LabOrder>) =>
    api.post<LabOrder>("/lab/orders/", data).then(r => r.data),

  addTest: (orderId: number, testId: number) =>
    api.post<LabOrder>(`/lab/orders/${orderId}/add-test/`, { test_id: testId })
       .then(r => r.data),

  removeTest: (orderId: number, itemId: number) =>
    api.post<LabOrder>(`/lab/orders/${orderId}/remove-test/${itemId}/`)
       .then(r => r.data),

  finalize: (orderId: number) =>
    api.post<LabOrder>(`/lab/orders/${orderId}/finalize/`).then(r => r.data),

  collectSamples: (
    orderId: number,
    samples?: Array<{ sample_type: string; container?: string; volume?: string; notes?: string }>,
  ) =>
    api.post<{ order: LabOrder; samples: LabSample[] }>(
      `/lab/orders/${orderId}/collect-samples/`,
      samples ? { samples } : {},
    ).then(r => r.data),

  enterResults: (
    orderId: number,
    itemId: number,
    results: Array<{ parameter_id: number; value: string; interpretation?: string }>,
  ) =>
    api.post<{ saved: LabResult[]; order: LabOrder }>(
      `/lab/orders/${orderId}/items/${itemId}/results/`,
      { results },
    ).then(r => r.data),

  release: (orderId: number, doctorId?: number) =>
    api.post<LabOrder>(`/lab/orders/${orderId}/release/`,
      doctorId ? { doctor_id: doctorId } : {}).then(r => r.data),

  cancel: (orderId: number, reason: string) =>
    api.post<LabOrder>(`/lab/orders/${orderId}/cancel/`, { reason })
       .then(r => r.data),

  reportPdfUrl: (orderId: number) =>
    `/api/lab/orders/${orderId}/report/`,

  today: () =>
    api.get<LabTodayDashboard>("/lab/orders/today/").then(r => r.data),

  abnormal: () =>
    api.get<LabOrder[]>("/lab/orders/abnormal/").then(r => r.data),
};

// ────────────────────────────────── Samples ─────────────────────────────────────

export const labSamplesApi = {
  list: (params?: Record<string, unknown>) =>
    api.get<Paginated<LabSample>>("/lab/samples/", { params }).then(r => r.data),

  reject: (id: number, reason: string) =>
    api.post<LabSample>(`/lab/samples/${id}/reject/`, { reason }).then(r => r.data),
};

// ────────────────────────────────── Results ─────────────────────────────────────

export const labResultsApi = {
  list: (params?: Record<string, unknown>) =>
    api.get<Paginated<LabResult>>("/lab/results/", { params }).then(r => r.data),
};

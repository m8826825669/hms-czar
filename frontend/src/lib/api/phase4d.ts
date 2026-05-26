// frontend/src/lib/api/phase4d.ts
"use client";
import { api } from "@/lib/api";
import type {
  DashboardPayload, KPICards, ReportType, SavedReport, ReportRun,
  ReportRunResult, GoLiveReport,
} from "@/types/phase4d";

const ROOT = "/analytics";

export const analyticsApi = {
  dashboard: () =>
    api.get<DashboardPayload>(`${ROOT}/dashboard/`).then(r => r.data),

  kpis: () =>
    api.get<KPICards>(`${ROOT}/kpis/`).then(r => r.data),

  widget: <T = unknown>(metric: string, params?: Record<string, string | number>) =>
    api.get<{ metric: string; data: T }>(`${ROOT}/widget/${metric}/`, { params })
       .then(r => r.data),

  reportTypes: () =>
    api.get<ReportType[]>(`${ROOT}/report-types/`).then(r => r.data),

  runReport: <T = unknown>(reportType: string, parameters: Record<string, unknown> = {}) =>
    api.post<ReportRunResult<T>>(`${ROOT}/run-report/`, {
      report_type: reportType,
      parameters,
    }).then(r => r.data),

  savedReports: () =>
    api.get<SavedReport[] | { results: SavedReport[] }>(`${ROOT}/saved-reports/`)
       .then(r => Array.isArray(r.data) ? r.data : r.data.results),

  createSavedReport: (payload: Partial<SavedReport>) =>
    api.post<SavedReport>(`${ROOT}/saved-reports/`, payload).then(r => r.data),

  updateSavedReport: (id: number, payload: Partial<SavedReport>) =>
    api.patch<SavedReport>(`${ROOT}/saved-reports/${id}/`, payload).then(r => r.data),

  deleteSavedReport: (id: number) =>
    api.delete(`${ROOT}/saved-reports/${id}/`).then(() => undefined),

  runSavedReport: <T = unknown>(id: number) =>
    api.post<ReportRunResult<T> & { report: SavedReport }>(
      `${ROOT}/saved-reports/${id}/run/`, {},
    ).then(r => r.data),

  runHistory: () =>
    api.get<ReportRun[] | { results: ReportRun[] }>(`${ROOT}/runs/`)
       .then(r => Array.isArray(r.data) ? r.data : r.data.results),

  goLiveChecklist: () =>
    api.get<GoLiveReport>(`${ROOT}/go-live-checklist/`).then(r => r.data),
};

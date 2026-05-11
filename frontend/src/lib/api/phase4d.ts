import { apiClient } from "./client";
import type {
  DashboardPayload, KPICards, ReportType, SavedReport, ReportRun,
  ReportRunResult, GoLiveReport,
} from "@/types/phase4d";

const root = "/api/analytics";

export const analyticsApi = {
  dashboard: async () => {
    const { data } = await apiClient.get<DashboardPayload>(`${root}/dashboard/`);
    return data;
  },

  kpis: async () => {
    const { data } = await apiClient.get<KPICards>(`${root}/kpis/`);
    return data;
  },

  widget: async <T = unknown>(metric: string, params?: Record<string, string | number>) => {
    const query = params
      ? "?" + new URLSearchParams(
          Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)]))
        ).toString()
      : "";
    const { data } = await apiClient.get<{ metric: string; data: T }>(
      `${root}/widget/${metric}/${query}`
    );
    return data;
  },

  reportTypes: async () => {
    const { data } = await apiClient.get<ReportType[]>(`${root}/report-types/`);
    return data;
  },

  runReport: async <T = unknown>(reportType: string, parameters: Record<string, unknown> = {}) => {
    const { data } = await apiClient.post<ReportRunResult<T>>(`${root}/run-report/`, {
      report_type: reportType,
      parameters,
    });
    return data;
  },

  savedReports: async () => {
    const { data } = await apiClient.get<SavedReport[] | { results: SavedReport[] }>(
      `${root}/saved-reports/`
    );
    return Array.isArray(data) ? data : data.results;
  },

  createSavedReport: async (payload: Partial<SavedReport>) => {
    const { data } = await apiClient.post<SavedReport>(`${root}/saved-reports/`, payload);
    return data;
  },

  updateSavedReport: async (id: number, payload: Partial<SavedReport>) => {
    const { data } = await apiClient.patch<SavedReport>(`${root}/saved-reports/${id}/`, payload);
    return data;
  },

  deleteSavedReport: async (id: number) => {
    await apiClient.delete(`${root}/saved-reports/${id}/`);
  },

  runSavedReport: async <T = unknown>(id: number) => {
    const { data } = await apiClient.post<ReportRunResult<T> & { report: SavedReport }>(
      `${root}/saved-reports/${id}/run/`,
      {}
    );
    return data;
  },

  runHistory: async () => {
    const { data } = await apiClient.get<ReportRun[] | { results: ReportRun[] }>(`${root}/runs/`);
    return Array.isArray(data) ? data : data.results;
  },

  goLiveChecklist: async () => {
    const { data } = await apiClient.get<GoLiveReport>(`${root}/go-live-checklist/`);
    return data;
  },
};

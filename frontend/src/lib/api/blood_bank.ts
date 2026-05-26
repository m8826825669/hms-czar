// frontend/src/lib/api/blood_bank.ts
"use client";
import { api } from "@/lib/api";
import type {
  BloodDonor, BloodDonation, BloodBag,
  BloodRequisition, CrossMatch, BloodIssue,
  InventorySummary,
} from "@/types/blood_bank";

// All paths are relative to `${BACKEND_URL}/api/v1` (the api instance's baseURL).
// Never include `/api` or `/v1` prefixes in the path strings below.
const ROOT = "/blood-bank";

// ─── Donors ──────────────────────────────────────────────────────────────────
export const donorsApi = {
  list: (params?: Record<string, unknown>) =>
    api.get<BloodDonor[]>(`${ROOT}/donors/`, { params }).then(r => r.data),
  get: (id: number) =>
    api.get<BloodDonor>(`${ROOT}/donors/${id}/`).then(r => r.data),
  create: (data: Partial<BloodDonor>) =>
    api.post<BloodDonor>(`${ROOT}/donors/`, data).then(r => r.data),
  update: (id: number, data: Partial<BloodDonor>) =>
    api.patch<BloodDonor>(`${ROOT}/donors/${id}/`, data).then(r => r.data),
  eligibility: (id: number) =>
    api.get<{ can_donate: boolean; reason: string }>(
      `${ROOT}/donors/${id}/eligibility/`,
    ).then(r => r.data),
};

// ─── Donations ───────────────────────────────────────────────────────────────
export const donationsApi = {
  list: (params?: Record<string, unknown>) =>
    api.get<BloodDonation[]>(`${ROOT}/donations/`, { params }).then(r => r.data),
  get: (id: number) =>
    api.get<BloodDonation>(`${ROOT}/donations/${id}/`).then(r => r.data),
  create: (data: Partial<BloodDonation>) =>
    api.post<BloodDonation>(`${ROOT}/donations/`, data).then(r => r.data),
  screen: (id: number, data: {
    test_hiv: string; test_hbsag: string; test_hcv: string;
    test_syphilis: string; test_malaria: string;
    components?: string[]; storage_location?: string;
    discard_reason?: string;
  }) =>
    api.post<BloodDonation>(`${ROOT}/donations/${id}/screen/`, data).then(r => r.data),
};

// ─── Bags ────────────────────────────────────────────────────────────────────
export const bagsApi = {
  list: (params?: Record<string, unknown>) =>
    api.get<BloodBag[]>(`${ROOT}/bags/`, { params }).then(r => r.data),
  get: (id: number) =>
    api.get<BloodBag>(`${ROOT}/bags/${id}/`).then(r => r.data),
  discard: (id: number, reason: string) =>
    api.post<BloodBag>(`${ROOT}/bags/${id}/discard/`, { reason }).then(r => r.data),
};

// ─── Requisitions ────────────────────────────────────────────────────────────
export const requisitionsApi = {
  list: (params?: Record<string, unknown>) =>
    api.get<BloodRequisition[]>(`${ROOT}/requisitions/`, { params }).then(r => r.data),
  get: (id: number) =>
    api.get<BloodRequisition>(`${ROOT}/requisitions/${id}/`).then(r => r.data),
  create: (data: Partial<BloodRequisition>) =>
    api.post<BloodRequisition>(`${ROOT}/requisitions/`, data).then(r => r.data),
  pending: () =>
    api.get<BloodRequisition[]>(`${ROOT}/requisitions/pending/`).then(r => r.data),
  compatibleBags: (id: number) =>
    api.get<BloodBag[]>(`${ROOT}/requisitions/${id}/compatible-bags/`).then(r => r.data),
  crossmatch: (id: number, data: {
    bag_id: number; result: "COMPATIBLE" | "INCOMPATIBLE"; notes?: string;
  }) =>
    api.post<CrossMatch>(`${ROOT}/requisitions/${id}/crossmatch/`, data).then(r => r.data),
  reserve: (id: number, bag_id: number) =>
    api.post<BloodRequisition>(`${ROOT}/requisitions/${id}/reserve/`, { bag_id }).then(r => r.data),
  issueBag: (id: number, data: {
    bag_id: number; issued_to_dept?: string; received_by_name?: string;
    create_invoice?: boolean; unit_price?: string; gst_rate?: string;
  }) =>
    api.post<BloodIssue>(`${ROOT}/requisitions/${id}/issue-bag/`, data).then(r => r.data),
};

// ─── Issues ──────────────────────────────────────────────────────────────────
export const issuesApi = {
  list: () =>
    api.get<BloodIssue[]>(`${ROOT}/issues/`).then(r => r.data),
  completeTransfusion: (id: number, data: {
    started_at?: string; completed_at?: string;
    reactions?: string; bag_returned?: boolean;
  }) =>
    api.post<BloodIssue>(`${ROOT}/issues/${id}/complete-transfusion/`, data).then(r => r.data),
};

// ─── Inventory ───────────────────────────────────────────────────────────────
export const inventoryApi = {
  summary: () =>
    api.get<InventorySummary>(`${ROOT}/inventory/`).then(r => r.data),
  expireOldBags: () =>
    api.post<{ expired_count: number }>(`${ROOT}/expire-old-bags/`).then(r => r.data),
};

import { apiClient } from "@/lib/api/client";
import type {
  BloodDonor, BloodDonation, BloodBag,
  BloodRequisition, CrossMatch, BloodIssue,
  InventorySummary,
} from "@/types/blood_bank";


export const donorsApi = {
  list: (params?: Record<string, string>) =>
    apiClient.get<BloodDonor[]>("/api/blood-bank/donors/", { params }),
  get: (id: number) => apiClient.get<BloodDonor>(`/api/blood-bank/donors/${id}/`),
  create: (data: any) =>
    apiClient.post<BloodDonor>("/api/blood-bank/donors/", data),
  update: (id: number, data: Partial<BloodDonor>) =>
    apiClient.patch<BloodDonor>(`/api/blood-bank/donors/${id}/`, data),
  eligibility: (id: number) =>
    apiClient.get<{ can_donate: boolean; reason: string }>(
      `/api/blood-bank/donors/${id}/eligibility/`,
    ),
};

export const donationsApi = {
  list: (params?: Record<string, string>) =>
    apiClient.get<BloodDonation[]>("/api/blood-bank/donations/", { params }),
  get: (id: number) =>
    apiClient.get<BloodDonation>(`/api/blood-bank/donations/${id}/`),
  create: (data: any) =>
    apiClient.post<BloodDonation>("/api/blood-bank/donations/", data),
  screen: (id: number, data: {
    test_hiv: string; test_hbsag: string; test_hcv: string;
    test_syphilis: string; test_malaria: string;
    components?: string[]; storage_location?: string;
    discard_reason?: string;
  }) => apiClient.post<BloodDonation>(
    `/api/blood-bank/donations/${id}/screen/`, data,
  ),
};

export const bagsApi = {
  list: (params?: Record<string, string>) =>
    apiClient.get<BloodBag[]>("/api/blood-bank/bags/", { params }),
  get: (id: number) =>
    apiClient.get<BloodBag>(`/api/blood-bank/bags/${id}/`),
  discard: (id: number, reason: string) =>
    apiClient.post<BloodBag>(`/api/blood-bank/bags/${id}/discard/`, { reason }),
};

export const requisitionsApi = {
  list: (params?: Record<string, string>) =>
    apiClient.get<BloodRequisition[]>("/api/blood-bank/requisitions/", { params }),
  get: (id: number) =>
    apiClient.get<BloodRequisition>(`/api/blood-bank/requisitions/${id}/`),
  create: (data: any) =>
    apiClient.post<BloodRequisition>("/api/blood-bank/requisitions/", data),
  pending: () =>
    apiClient.get<BloodRequisition[]>("/api/blood-bank/requisitions/pending/"),
  compatibleBags: (id: number) =>
    apiClient.get<BloodBag[]>(
      `/api/blood-bank/requisitions/${id}/compatible-bags/`,
    ),
  crossmatch: (id: number, data: {
    bag_id: number; result: "COMPATIBLE" | "INCOMPATIBLE"; notes?: string;
  }) => apiClient.post<CrossMatch>(
    `/api/blood-bank/requisitions/${id}/crossmatch/`, data,
  ),
  reserve: (id: number, bag_id: number) =>
    apiClient.post<BloodRequisition>(
      `/api/blood-bank/requisitions/${id}/reserve/`, { bag_id },
    ),
  issueBag: (id: number, data: {
    bag_id: number; issued_to_dept?: string; received_by_name?: string;
    create_invoice?: boolean; unit_price?: string; gst_rate?: string;
  }) => apiClient.post<BloodIssue>(
    `/api/blood-bank/requisitions/${id}/issue-bag/`, data,
  ),
};

export const issuesApi = {
  list: () => apiClient.get<BloodIssue[]>("/api/blood-bank/issues/"),
  completeTransfusion: (id: number, data: {
    started_at?: string; completed_at?: string;
    reactions?: string; bag_returned?: boolean;
  }) => apiClient.post<BloodIssue>(
    `/api/blood-bank/issues/${id}/complete-transfusion/`, data,
  ),
};

export const inventoryApi = {
  summary: () => apiClient.get<InventorySummary>("/api/blood-bank/inventory/"),
  expireOldBags: () =>
    apiClient.post<{ expired_count: number }>("/api/blood-bank/expire-old-bags/"),
};

"use client";
import axios, { AxiosError, AxiosRequestConfig } from "axios";
import { useAuthStore } from "@/stores/auth-store";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000/api/v1";

export const api = axios.create({
  baseURL: `${BACKEND_URL}`,
  headers: { "Content-Type": "application/json" },
  timeout: 30_000,
});

// ─── Request: attach access token ──────────────────────────
api.interceptors.request.use((config) => {
  const access = useAuthStore.getState().access;
  if (access && config.headers) {
    config.headers.Authorization = `Bearer ${access}`;
  }
  return config;
});

// ─── Response: refresh on 401 once, otherwise log out ──────
let isRefreshing = false;
let pendingQueue: Array<(t: string | null) => void> = [];

function flushQueue(token: string | null) {
  pendingQueue.forEach((cb) => cb(token));
  pendingQueue = [];
}

api.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const originalRequest = error.config as AxiosRequestConfig & {
      _retry?: boolean;
    };
    const status = error.response?.status;

    // Skip refresh for the refresh endpoint itself / login
    const url = originalRequest?.url ?? "";
    const isAuthEndpoint = url.includes("/auth/login") || url.includes("/auth/refresh");

    if (status !== 401 || originalRequest?._retry || isAuthEndpoint) {
      return Promise.reject(error);
    }

    const { refresh, setTokens, clear } = useAuthStore.getState();
    if (!refresh) {
      clear();
      if (typeof window !== "undefined") window.location.href = "/login";
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        pendingQueue.push((token) => {
          if (!token) {
            reject(error);
            return;
          }
          (originalRequest.headers as Record<string, string>).Authorization =
            `Bearer ${token}`;
          resolve(api(originalRequest));
        });
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const res = await axios.post(`${BACKEND_URL}/auth/refresh/`, {
        refresh,
      });
      const newAccess = res.data.access as string;
      const newRefresh = (res.data.refresh as string | undefined) ?? refresh;
      setTokens(newAccess, newRefresh);
      flushQueue(newAccess);
      (originalRequest.headers as Record<string, string>).Authorization =
        `Bearer ${newAccess}`;
      return api(originalRequest);
    } catch (refreshErr) {
      flushQueue(null);
      clear();
      if (typeof window !== "undefined") window.location.href = "/login";
      return Promise.reject(refreshErr);
    } finally {
      isRefreshing = false;
    }
  },
);

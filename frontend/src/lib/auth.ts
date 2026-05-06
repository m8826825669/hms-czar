"use client";
import { api } from "./api";
import { useAuthStore } from "@/stores/auth-store";
import type { LoginResponse } from "@/types/auth";

export async function login(username: string, password: string) {
  const { data } = await api.post<LoginResponse>("/auth/login/", {
    username,
    password,
  });
  useAuthStore.getState().setAuth({
    access: data.access,
    refresh: data.refresh,
    user: data.user,
  });
  return data;
}

export async function logout() {
  const { refresh, clear } = useAuthStore.getState();
  try {
    if (refresh) {
      await api.post("/auth/logout/", { refresh });
    }
  } catch {
    /* network failure on logout is non-fatal */
  } finally {
    clear();
  }
}

export async function fetchMe() {
  const { data } = await api.get("/auth/me/");
  useAuthStore.getState().setUser(data);
  return data;
}

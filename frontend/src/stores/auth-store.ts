"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AuthUser } from "@/types/auth";

interface AuthState {
  access: string | null;
  refresh: string | null;
  user: AuthUser | null;
  setAuth: (data: { access: string; refresh: string; user: AuthUser }) => void;
  setTokens: (access: string, refresh?: string) => void;
  setUser: (user: AuthUser) => void;
  clear: () => void;
  hasPermission: (code: string) => boolean;
  hasRole: (code: string) => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      access: null,
      refresh: null,
      user: null,
      setAuth: ({ access, refresh, user }) => set({ access, refresh, user }),
      setTokens: (access, refresh) =>
        set((s) => ({ access, refresh: refresh ?? s.refresh })),
      setUser: (user) => set({ user }),
      clear: () => set({ access: null, refresh: null, user: null }),
      hasPermission: (code) => {
        const u = get().user;
        if (!u) return false;
        if (u.is_superuser) return true;
        return u.permissions.includes(code);
      },
      hasRole: (code) => get().user?.roles.includes(code) ?? false,
    }),
    {
      name: "hms-auth",
      partialize: (s) => ({ access: s.access, refresh: s.refresh, user: s.user }),
    },
  ),
);

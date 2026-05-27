"use client";
// hooks/use-dashboard.ts
//
// REWRITTEN: was 8 parallel API calls in Promise.allSettled with per-section
// MOCK fallbacks. Now one call. Real error state. No silent fallbacks.
//
import { useEffect, useState, useCallback } from "react";
import {
  dashboardApi,
  type DashboardStats, type WardOccupancy, type RecentOpdPatient,
  type OtScheduleEntry, type DashboardAlert, type MonthlyTrend,
  type OpdDailyCount, type RevenueBreakdown,
} from "@/lib/api/dashboard";

interface DashboardData {
  stats:   DashboardStats;
  wards:   WardOccupancy[];
  opd:     RecentOpdPatient[];
  ot:      OtScheduleEntry[];
  alerts:  DashboardAlert[];
  monthly: MonthlyTrend[];
  weekly:  OpdDailyCount[];
  revenue: RevenueBreakdown[];
}

interface UseDashboardReturn {
  data:    DashboardData;
  loading: boolean;
  error:   string | null;
  refresh: () => void;
}

// Empty data — the initial state and the post-error state. Honest about
// having no information, rather than displaying convincing fake numbers.
const EMPTY: DashboardData = {
  stats: {
    opd_today: 0, opd_yesterday: 0,
    ipd_census: 0, ipd_capacity: 0,
    ot_scheduled: 0, ot_completed: 0, ot_ongoing: 0,
    revenue_today: 0, revenue_yesterday: 0, revenue_target: 0,
    emergency_today: 0, pharmacy_bills: 0,
    lab_orders: 0, lab_pending: 0,
    discharges_today: 0, discharge_pending: 0,
  },
  wards: [], opd: [], ot: [],
  alerts: [], monthly: [], weekly: [], revenue: [],
};

export function useDashboard(pollMs = 30_000): UseDashboardReturn {
  const [data,    setData]    = useState<DashboardData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      const payload = await dashboardApi.all();
      // Extract the data sections; ignore `as_of` here (the consumer can
      // pass it through later if needed).
      setData({
        stats:   payload.stats,
        wards:   payload.wards,
        opd:     payload.opd,
        ot:      payload.ot,
        alerts:  payload.alerts,
        monthly: payload.monthly,
        weekly:  payload.weekly,
        revenue: payload.revenue,
      });
      setError(null);
    } catch (e: unknown) {
      // Surface the real error instead of silently falling back to fake data.
      // Keep showing the previous payload if one was loaded earlier.
      const message =
        e instanceof Error ? e.message :
        typeof e === "string" ? e :
        "Failed to load dashboard data.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
    const id = setInterval(fetch, pollMs);
    return () => clearInterval(id);
  }, [fetch, pollMs]);

  return { data, loading, error, refresh: fetch };
}

"use client";
// hooks/use-dashboard.ts
import { useEffect, useState, useCallback } from "react";
import { dashboardApi, MOCK, type DashboardStats, type WardOccupancy,
  type RecentOpdPatient, type OtScheduleEntry, type DashboardAlert,
  type MonthlyTrend, type OpdDailyCount, type RevenueBreakdown } from "@/lib/api/dashboard";

interface DashboardData {
  stats:    DashboardStats;
  wards:    WardOccupancy[];
  opd:      RecentOpdPatient[];
  ot:       OtScheduleEntry[];
  alerts:   DashboardAlert[];
  monthly:  MonthlyTrend[];
  weekly:   OpdDailyCount[];
  revenue:  RevenueBreakdown[];
}

interface UseDashboardReturn {
  data:     DashboardData;
  loading:  boolean;
  error:    string | null;
  refresh:  () => void;
}

// Start with mock data so the UI is never blank
const DEFAULT_DATA: DashboardData = {
  stats:   MOCK.stats,
  wards:   MOCK.wards,
  opd:     MOCK.opd,
  ot:      MOCK.ot,
  alerts:  MOCK.alerts,
  monthly: MOCK.monthly,
  weekly:  MOCK.weekly,
  revenue: MOCK.revenue,
};

export function useDashboard(pollMs = 30_000): UseDashboardReturn {
  const [data,    setData]    = useState<DashboardData>(DEFAULT_DATA);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      const [stats, wards, opd, ot, alerts, monthly, weekly, revenue] =
        await Promise.allSettled([
          dashboardApi.stats(),
          dashboardApi.wardOccupancy(),
          dashboardApi.recentOpd(),
          dashboardApi.otSchedule(),
          dashboardApi.alerts(),
          dashboardApi.monthlyTrend(),
          dashboardApi.opdWeekly(),
          dashboardApi.revenueBreakdown(),
        ]);

      setData({
        stats:   stats.status   === "fulfilled" ? stats.value   : MOCK.stats,
        wards:   wards.status   === "fulfilled" ? wards.value   : MOCK.wards,
        opd:     opd.status     === "fulfilled" ? opd.value     : MOCK.opd,
        ot:      ot.status      === "fulfilled" ? ot.value      : MOCK.ot,
        alerts:  alerts.status  === "fulfilled" ? alerts.value  : MOCK.alerts,
        monthly: monthly.status === "fulfilled" ? monthly.value : MOCK.monthly,
        weekly:  weekly.status  === "fulfilled" ? weekly.value  : MOCK.weekly,
        revenue: revenue.status === "fulfilled" ? revenue.value : MOCK.revenue,
      });
      setError(null);
    } catch (e) {
      // Keep showing mock / previously loaded data on error
      setError("Could not reach server — showing last known data");
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
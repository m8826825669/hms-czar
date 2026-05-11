"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { hkTodayApi, hkAssignmentsApi } from "@/lib/api/phase4a";
import type { HKTodaySummary, HKTaskAssignment } from "@/types/phase4a";

const STATUS_CHIPS: Record<string, string> = {
  PENDING:      "bg-slate-100 text-slate-700",
  IN_PROGRESS:  "bg-blue-100 text-blue-800",
  COMPLETED:    "bg-emerald-100 text-emerald-800",
  MISSED:       "bg-rose-100 text-rose-800",
  REJECTED:     "bg-rose-200 text-rose-900",
  CANCELLED:    "bg-slate-100 text-slate-500",
};


export default function HousekeepingDashboardPage() {
  const queryClient = useQueryClient();

  const { data: summary } = useQuery<HKTodaySummary>({
    queryKey: ["hk-today"],
    queryFn: async () => (await hkTodayApi.summary()).data,
    refetchInterval: 60000,
  });
  const { data: assignments = [] } = useQuery({
    queryKey: ["hk-assignments-today"],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      return (await hkAssignmentsApi.list({ scheduled_date: today })).data;
    },
    refetchInterval: 30000,
  });

  const generate = useMutation({
    mutationFn: () => hkTodayApi.generate(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hk-today"] });
      queryClient.invalidateQueries({ queryKey: ["hk-assignments-today"] });
    },
  });
  const start = useMutation({
    mutationFn: (id: number) => hkAssignmentsApi.start(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["hk-assignments-today"] }),
  });
  const complete = useMutation({
    mutationFn: (id: number) => hkAssignmentsApi.complete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["hk-assignments-today"] }),
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Housekeeping</h1>
          <p className="text-sm text-slate-500 mt-1">
            Today's tasks · {summary?.counts.total ?? 0} total
          </p>
        </div>
        <button onClick={() => generate.mutate()}
                disabled={generate.isPending}
                className="px-4 py-2 text-sm bg-sky-700 text-white rounded-md">
          {generate.isPending ? "Generating…" : "Auto-generate Today's Tasks"}
        </button>
      </div>

      {summary && (
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          <Stat label="Total" value={summary.counts.total} />
          <Stat label="Pending" value={summary.counts.pending} tone="slate" />
          <Stat label="In Progress" value={summary.counts.in_progress} tone="blue" />
          <Stat label="Completed" value={summary.counts.completed} tone="emerald" />
          <Stat label="Missed" value={summary.counts.missed} tone="rose" />
          <Stat label="Rejected" value={summary.counts.rejected} tone="rose" />
        </div>
      )}

      <section>
        <h2 className="text-lg font-medium mb-3">Today's Task Assignments</h2>
        {assignments.length === 0 ? (
          <div className="border border-dashed border-slate-300 rounded-md p-8 text-center text-slate-500">
            <p>No tasks scheduled for today.</p>
            <p className="text-sm mt-2">
              Click "Auto-generate Today's Tasks" to create assignments from templates.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {assignments.map((a: HKTaskAssignment) => (
              <div key={a.id} className="border border-slate-200 rounded-md p-3 bg-white">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <span className="font-medium">{a.template_name}</span>
                    <span className="ml-2 text-xs text-slate-500">@ {a.zone_name}</span>
                    {a.assigned_to_name && (
                      <span className="ml-2 text-xs text-slate-500">
                        · 👤 {a.assigned_to_name}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded ${STATUS_CHIPS[a.status]}`}>
                      {a.status_label}
                    </span>
                    {a.status === "PENDING" && (
                      <button onClick={() => start.mutate(a.id)}
                              className="text-xs px-2 py-1 bg-blue-600 text-white rounded">
                        Start
                      </button>
                    )}
                    {a.status === "IN_PROGRESS" && (
                      <button onClick={() => complete.mutate(a.id)}
                              className="text-xs px-2 py-1 bg-emerald-600 text-white rounded">
                        Complete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, tone = "slate" }: {
  label: string; value: number;
  tone?: "slate" | "blue" | "rose" | "amber" | "emerald";
}) {
  const tones: Record<string, string> = {
    slate: "border-slate-300",
    blue: "border-blue-300 bg-blue-50/30",
    rose: "border-rose-300 bg-rose-50/30",
    amber: "border-amber-300 bg-amber-50/30",
    emerald: "border-emerald-300 bg-emerald-50/30",
  };
  return (
    <div className={`border rounded-lg p-3 ${tones[tone]}`}>
      <div className="text-xs font-medium uppercase opacity-70">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
    </div>
  );
}

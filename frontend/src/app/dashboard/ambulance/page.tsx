"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { dispatchesApi, ambulancesApi } from "@/lib/api/phase3b";
import type { Dispatch, Ambulance } from "@/types/phase3b";

const STATUS_CHIPS: Record<string, string> = {
  REQUESTED:      "bg-rose-100 text-rose-800",
  ASSIGNED:       "bg-indigo-100 text-indigo-800",
  EN_ROUTE:       "bg-blue-100 text-blue-800",
  ON_SCENE:       "bg-amber-100 text-amber-800",
  PATIENT_PICKED: "bg-emerald-100 text-emerald-800",
  AT_HOSPITAL:    "bg-emerald-100 text-emerald-800",
  COMPLETED:      "bg-slate-100 text-slate-700",
  CANCELLED:      "bg-slate-100 text-slate-500",
};
const PRIORITY_CHIPS: Record<string, string> = {
  CRITICAL: "bg-rose-100 text-rose-800 font-semibold",
  URGENT:   "bg-amber-100 text-amber-800",
  ROUTINE:  "bg-slate-100 text-slate-700",
};
const AMB_STATUS_COLORS: Record<string, string> = {
  AVAILABLE:      "bg-emerald-50 border-emerald-300 text-emerald-900",
  DISPATCHED:     "bg-blue-50 border-blue-400 text-blue-900",
  MAINTENANCE:    "bg-amber-50 border-amber-300 text-amber-900",
  OUT_OF_SERVICE: "bg-rose-50 border-rose-400 text-rose-900",
};


export default function AmbulanceDashboardPage() {
  const { data: dispatches = [] } = useQuery({
    queryKey: ["dispatches-active"],
    queryFn: async () => (await dispatchesApi.active()).data,
    refetchInterval: 10000,
  });
  const { data: ambulances = [] } = useQuery({
    queryKey: ["ambulances-all"],
    queryFn: async () => (await ambulancesApi.list()).data,
    refetchInterval: 30000,
  });

  const counts = {
    available: ambulances.filter((a: Ambulance) => a.status === "AVAILABLE").length,
    dispatched: ambulances.filter((a: Ambulance) => a.status === "DISPATCHED").length,
    maintenance: ambulances.filter((a: Ambulance) => a.status === "MAINTENANCE").length,
    critical: dispatches.filter((d: Dispatch) => d.priority === "CRITICAL").length,
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Ambulance Control Room</h1>
          <p className="text-sm text-slate-500 mt-1">
            {dispatches.length} active dispatch{dispatches.length !== 1 ? "es" : ""}
          </p>
        </div>
        <Link href="/dashboard/ambulance/dispatches/new"
              className="px-4 py-2 text-sm bg-rose-700 text-white rounded-md hover:bg-rose-800">
          + New Dispatch
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Available" value={counts.available} tone="emerald" />
        <Stat label="Dispatched" value={counts.dispatched} tone="blue" />
        <Stat label="Maintenance" value={counts.maintenance} tone="amber" />
        <Stat label="Critical Calls" value={counts.critical} tone="rose" />
      </div>

      <section>
        <h2 className="text-lg font-medium text-slate-900 mb-3">Fleet Status</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {ambulances.map((a: Ambulance) => (
            <div key={a.id}
                 className={`border-2 rounded-lg p-3 ${AMB_STATUS_COLORS[a.status]}`}>
              <div className="flex items-start justify-between">
                <div className="font-semibold text-sm">{a.code}</div>
                <span className="text-xs uppercase font-medium">{a.status_label}</span>
              </div>
              <div className="text-xs mt-1 font-mono">{a.registration_number}</div>
              <div className="text-xs mt-1 opacity-70">{a.type_label}</div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-medium text-slate-900 mb-3">
          Active Dispatches ({dispatches.length})
        </h2>
        {dispatches.length === 0 ? (
          <div className="text-sm text-slate-500 italic border border-dashed border-slate-300 rounded-md p-8 text-center">
            No active dispatches.
          </div>
        ) : (
          <div className="space-y-2">
            {dispatches.map((d: Dispatch) => (
              <Link key={d.id}
                    href={`/dashboard/ambulance/dispatches/${d.id}`}
                    className="block border border-slate-200 rounded-md p-3 bg-white hover:bg-slate-50">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-mono text-xs text-slate-500">{d.code}</span>
                    <span className="font-medium">{d.patient_name}</span>
                    {d.ambulance_code && (
                      <span className="text-xs text-slate-500">
                        Amb: {d.ambulance_code}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded ${PRIORITY_CHIPS[d.priority]}`}>
                      {d.priority_label}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded ${STATUS_CHIPS[d.status]}`}>
                      {d.status_label}
                    </span>
                  </div>
                </div>
                <div className="text-xs text-slate-600 mt-1">
                  📍 {d.pickup_address}
                  {d.chief_complaint && (
                    <span className="ml-2">· {d.chief_complaint}</span>
                  )}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Requested {new Date(d.requested_at).toLocaleString("en-IN")}
                  {d.response_time_seconds && (
                    <span className="ml-2">
                      · Response: {Math.floor(d.response_time_seconds / 60)} min
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, tone }: {
  label: string; value: number;
  tone: "emerald" | "blue" | "amber" | "rose";
}) {
  const tones: Record<string, string> = {
    emerald: "border-emerald-300 bg-emerald-50/30",
    blue:    "border-blue-300 bg-blue-50/30",
    amber:   "border-amber-300 bg-amber-50/30",
    rose:    "border-rose-300 bg-rose-50/30",
  };
  return (
    <div className={`border rounded-lg p-4 ${tones[tone]}`}>
      <div className="text-xs font-medium uppercase tracking-wide opacity-70">{label}</div>
      <div className="text-3xl font-semibold mt-1">{value}</div>
    </div>
  );
}

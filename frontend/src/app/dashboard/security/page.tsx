"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  visitorPassesApi, gatePassesApi, incidentsApi, securityDashboardApi,
} from "@/lib/api/phase4b";
import type { VisitorPass, GatePass, Incident, SecurityDashboard } from "@/types/phase4b";

const SEVERITY_CHIPS: Record<string, string> = {
  LOW:      "bg-slate-100 text-slate-700",
  MEDIUM:   "bg-amber-100 text-amber-800",
  HIGH:     "bg-rose-100 text-rose-800",
  CRITICAL: "bg-rose-200 text-rose-900 font-semibold",
};

export default function SecurityDashboardPage() {
  const queryClient = useQueryClient();

  const { data: stats } = useQuery<SecurityDashboard>({
    queryKey: ["security-dashboard"],
    queryFn: async () => (await securityDashboardApi.get()).data,
    refetchInterval: 30000,
  });
  const { data: activeVisitors = [] } = useQuery({
    queryKey: ["active-visitors"],
    queryFn: async () => (await visitorPassesApi.list({ status: "ACTIVE" })).data,
  });
  const { data: openGatePasses = [] } = useQuery({
    queryKey: ["open-gate-passes"],
    queryFn: async () => (await gatePassesApi.list({ status: "ISSUED" })).data,
  });
  const { data: recentIncidents = [] } = useQuery({
    queryKey: ["recent-incidents"],
    queryFn: async () => (await incidentsApi.list()).data,
  });

  const logExit = useMutation({
    mutationFn: (id: number) => visitorPassesApi.logExit(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["security-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["active-visitors"] });
    },
  });
  const markReturned = useMutation({
    mutationFn: (id: number) => gatePassesApi.markReturned(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["security-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["open-gate-passes"] });
    },
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Security</h1>
        <p className="text-sm text-slate-500 mt-1">
          Visitor passes, gate passes, incidents
        </p>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Stat label="Active Visitors" value={stats.active_visitors} tone="blue" />
          <Stat label="Today Total" value={stats.visitors_today} />
          <Stat label="Open Gate Passes" value={stats.open_gate_passes} tone="amber" />
          <Stat label="Open Incidents" value={stats.recent_incidents} tone="rose" />
          <Stat label="Critical" value={stats.critical_incidents} tone="rose" />
        </div>
      )}

      <section>
        <h2 className="text-lg font-medium mb-3">Active Visitors</h2>
        {activeVisitors.length === 0 ? (
          <div className="text-center py-6 text-slate-500 italic">
            No active visitors.
          </div>
        ) : (
          <div className="space-y-2">
            {activeVisitors.map((v: VisitorPass) => (
              <div key={v.id} className="border border-slate-200 rounded-md p-3 bg-white">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <span className="font-mono text-xs text-slate-500">{v.pass_number}</span>
                    <span className="ml-3 font-medium">{v.visitor_name}</span>
                    <span className="ml-2 text-xs text-slate-500">({v.visitor_phone})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-0.5 bg-slate-100 rounded">
                      {v.visit_type_label}
                    </span>
                    <button onClick={() => logExit.mutate(v.id)}
                            className="text-xs px-2 py-1 bg-rose-600 text-white rounded">
                      Log Exit
                    </button>
                  </div>
                </div>
                <div className="text-sm text-slate-600 mt-1">
                  Visiting: {v.visiting_patient_name || v.visiting_person || "—"}
                  {v.room_number && <span> · Room {v.room_number}</span>}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Entered: {new Date(v.entry_time).toLocaleString("en-IN")}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-medium mb-3">Open Gate Passes</h2>
        {openGatePasses.length === 0 ? (
          <div className="text-center py-6 text-slate-500 italic">No open gate passes.</div>
        ) : (
          <div className="space-y-2">
            {openGatePasses.map((g: GatePass) => (
              <div key={g.id} className="border border-slate-200 rounded-md p-3 bg-white">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <span className="font-mono text-xs text-slate-500">{g.pass_number}</span>
                    <span className="ml-3 font-medium">{g.issued_to_party}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-0.5 bg-slate-100 rounded">
                      {g.pass_type_label}
                    </span>
                    <button onClick={() => markReturned.mutate(g.id)}
                            className="text-xs px-2 py-1 bg-emerald-600 text-white rounded">
                      Mark Returned
                    </button>
                  </div>
                </div>
                <div className="text-sm mt-1">{g.items_description}</div>
                <div className="text-xs text-slate-500 mt-1">
                  Vehicle: {g.vehicle_number || "—"} · Value: ₹{g.estimated_value}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-medium mb-3">Recent Incidents</h2>
        {recentIncidents.length === 0 ? (
          <div className="text-center py-6 text-slate-500 italic">No incidents.</div>
        ) : (
          <div className="space-y-2">
            {recentIncidents.slice(0, 10).map((inc: Incident) => (
              <div key={inc.id} className="border border-slate-200 rounded-md p-3 bg-white">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <span className="font-mono text-xs text-slate-500">{inc.incident_number}</span>
                    <span className="ml-3 font-medium">{inc.title}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded ${SEVERITY_CHIPS[inc.severity]}`}>
                      {inc.severity_label}
                    </span>
                    <span className="text-xs px-2 py-0.5 bg-slate-100 rounded">
                      {inc.incident_type_label}
                    </span>
                    <span className="text-xs px-2 py-0.5 bg-slate-100 rounded">
                      {inc.status_label}
                    </span>
                  </div>
                </div>
                <div className="text-sm text-slate-600 mt-1">{inc.description}</div>
                <div className="text-xs text-slate-500 mt-1">
                  📍 {inc.location} · {new Date(inc.occurred_at).toLocaleString("en-IN")}
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
  tone?: "slate" | "emerald" | "amber" | "rose" | "blue";
}) {
  const tones: Record<string, string> = {
    slate: "border-slate-300",
    blue: "border-blue-300 bg-blue-50/30",
    amber: "border-amber-300 bg-amber-50/30",
    rose: "border-rose-300 bg-rose-50/30",
    emerald: "border-emerald-300 bg-emerald-50/30",
  };
  return (
    <div className={`border rounded-lg p-3 ${tones[tone]}`}>
      <div className="text-xs font-medium uppercase opacity-70">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { dispatchesApi, ambulancesApi, driversApi } from "@/lib/api/phase3b";
import type { Dispatch, Ambulance, AmbulanceDriver } from "@/types/phase3b";

const STATUS_CHIPS: Record<string, string> = {
  REQUESTED:      "bg-rose-100 text-rose-800 border-rose-300",
  ASSIGNED:       "bg-indigo-100 text-indigo-800 border-indigo-300",
  EN_ROUTE:       "bg-blue-100 text-blue-800 border-blue-300",
  ON_SCENE:       "bg-amber-100 text-amber-800 border-amber-300",
  PATIENT_PICKED: "bg-emerald-100 text-emerald-800 border-emerald-300",
  AT_HOSPITAL:    "bg-emerald-100 text-emerald-800 border-emerald-300",
  COMPLETED:      "bg-slate-100 text-slate-700 border-slate-300",
  CANCELLED:      "bg-slate-100 text-slate-500 border-slate-300",
};

const NEXT_STATUS: Record<string, [string, string]> = {
  ASSIGNED:       ["EN_ROUTE", "Start En-route"],
  EN_ROUTE:       ["ON_SCENE", "Arrived On Scene"],
  ON_SCENE:       ["PATIENT_PICKED", "Patient Picked Up"],
  PATIENT_PICKED: ["AT_HOSPITAL", "Arrived at Hospital"],
  AT_HOSPITAL:    ["COMPLETED", "Mark Complete"],
};


export default function DispatchDetailPage() {
  const params = useParams();
  const id = Number(params?.id);
  const queryClient = useQueryClient();

  const { data: d, isLoading } = useQuery<Dispatch>({
    queryKey: ["dispatch", id],
    queryFn: async () => await dispatchesApi.get(id),
    enabled: !!id,
    refetchInterval: 10000,
  });

  if (isLoading || !d) {
    return <div className="p-8 text-slate-500">Loading…</div>;
  }
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["dispatch", id] });

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-slate-900">{d.code}</h1>
            <span className={`text-xs px-2 py-1 rounded border ${STATUS_CHIPS[d.status]}`}>
              {d.status_label}
            </span>
            <span className="text-xs px-2 py-1 rounded bg-rose-100 text-rose-800">
              {d.priority_label}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            {d.patient_name} · {d.chief_complaint || "—"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card title="Location">
            <div className="text-sm">{d.pickup_address}</div>
            {d.pickup_landmark && (
              <div className="text-xs text-slate-500 mt-1">📍 {d.pickup_landmark}</div>
            )}
          </Card>

          <Card title="Caller">
            <div className="text-sm">
              <strong>{d.caller_name || "—"}</strong> ({d.caller_relation || "unknown"})
            </div>
            <div className="text-xs text-slate-600 mt-1">📞 {d.caller_phone}</div>
          </Card>

          <Card title="Timeline">
            <Timeline d={d} />
          </Card>

          <ActionPanel dispatch={d} onChange={refresh} />
        </div>

        <div className="space-y-4">
          <SidebarCard title="Assignment">
            {d.ambulance_code ? (
              <div>
                <div className="font-medium">{d.ambulance_code}</div>
                <div className="text-xs text-slate-500">{d.ambulance_reg}</div>
                {d.driver_name && (
                  <div className="text-xs mt-1">Driver: {d.driver_name}</div>
                )}
                {d.paramedic_name && (
                  <div className="text-xs">Paramedic: {d.paramedic_name}</div>
                )}
              </div>
            ) : (
              <div className="text-sm text-amber-700">Awaiting assignment</div>
            )}
          </SidebarCard>

          {d.status === "REQUESTED" && (
            <SidebarCard title="Quick Assign">
              <AssignForm dispatch={d} onChange={refresh} />
            </SidebarCard>
          )}

          {d.response_time_seconds !== null && (
            <SidebarCard title="Response Time">
              <div className="text-2xl font-semibold">
                {Math.floor((d.response_time_seconds || 0) / 60)} min
              </div>
            </SidebarCard>
          )}

          {d.invoice_code && (
            <SidebarCard title="Invoice">
              <div className="text-sm font-mono">{d.invoice_code}</div>
              {d.distance_km && (
                <div className="text-xs text-slate-500 mt-1">
                  Distance: {d.distance_km} km
                </div>
              )}
            </SidebarCard>
          )}
        </div>
      </div>
    </div>
  );
}


function Timeline({ d }: { d: Dispatch }) {
  const events: [string, string | null][] = [
    ["Requested", d.requested_at],
    ["Assigned", d.assigned_at],
    ["En-route", d.en_route_at],
    ["On Scene", d.on_scene_at],
    ["Patient Picked", d.patient_picked_at],
    ["At Hospital", d.at_hospital_at],
    ["Completed", d.completed_at],
  ];
  return (
    <ol className="space-y-1 text-sm">
      {events.map(([label, ts]) => (
        <li key={label} className="flex justify-between">
          <span className={ts ? "text-slate-900" : "text-slate-400"}>
            {ts ? "✓" : "○"} {label}
          </span>
          <span className="text-xs text-slate-500">
            {ts ? new Date(ts).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : ""}
          </span>
        </li>
      ))}
    </ol>
  );
}


function ActionPanel({ dispatch: d, onChange }: { dispatch: Dispatch; onChange: () => void }) {
  const update = useMutation({
    mutationFn: (new_status: string) =>
      dispatchesApi.updateStatus(d.id, { new_status }),
    onSuccess: onChange,
  });
  const cancel = useMutation({
    mutationFn: (reason: string) => dispatchesApi.cancel(d.id, reason),
    onSuccess: onChange,
  });
  const bill = useMutation({
    mutationFn: (km: string) => dispatchesApi.bill(d.id, { distance_km: km }),
    onSuccess: onChange,
  });

  const next = NEXT_STATUS[d.status];
  if (!next && d.status !== "COMPLETED") {
    return d.status === "REQUESTED"
      ? null
      : <div className="text-sm text-slate-500">No actions available.</div>;
  }

  return (
    <div className="border border-slate-200 rounded-lg p-4 bg-white">
      <div className="flex gap-2 flex-wrap">
        {next && (
          <button
            onClick={() => update.mutate(next[0])}
            disabled={update.isPending}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            {next[1]}
          </button>
        )}
        {d.status !== "COMPLETED" && d.status !== "CANCELLED" && (
          <button
            onClick={() => {
              const r = prompt("Cancellation reason:");
              if (r) cancel.mutate(r);
            }}
            className="px-4 py-2 text-sm bg-rose-600 text-white rounded-md hover:bg-rose-700"
          >
            Cancel
          </button>
        )}
        {d.status === "COMPLETED" && !d.invoice_code && d.patient && (
          <button
            onClick={() => {
              const km = prompt("Distance in km:");
              if (km) bill.mutate(km);
            }}
            className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-md hover:bg-emerald-700"
          >
            Generate Bill
          </button>
        )}
      </div>
      {(update.isError || cancel.isError) && (
        <div className="text-xs text-rose-600 mt-2">
          {((update.error || cancel.error) as any)?.response?.data?.detail
            ?? (update.error as Error)?.message}
        </div>
      )}
    </div>
  );
}


function AssignForm({ dispatch, onChange }: { dispatch: Dispatch; onChange: () => void }) {
  const { data: ambulances = [] } = useQuery({
    queryKey: ["ambulances-available"],
    queryFn: async () => await ambulancesApi.available(),
  });
  const { data: drivers = [] } = useQuery({
    queryKey: ["drivers-onduty"],
    queryFn: async () => await driversApi.onDuty(),
  });

  const [ambId, setAmbId] = useState<number | "">("");
  const [driverId, setDriverId] = useState<number | "">("");
  const [paramedicId, setParamedicId] = useState<number | "">("");

  const assign = useMutation({
    mutationFn: () => dispatchesApi.assign(dispatch.id, {
      ambulance_id: Number(ambId),
      driver_id: driverId ? Number(driverId) : undefined,
      paramedic_id: paramedicId ? Number(paramedicId) : undefined,
    }),
    onSuccess: onChange,
  });

  return (
    <div className="space-y-2 text-sm">
      <select value={ambId} onChange={(e) => setAmbId(e.target.value ? Number(e.target.value) : "")}
              className="w-full border border-slate-300 rounded px-2 py-1">
        <option value="">Select ambulance…</option>
        {ambulances.map((a: Ambulance) => (
          <option key={a.id} value={a.id}>{a.code} ({a.type_label})</option>
        ))}
      </select>
      <select value={driverId} onChange={(e) => setDriverId(e.target.value ? Number(e.target.value) : "")}
              className="w-full border border-slate-300 rounded px-2 py-1">
        <option value="">Driver (optional)…</option>
        {drivers.filter((d: AmbulanceDriver) => d.role.includes("DRIVER"))
          .map((d: AmbulanceDriver) => (
            <option key={d.id} value={d.id}>{d.full_name}</option>
          ))}
      </select>
      <select value={paramedicId} onChange={(e) => setParamedicId(e.target.value ? Number(e.target.value) : "")}
              className="w-full border border-slate-300 rounded px-2 py-1">
        <option value="">Paramedic (optional)…</option>
        {drivers.filter((d: AmbulanceDriver) => d.role === "PARAMEDIC" || d.role === "DRIVER_PARAMEDIC")
          .map((d: AmbulanceDriver) => (
            <option key={d.id} value={d.id}>{d.full_name}</option>
          ))}
      </select>
      <button onClick={() => assign.mutate()}
              disabled={!ambId || assign.isPending}
              className="w-full px-3 py-1 bg-sky-700 text-white rounded text-sm disabled:bg-slate-300">
        {assign.isPending ? "Assigning…" : "Assign"}
      </button>
      {assign.isError && (
        <div className="text-xs text-rose-600">
          {(assign.error as any)?.response?.data?.detail ?? (assign.error as Error).message}
        </div>
      )}
    </div>
  );
}


function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border border-slate-200 rounded-lg p-4 bg-white">
      <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">{title}</h3>
      {children}
    </section>
  );
}

function SidebarCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-slate-200 rounded-lg p-3 bg-white">
      <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
        {title}
      </div>
      {children}
    </div>
  );
}

"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cylinderInventoryApi, cylindersApi } from "@/lib/api/phase3b";
import type { Cylinder, CylinderInventory } from "@/types/phase3b";

const GAS_LABELS: Record<string, string> = {
  O2: "Oxygen", N2O: "Nitrous Oxide", MED_AIR: "Med Air",
  CO2: "CO₂", HELIUM: "Helium", ENTONOX: "Entonox", VACUUM: "Vacuum",
};
const STATUS_LABELS: Record<string, string> = {
  AVAILABLE: "Avail", PARTIAL: "Partial", EMPTY: "Empty",
  AT_VENDOR: "Vendor", IN_USE: "In Use", MAINTENANCE: "Maint", RETIRED: "Retired",
};
const STATUS_COLORS: Record<string, string> = {
  AVAILABLE: "bg-emerald-50 border-emerald-300 text-emerald-900",
  PARTIAL:   "bg-amber-50 border-amber-300 text-amber-900",
  EMPTY:     "bg-rose-50 border-rose-300 text-rose-900",
  AT_VENDOR: "bg-slate-100 border-slate-400 text-slate-800",
  IN_USE:    "bg-blue-50 border-blue-400 text-blue-900",
  MAINTENANCE:"bg-amber-100 border-amber-400 text-amber-900",
  RETIRED:   "bg-slate-200 border-slate-400 text-slate-600",
};
const ALL_STATUSES = ["AVAILABLE", "IN_USE", "PARTIAL", "EMPTY", "AT_VENDOR"];


export default function GasCylinderDashboardPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"inventory" | "cylinders">("inventory");

  const { data: inv } = useQuery<CylinderInventory>({
    queryKey: ["cyl-inventory"],
    queryFn: async () => (await cylinderInventoryApi.summary()).data,
    enabled: tab === "inventory",
    refetchInterval: 60000,
  });
  const { data: cylinders = [] } = useQuery({
    queryKey: ["cylinders-all"],
    queryFn: async () => (await cylindersApi.list()).data,
    enabled: tab === "cylinders",
  });

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Medical Gas Cylinders</h1>
        <p className="text-sm text-slate-500 mt-1">
          O₂, N₂O, Med Air, CO₂ tracking with hydro-test compliance
        </p>
      </div>

      <div className="border-b border-slate-200">
        <nav className="flex gap-4">
          {(["inventory", "cylinders"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
                    className={`px-4 py-2 text-sm border-b-2 ${
                      tab === t
                        ? "border-sky-700 text-sky-700 font-medium"
                        : "border-transparent text-slate-600"
                    }`}>
              {t === "inventory" ? "Inventory Summary" : "All Cylinders"}
            </button>
          ))}
        </nav>
      </div>

      {tab === "inventory" && inv && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Stat label="Available" value={inv.totals.available} tone="emerald" />
            <Stat label="In Use" value={inv.totals.in_use} tone="blue" />
            <Stat label="Empty" value={inv.totals.empty} tone="rose" />
            <Stat label="At Vendor" value={inv.totals.at_vendor} tone="slate" />
            <Stat label="Hydro Due ≤30d" value={inv.totals.hydro_due_30d} tone="amber" />
          </div>

          <section>
            <h2 className="text-lg font-medium mb-3">Stock by Gas × Status</h2>
            <div className="border border-slate-200 rounded-md bg-white overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-2 text-xs font-medium uppercase">Gas</th>
                    {ALL_STATUSES.map(s => (
                      <th key={s} className="text-center px-3 py-2 text-xs font-medium uppercase">
                        {STATUS_LABELS[s]}
                      </th>
                    ))}
                    <th className="text-center px-3 py-2 text-xs font-medium uppercase">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(inv.stock_by_gas_status).map(([gas, statuses]) => {
                    const total = Object.values(statuses).reduce((a, b) => a + b, 0);
                    return (
                      <tr key={gas} className="border-b border-slate-100 last:border-0">
                        <td className="px-4 py-2 font-medium">{GAS_LABELS[gas] || gas}</td>
                        {ALL_STATUSES.map(s => {
                          const c = (statuses as any)[s] ?? 0;
                          return (
                            <td key={s} className={`text-center px-3 py-2 ${
                              c === 0 ? "text-slate-300" : "font-medium"
                            }`}>
                              {c}
                            </td>
                          );
                        })}
                        <td className="text-center px-3 py-2 font-semibold">{total}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {inv.hydro_due.length > 0 && (
            <section>
              <h2 className="text-lg font-medium mb-3">
                Hydro Test Due within 30 days ({inv.hydro_due.length})
              </h2>
              <div className="border border-amber-200 bg-amber-50 rounded-md overflow-hidden">
                <table className="min-w-full text-sm">
                  <thead className="bg-amber-100 border-b border-amber-200">
                    <tr>
                      <th className="text-left px-3 py-2 text-xs font-medium uppercase">Serial</th>
                      <th className="text-left px-3 py-2 text-xs font-medium uppercase">Gas / Size</th>
                      <th className="text-left px-3 py-2 text-xs font-medium uppercase">Due Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inv.hydro_due.map((c) => (
                      <tr key={c.id} className="border-b border-amber-100 last:border-0">
                        <td className="px-3 py-2 font-mono text-xs">{c.serial_number}</td>
                        <td className="px-3 py-2">
                          {GAS_LABELS[c.cylinder_type__gas_type]} {c.cylinder_type__size}
                        </td>
                        <td className="px-3 py-2">
                          {new Date(c.next_hydro_test_due).toLocaleDateString("en-IN")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}

      {tab === "cylinders" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {cylinders.map((c: Cylinder) => (
            <CylinderCard key={c.id} cylinder={c} />
          ))}
        </div>
      )}
    </div>
  );
}


function CylinderCard({ cylinder }: { cylinder: Cylinder }) {
  const queryClient = useQueryClient();
  const [showActions, setShowActions] = useState(false);

  const issue = useMutation({
    mutationFn: (loc: string) => cylindersApi.issue(cylinder.id, { location: loc }),
    onSuccess: () => {
      setShowActions(false);
      queryClient.invalidateQueries({ queryKey: ["cylinders-all"] });
    },
  });
  const ret = useMutation({
    mutationFn: (pct: number) => cylindersApi.returnCyl(cylinder.id, { fill_percentage: pct }),
    onSuccess: () => {
      setShowActions(false);
      queryClient.invalidateQueries({ queryKey: ["cylinders-all"] });
    },
  });

  return (
    <div className={`border-2 rounded-lg p-3 ${STATUS_COLORS[cylinder.status]}`}>
      <div className="flex items-start justify-between">
        <div className="font-mono text-xs">{cylinder.serial_number}</div>
        <span className="text-xs uppercase font-medium">{cylinder.status_label}</span>
      </div>
      <div className="text-sm font-medium mt-1">
        {cylinder.type_gas} {cylinder.type_size}
      </div>
      <div className="text-xs mt-1">
        Fill: <strong>{cylinder.fill_percentage}%</strong>
        {cylinder.current_location && (
          <span> · 📍 {cylinder.current_location}</span>
        )}
      </div>
      {cylinder.is_hydro_test_due && (
        <div className="mt-1 text-xs text-rose-700 font-medium">
          ⚠ Hydro test due
        </div>
      )}

      <button onClick={() => setShowActions(!showActions)}
              className="text-xs underline mt-2">
        {showActions ? "Hide" : "Actions"}
      </button>
      {showActions && (
        <div className="mt-2 flex gap-2 flex-wrap">
          {(cylinder.status === "AVAILABLE" || cylinder.status === "PARTIAL") && (
            <button onClick={() => {
              const loc = prompt("Issue to location:");
              if (loc) issue.mutate(loc);
            }} className="text-xs px-2 py-1 bg-blue-600 text-white rounded">
              Issue
            </button>
          )}
          {cylinder.status === "IN_USE" && (
            <button onClick={() => {
              const pct = prompt("Current fill % (0-100):");
              if (pct) ret.mutate(parseInt(pct, 10));
            }} className="text-xs px-2 py-1 bg-emerald-600 text-white rounded">
              Return
            </button>
          )}
        </div>
      )}
    </div>
  );
}


function Stat({ label, value, tone }: {
  label: string; value: number;
  tone: "emerald" | "blue" | "amber" | "rose" | "slate";
}) {
  const tones: Record<string, string> = {
    emerald: "border-emerald-300 bg-emerald-50/30",
    blue:    "border-blue-300 bg-blue-50/30",
    amber:   "border-amber-300 bg-amber-50/30",
    rose:    "border-rose-300 bg-rose-50/30",
    slate:   "border-slate-300 bg-slate-50/30",
  };
  return (
    <div className={`border rounded-lg p-4 ${tones[tone]}`}>
      <div className="text-xs font-medium uppercase tracking-wide opacity-70">{label}</div>
      <div className="text-3xl font-semibold mt-1">{value}</div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { inventoryApi } from "@/lib/api/blood_bank";
import type { InventorySummary, BloodGroup, ComponentType } from "@/types/blood_bank";

const ALL_GROUPS: BloodGroup[] = [
  "A_POS", "A_NEG", "B_POS", "B_NEG",
  "AB_POS", "AB_NEG", "O_POS", "O_NEG",
];
const GROUP_LABELS: Record<BloodGroup, string> = {
  A_POS: "A+", A_NEG: "A-",
  B_POS: "B+", B_NEG: "B-",
  AB_POS: "AB+", AB_NEG: "AB-",
  O_POS: "O+", O_NEG: "O-",
};
const ALL_COMPONENTS: ComponentType[] = ["WHOLE", "PRBC", "FFP", "PLATELETS", "CRYO"];
const COMPONENT_LABELS: Record<ComponentType, string> = {
  WHOLE: "Whole", PRBC: "PRBC", FFP: "FFP", PLATELETS: "Platelets", CRYO: "Cryo",
};


export default function BloodBankDashboardPage() {
  const { data, isLoading } = useQuery<InventorySummary>({
    queryKey: ["bb-inventory"],
    queryFn: async () => (await inventoryApi.summary()).data,
    refetchInterval: 60000,
  });

  if (isLoading) {
    return <div className="p-8 text-slate-500">Loading inventory…</div>;
  }
  if (!data) return <div className="p-8 text-slate-500">No data.</div>;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Blood Bank</h1>
          <p className="text-sm text-slate-500 mt-1">
            Inventory as of {new Date(data.as_of).toLocaleDateString("en-IN")}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/dashboard/blood-bank/donors"
            className="px-4 py-2 text-sm border border-slate-300 rounded-md hover:bg-slate-50"
          >
            Donors
          </Link>
          <Link
            href="/dashboard/blood-bank/donors/new"
            className="px-4 py-2 text-sm border border-slate-300 rounded-md hover:bg-slate-50"
          >
            + Donor
          </Link>
          <Link
            href="/dashboard/blood-bank/donations/new"
            className="px-4 py-2 text-sm border border-slate-300 rounded-md hover:bg-slate-50"
          >
            + Donation
          </Link>
          <Link
            href="/dashboard/blood-bank/requisitions"
            className="px-4 py-2 text-sm bg-rose-700 text-white rounded-md hover:bg-rose-800"
          >
            Requisitions
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Stat label="Available" value={data.totals.available} tone="emerald" />
        <Stat label="Reserved" value={data.totals.reserved} tone="indigo" />
        <Stat label="Quarantine" value={data.totals.quarantine} tone="amber" />
        <Stat label="Expiring Soon" value={data.totals.expiring_soon} tone="amber" />
        <Stat label="Expired" value={data.totals.expired_pending_discard} tone="rose" />
      </div>

      {/* Stock matrix */}
      <section>
        <h2 className="text-lg font-medium text-slate-900 mb-3">
          Stock by Group × Component
        </h2>
        <div className="overflow-auto border border-slate-200 rounded-md bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-2 text-xs font-medium text-slate-600 uppercase">
                  Blood Group
                </th>
                {ALL_COMPONENTS.map((c) => (
                  <th key={c} className="text-center px-3 py-2 text-xs font-medium text-slate-600 uppercase">
                    {COMPONENT_LABELS[c]}
                  </th>
                ))}
                <th className="text-center px-3 py-2 text-xs font-medium text-slate-600 uppercase">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {ALL_GROUPS.map((g) => {
                const row = data.stock_by_group_component[g] ?? {};
                const total = Object.values(row).reduce((a, b) => a + b, 0);
                return (
                  <tr key={g} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-2 font-medium">{GROUP_LABELS[g]}</td>
                    {ALL_COMPONENTS.map((c) => {
                      const count = row[c] ?? 0;
                      const cls =
                        count === 0
                          ? "text-slate-300"
                          : count < 3
                          ? "bg-amber-50 text-amber-800 font-medium"
                          : "bg-emerald-50 text-emerald-800 font-medium";
                      return (
                        <td key={c} className={`text-center px-3 py-2 ${cls}`}>
                          {count}
                        </td>
                      );
                    })}
                    <td className="text-center px-3 py-2 font-semibold">
                      {total}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Expiring soon */}
      {data.expiring_soon.length > 0 && (
        <section>
          <h2 className="text-lg font-medium text-slate-900 mb-3">
            Expiring within 7 days ({data.expiring_soon.length})
          </h2>
          <div className="border border-amber-200 rounded-md bg-amber-50 overflow-hidden">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-amber-100 text-amber-900 border-b border-amber-200">
                  <th className="text-left px-3 py-2 text-xs font-medium uppercase">Bag ID</th>
                  <th className="text-left px-3 py-2 text-xs font-medium uppercase">Group</th>
                  <th className="text-left px-3 py-2 text-xs font-medium uppercase">Component</th>
                  <th className="text-left px-3 py-2 text-xs font-medium uppercase">Expires</th>
                  <th className="text-left px-3 py-2 text-xs font-medium uppercase">Location</th>
                </tr>
              </thead>
              <tbody>
                {data.expiring_soon.map((b) => (
                  <tr key={b.id} className="border-b border-amber-100 last:border-0">
                    <td className="px-3 py-2 font-mono text-xs">{b.bag_id}</td>
                    <td className="px-3 py-2">{GROUP_LABELS[b.blood_group]}</td>
                    <td className="px-3 py-2">{COMPONENT_LABELS[b.component]}</td>
                    <td className="px-3 py-2">{new Date(b.expiry_date).toLocaleDateString("en-IN")}</td>
                    <td className="px-3 py-2 text-slate-600">{b.storage_location || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}


function Stat({
  label, value, tone,
}: {
  label: string; value: number;
  tone: "emerald" | "indigo" | "amber" | "rose";
}) {
  const tones: Record<string, string> = {
    emerald: "border-emerald-300 bg-emerald-50/40 text-emerald-900",
    indigo:  "border-indigo-300 bg-indigo-50/40 text-indigo-900",
    amber:   "border-amber-300 bg-amber-50/40 text-amber-900",
    rose:    "border-rose-300 bg-rose-50/40 text-rose-900",
  };
  return (
    <div className={`border rounded-lg p-4 ${tones[tone]}`}>
      <div className="text-xs font-medium uppercase tracking-wide opacity-80">
        {label}
      </div>
      <div className="text-3xl font-semibold mt-1">{value}</div>
    </div>
  );
}

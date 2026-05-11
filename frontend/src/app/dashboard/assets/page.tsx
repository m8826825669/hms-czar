"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { assetMetricsApi, assetsApi } from "@/lib/api/phase4a";
import type { AssetMetrics, Asset } from "@/types/phase4a";


export default function AssetsDashboardPage() {
  const { data: metrics } = useQuery<AssetMetrics>({
    queryKey: ["asset-metrics"],
    queryFn: async () => (await assetMetricsApi.get()).data,
  });

  const { data: recentAssets = [] } = useQuery({
    queryKey: ["assets-recent"],
    queryFn: async () => (await assetsApi.list()).data,
  });

  if (!metrics) return <div className="p-8 text-slate-500">Loading…</div>;

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Asset Register</h1>
          <p className="text-sm text-slate-500 mt-1">
            Equipment, IT, furniture, vehicles — purchase, AMC, maintenance
          </p>
        </div>
        <Link href="/dashboard/assets/maintenance"
              className="px-4 py-2 text-sm bg-sky-700 text-white rounded-md hover:bg-sky-800">
          Maintenance Logs
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Total Assets" value={metrics.total_assets} />
        <Stat label="Active" value={metrics.active_assets} tone="emerald" />
        <Stat label="Under Repair" value={metrics.under_repair} tone="amber" />
        <Stat label="AMC Expiring ≤30d" value={metrics.amcs_expiring_30d} tone="rose" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="border border-slate-200 rounded-md bg-white p-4">
          <h2 className="text-lg font-medium mb-3">Book Value</h2>
          <div className="text-4xl font-semibold">
            ₹{Number(metrics.total_book_value).toLocaleString("en-IN", {
              maximumFractionDigits: 0,
            })}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Total purchase cost of all non-disposed assets
          </div>
        </section>

        <section className="border border-slate-200 rounded-md bg-white p-4">
          <h2 className="text-lg font-medium mb-3">By Category</h2>
          <div className="space-y-1">
            {metrics.by_category.map(c => (
              <div key={c.category__code} className="flex justify-between text-sm">
                <span>{c.category__name}</span>
                <span className="text-slate-500">
                  {c.count} · ₹{Number(c.value).toLocaleString("en-IN", {
                    maximumFractionDigits: 0,
                  })}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section>
        <h2 className="text-lg font-medium mb-3">Asset Register</h2>
        <div className="border border-slate-200 rounded-md bg-white overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-3 py-2 text-xs font-medium uppercase">Code</th>
                <th className="text-left px-3 py-2 text-xs font-medium uppercase">Name</th>
                <th className="text-left px-3 py-2 text-xs font-medium uppercase">Category</th>
                <th className="text-left px-3 py-2 text-xs font-medium uppercase">Serial</th>
                <th className="text-right px-3 py-2 text-xs font-medium uppercase">Cost</th>
                <th className="text-right px-3 py-2 text-xs font-medium uppercase">Book Value</th>
                <th className="text-center px-3 py-2 text-xs font-medium uppercase">Status</th>
              </tr>
            </thead>
            <tbody>
              {recentAssets.length === 0 && (
                <tr><td colSpan={7} className="text-center py-8 text-slate-500 italic">
                  No assets registered yet.
                </td></tr>
              )}
              {recentAssets.slice(0, 30).map((a: Asset) => (
                <tr key={a.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="px-3 py-2 font-mono text-xs">{a.asset_code}</td>
                  <td className="px-3 py-2">{a.name}</td>
                  <td className="px-3 py-2 text-xs text-slate-600">{a.category_name}</td>
                  <td className="px-3 py-2 font-mono text-xs">{a.serial_number}</td>
                  <td className="px-3 py-2 text-right">
                    ₹{Number(a.purchase_cost).toLocaleString("en-IN", {
                      maximumFractionDigits: 0,
                    })}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-600">
                    ₹{Number(a.book_value).toLocaleString("en-IN", {
                      maximumFractionDigits: 0,
                    })}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      a.status === "ACTIVE"   ? "bg-emerald-100 text-emerald-800" :
                      a.status === "DISPOSED" ? "bg-slate-200 text-slate-600" :
                                                "bg-amber-100 text-amber-800"
                    }`}>
                      {a.status_label}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}


function Stat({ label, value, tone = "slate" }: {
  label: string; value: number;
  tone?: "slate" | "rose" | "amber" | "emerald";
}) {
  const tones: Record<string, string> = {
    slate: "border-slate-300",
    rose: "border-rose-300 bg-rose-50/30",
    amber: "border-amber-300 bg-amber-50/30",
    emerald: "border-emerald-300 bg-emerald-50/30",
  };
  return (
    <div className={`border rounded-lg p-4 ${tones[tone]}`}>
      <div className="text-xs font-medium uppercase opacity-70">{label}</div>
      <div className="text-3xl font-semibold mt-1">{value}</div>
    </div>
  );
}

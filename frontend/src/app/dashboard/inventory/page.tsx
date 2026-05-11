"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { stockSummaryApi, storesApi } from "@/lib/api/phase4a";
import type { StockSummaryRow, StoreLocation } from "@/types/phase4a";


export default function InventoryDashboardPage() {
  const [storeFilter, setStoreFilter] = useState("");
  const [lowOnly, setLowOnly] = useState(false);

  const { data: stores = [] } = useQuery({
    queryKey: ["stores"],
    queryFn: async () => (await storesApi.list()).data,
  });

  const { data: summary } = useQuery({
    queryKey: ["stock-summary", storeFilter, lowOnly],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (storeFilter) params.store = storeFilter;
      if (lowOnly) params.low_stock = "true";
      return (await stockSummaryApi.get(params)).data;
    },
  });

  const { data: expiring = [] } = useQuery({
    queryKey: ["expiring-batches"],
    queryFn: async () => (await stockSummaryApi.expiring(60)).data,
  });

  const rows: StockSummaryRow[] = summary?.summary ?? [];

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Inventory / Stores</h1>
          <p className="text-sm text-slate-500 mt-1">
            Stock levels, POs, requisitions
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/inventory/purchase-orders"
                className="px-4 py-2 text-sm border border-slate-300 rounded-md hover:bg-slate-50">
            Purchase Orders
          </Link>
          <Link href="/dashboard/inventory/requisitions"
                className="px-4 py-2 text-sm bg-sky-700 text-white rounded-md hover:bg-sky-800">
            Requisitions
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Items in Stock" value={rows.length} />
        <Stat label="Low Stock" value={rows.filter(r => Number(r.total_qty) < Number(r.item__reorder_level)).length}
              tone="rose" />
        <Stat label="Expiring ≤60d" value={expiring.length} tone="amber" />
        <Stat label="Active Stores" value={stores.filter((s: StoreLocation) => s.is_active).length} />
      </div>

      <section>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
          <h2 className="text-lg font-medium">Stock Summary</h2>
          <div className="flex gap-2 items-center">
            <select value={storeFilter} onChange={(e) => setStoreFilter(e.target.value)}
                    className="border border-slate-300 rounded px-2 py-1 text-sm">
              <option value="">All stores</option>
              {stores.map((s: StoreLocation) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <label className="text-sm flex items-center gap-1">
              <input type="checkbox" checked={lowOnly}
                     onChange={(e) => setLowOnly(e.target.checked)} />
              Low stock only
            </label>
          </div>
        </div>
        <div className="border border-slate-200 rounded-md bg-white overflow-hidden">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-3 py-2 text-xs font-medium uppercase">Code</th>
                <th className="text-left px-3 py-2 text-xs font-medium uppercase">Item</th>
                <th className="text-left px-3 py-2 text-xs font-medium uppercase">Store</th>
                <th className="text-right px-3 py-2 text-xs font-medium uppercase">Stock</th>
                <th className="text-right px-3 py-2 text-xs font-medium uppercase">Reorder</th>
                <th className="text-center px-3 py-2 text-xs font-medium uppercase">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={6} className="text-center py-8 text-slate-500 italic">
                  No stock found.
                </td></tr>
              )}
              {rows.map((r, idx) => {
                const qty = Number(r.total_qty);
                const reorder = Number(r.item__reorder_level);
                const low = reorder > 0 && qty < reorder;
                return (
                  <tr key={`${r.item}-${r.store}-${idx}`}
                      className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className="px-3 py-2 font-mono text-xs">{r.item__code}</td>
                    <td className="px-3 py-2">{r.item__name}</td>
                    <td className="px-3 py-2 text-slate-600">{r.store__code}</td>
                    <td className="px-3 py-2 text-right font-medium">
                      {qty} <span className="text-xs text-slate-500">{r.item__uom}</span>
                    </td>
                    <td className="px-3 py-2 text-right text-slate-500">{reorder}</td>
                    <td className="px-3 py-2 text-center">
                      {low ? (
                        <span className="text-xs px-2 py-0.5 bg-rose-100 text-rose-800 rounded">
                          LOW
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded">
                          OK
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {expiring.length > 0 && (
        <section>
          <h2 className="text-lg font-medium mb-3">Expiring within 60 days ({expiring.length})</h2>
          <div className="border border-amber-200 bg-amber-50 rounded-md overflow-hidden">
            <table className="min-w-full text-sm">
              <thead className="bg-amber-100 border-b border-amber-200">
                <tr>
                  <th className="text-left px-3 py-2 text-xs font-medium uppercase">Item</th>
                  <th className="text-left px-3 py-2 text-xs font-medium uppercase">Batch</th>
                  <th className="text-left px-3 py-2 text-xs font-medium uppercase">Store</th>
                  <th className="text-right px-3 py-2 text-xs font-medium uppercase">Qty</th>
                  <th className="text-left px-3 py-2 text-xs font-medium uppercase">Expires</th>
                </tr>
              </thead>
              <tbody>
                {expiring.map((b: any) => (
                  <tr key={b.id} className="border-b border-amber-100 last:border-0">
                    <td className="px-3 py-2">{b.item_name}</td>
                    <td className="px-3 py-2 font-mono text-xs">{b.batch_number}</td>
                    <td className="px-3 py-2 text-xs">{b.store_name}</td>
                    <td className="px-3 py-2 text-right">{b.current_quantity}</td>
                    <td className="px-3 py-2">
                      {new Date(b.expiry_date).toLocaleDateString("en-IN")}
                    </td>
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

function Stat({ label, value, tone = "slate" }: {
  label: string; value: number;
  tone?: "slate" | "rose" | "amber" | "emerald";
}) {
  const tones: Record<string, string> = {
    slate:   "border-slate-300",
    rose:    "border-rose-300 bg-rose-50/30",
    amber:   "border-amber-300 bg-amber-50/30",
    emerald: "border-emerald-300 bg-emerald-50/30",
  };
  return (
    <div className={`border rounded-lg p-4 ${tones[tone]}`}>
      <div className="text-xs font-medium uppercase opacity-70">{label}</div>
      <div className="text-3xl font-semibold mt-1">{value}</div>
    </div>
  );
}

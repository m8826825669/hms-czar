"use client";

import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { purchaseOrdersApi } from "@/lib/api/phase4a";
import type { PurchaseOrder } from "@/types/phase4a";

const STATUS_CHIPS: Record<string, string> = {
  DRAFT:     "bg-slate-100 text-slate-700",
  SUBMITTED: "bg-indigo-100 text-indigo-800",
  APPROVED:  "bg-emerald-100 text-emerald-800",
  SENT:      "bg-blue-100 text-blue-800",
  PARTIAL:   "bg-amber-100 text-amber-800",
  RECEIVED:  "bg-emerald-200 text-emerald-900",
  CLOSED:    "bg-slate-100 text-slate-500",
  CANCELLED: "bg-rose-100 text-rose-800",
};


export default function PurchaseOrdersPage() {
  const queryClient = useQueryClient();

  const { data: pos = [] } = useQuery({
    queryKey: ["purchase-orders"],
    queryFn: async () => await purchaseOrdersApi.list(),
  });

  const submit = useMutation({
    mutationFn: (id: number) => purchaseOrdersApi.submit(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["purchase-orders"] }),
  });
  const approve = useMutation({
    mutationFn: (id: number) => purchaseOrdersApi.approve(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["purchase-orders"] }),
  });

  return (
    <div className="p-6 space-y-5 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Purchase Orders</h1>
          <p className="text-sm text-slate-500 mt-1">
            {pos.length} order{pos.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Link href="/dashboard/inventory"
              className="px-4 py-2 text-sm border border-slate-300 rounded-md hover:bg-slate-50">
          ← Dashboard
        </Link>
      </div>

      <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-3">
        ℹ️ Create POs via Django Admin <code>/admin/inventory/purchaseorder/</code> for now —
        full create-PO form coming in a follow-up phase. List + status actions work below.
      </p>

      <div className="border border-slate-200 rounded-md bg-white overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-3 py-2 text-xs font-medium uppercase">Code</th>
              <th className="text-left px-3 py-2 text-xs font-medium uppercase">Supplier</th>
              <th className="text-left px-3 py-2 text-xs font-medium uppercase">Store</th>
              <th className="text-left px-3 py-2 text-xs font-medium uppercase">Order Date</th>
              <th className="text-right px-3 py-2 text-xs font-medium uppercase">Total</th>
              <th className="text-center px-3 py-2 text-xs font-medium uppercase">Status</th>
              <th className="text-center px-3 py-2 text-xs font-medium uppercase">Action</th>
            </tr>
          </thead>
          <tbody>
            {pos.length === 0 && (
              <tr><td colSpan={7} className="text-center py-8 text-slate-500 italic">
                No purchase orders yet.
              </td></tr>
            )}
            {pos.map((po: PurchaseOrder) => (
              <tr key={po.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <td className="px-3 py-2 font-mono text-xs">{po.code}</td>
                <td className="px-3 py-2">{po.supplier_name}</td>
                <td className="px-3 py-2 text-slate-600">{po.store_name}</td>
                <td className="px-3 py-2 text-slate-600">
                  {new Date(po.order_date).toLocaleDateString("en-IN")}
                </td>
                <td className="px-3 py-2 text-right font-semibold">
                  ₹{Number(po.total_amount).toLocaleString("en-IN")}
                </td>
                <td className="px-3 py-2 text-center">
                  <span className={`text-xs px-2 py-0.5 rounded ${STATUS_CHIPS[po.status]}`}>
                    {po.status_label}
                  </span>
                </td>
                <td className="px-3 py-2 text-center">
                  {po.status === "DRAFT" && (
                    <button onClick={() => submit.mutate(po.id)}
                            disabled={submit.isPending}
                            className="text-xs px-2 py-1 bg-indigo-600 text-white rounded">
                      Submit
                    </button>
                  )}
                  {po.status === "SUBMITTED" && (
                    <button onClick={() => approve.mutate(po.id)}
                            disabled={approve.isPending}
                            className="text-xs px-2 py-1 bg-emerald-600 text-white rounded">
                      Approve
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

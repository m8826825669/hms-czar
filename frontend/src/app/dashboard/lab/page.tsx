"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { labOrdersApi } from "@/lib/api/lab";
import type { LabOrder, LabOrderStatus, LabOrderPriority } from "@/types/lab";

const STATUS_BADGE: Record<LabOrderStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  ORDERED: "bg-amber-100 text-amber-800",
  COLLECTED: "bg-blue-100 text-blue-800",
  IN_PROGRESS: "bg-indigo-100 text-indigo-800",
  REPORTED: "bg-emerald-100 text-emerald-800",
  CANCELLED: "bg-slate-100 text-slate-500 line-through",
};

const PRIORITY_BADGE: Record<LabOrderPriority, string> = {
  ROUTINE: "bg-slate-100 text-slate-700",
  URGENT: "bg-orange-100 text-orange-800",
  STAT: "bg-red-100 text-red-800 ring-1 ring-red-300",
};

export default function LabDashboardPage() {
  const today = useQuery({
    queryKey: ["lab-today"],
    queryFn: labOrdersApi.today,
    refetchInterval: 30_000,
  });

  const abnormal = useQuery({
    queryKey: ["lab-abnormal"],
    queryFn: labOrdersApi.abnormal,
    refetchInterval: 60_000,
  });

  const t = today.data;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Laboratory</h1>
          <p className="text-sm text-slate-500 mt-1">
            Diagnostic orders, sample collection, and result entry
          </p>
        </div>
        <Link
          href="/dashboard/lab/orders/new"
          className="px-4 py-2 bg-sky-600 text-white rounded-md hover:bg-sky-700 text-sm font-medium"
        >
          + New Lab Order
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Today's Orders"
          value={t?.order_count ?? "—"}
          tone="sky"
        />
        <StatCard
          title="Pending Collection"
          value={t?.pending_collection ?? "—"}
          tone="amber"
          subtitle="Awaiting sample"
        />
        <StatCard
          title="In Progress"
          value={t?.in_progress ?? "—"}
          tone="indigo"
          subtitle="Tests running"
        />
        <StatCard
          title="STAT Priority"
          value={t?.stat_orders ?? "—"}
          tone="red"
          subtitle="Need urgent attention"
        />
      </div>

      {/* Today's orders */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-800">Today's Orders</h2>
          {today.isFetching && (
            <span className="text-xs text-slate-400">refreshing…</span>
          )}
        </div>
        {today.isLoading ? (
          <div className="p-12 text-center text-slate-400">Loading…</div>
        ) : !t?.orders.length ? (
          <div className="p-12 text-center text-slate-400">
            No lab orders today. Click "New Lab Order" to create one.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-left text-xs uppercase tracking-wide">
              <tr>
                <th className="px-5 py-2 font-medium">Code</th>
                <th className="px-5 py-2 font-medium">Patient</th>
                <th className="px-5 py-2 font-medium">Tests</th>
                <th className="px-5 py-2 font-medium">Priority</th>
                <th className="px-5 py-2 font-medium">Status</th>
                <th className="px-5 py-2 font-medium text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {t.orders.map((o) => (
                <OrderRow key={o.id} order={o} />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Abnormal results */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-800">
            Abnormal Results <span className="text-xs text-slate-500 font-normal">(last 7 days)</span>
          </h2>
        </div>
        {abnormal.isLoading ? (
          <div className="p-8 text-center text-slate-400">Loading…</div>
        ) : !abnormal.data?.length ? (
          <div className="p-8 text-center text-slate-400">No abnormal results in the last 7 days.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-left text-xs uppercase tracking-wide">
              <tr>
                <th className="px-5 py-2 font-medium">Code</th>
                <th className="px-5 py-2 font-medium">Patient</th>
                <th className="px-5 py-2 font-medium">Date</th>
                <th className="px-5 py-2 font-medium text-center">Abnormal</th>
                <th className="px-5 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {abnormal.data.map((o) => (
                <tr key={o.id} className="hover:bg-slate-50">
                  <td className="px-5 py-2 font-mono text-xs">
                    <Link href={`/dashboard/lab/orders/${o.id}`} className="text-sky-700 hover:underline">
                      {o.code}
                    </Link>
                  </td>
                  <td className="px-5 py-2">{o.patient_name}</td>
                  <td className="px-5 py-2 text-slate-500 text-xs">{o.order_date}</td>
                  <td className="px-5 py-2 text-center">
                    <span className="inline-flex items-center justify-center min-w-[28px] h-6 px-2 rounded-full bg-red-100 text-red-700 text-xs font-medium">
                      {o.abnormal_count}
                    </span>
                  </td>
                  <td className="px-5 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[o.status]}`}>
                      {o.status_label}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function StatCard({
  title, value, tone, subtitle,
}: { title: string; value: number | string; tone: "sky" | "amber" | "indigo" | "red"; subtitle?: string }) {
  const tones = {
    sky: "border-sky-200 bg-sky-50",
    amber: "border-amber-200 bg-amber-50",
    indigo: "border-indigo-200 bg-indigo-50",
    red: "border-red-200 bg-red-50",
  };
  const accent = {
    sky: "text-sky-700",
    amber: "text-amber-700",
    indigo: "text-indigo-700",
    red: "text-red-700",
  };
  return (
    <div className={`rounded-lg border px-4 py-3 ${tones[tone]}`}>
      <div className="text-xs uppercase tracking-wide text-slate-500">{title}</div>
      <div className={`text-2xl font-semibold mt-1 ${accent[tone]}`}>{value}</div>
      {subtitle && <div className="text-xs text-slate-500 mt-0.5">{subtitle}</div>}
    </div>
  );
}

function OrderRow({ order }: { order: LabOrder }) {
  return (
    <tr className="hover:bg-slate-50">
      <td className="px-5 py-2 font-mono text-xs">
        <Link href={`/dashboard/lab/orders/${order.id}`} className="text-sky-700 hover:underline">
          {order.code}
        </Link>
      </td>
      <td className="px-5 py-2">
        <div className="font-medium text-slate-800">{order.patient_name}</div>
        <div className="text-xs text-slate-500">{order.patient_mrn}</div>
      </td>
      <td className="px-5 py-2">
        <div>{order.test_count} test{order.test_count !== 1 ? "s" : ""}</div>
        {order.abnormal_count > 0 && (
          <div className="text-xs text-red-600 font-medium">
            {order.abnormal_count} abnormal
          </div>
        )}
      </td>
      <td className="px-5 py-2">
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${PRIORITY_BADGE[order.priority]}`}>
          {order.priority_label}
        </span>
      </td>
      <td className="px-5 py-2">
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[order.status]}`}>
          {order.status_label}
        </span>
      </td>
      <td className="px-5 py-2 text-right font-mono text-sm">
        ₹{Number(order.total_amount).toFixed(2)}
      </td>
    </tr>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { theatresApi } from "@/lib/api/ot";
import type { OperationTheatre } from "@/types/ot";

const STATUS_COLORS: Record<string, string> = {
  AVAILABLE:   "bg-emerald-100 text-emerald-800",
  OCCUPIED:    "bg-blue-100 text-blue-800",
  CLEANING:    "bg-amber-100 text-amber-800",
  MAINTENANCE: "bg-slate-200 text-slate-700",
};


export default function TheatresPage() {
  const queryClient = useQueryClient();
  const { data: theatres = [], isLoading } = useQuery({
    queryKey: ["theatres-all"],
    queryFn: async () => await theatresApi.list(),
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      theatresApi.update(id, { status: status as any }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["theatres-all"] }),
  });

  if (isLoading) return <div className="p-8 text-slate-500">Loading…</div>;

  // Group by type
  const grouped: Record<string, OperationTheatre[]> = {};
  theatres.forEach((t: OperationTheatre) => {
    if (!grouped[t.theatre_type_label]) grouped[t.theatre_type_label] = [];
    grouped[t.theatre_type_label].push(t);
  });

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Operation Theatres
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {theatres.length} theatres total
          </p>
        </div>
        <Link
          href="/dashboard/ot"
          className="px-4 py-2 text-sm border border-slate-300 rounded-md hover:bg-slate-50"
        >
          ← Back to OT Dashboard
        </Link>
      </div>

      <div className="space-y-6">
        {Object.entries(grouped).map(([type, list]) => (
          <section key={type}>
            <h2 className="text-sm font-medium text-slate-700 mb-2 uppercase tracking-wide">
              {type}
            </h2>
            <div className="space-y-2">
              {list.map((t) => (
                <div
                  key={t.id}
                  className="border border-slate-200 rounded-md p-4 flex items-center justify-between bg-white"
                >
                  <div>
                    <div className="font-medium">
                      {t.code} — {t.name}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      Floor: {t.floor || "—"}
                      {!t.is_active && (
                        <span className="ml-2 text-rose-600 font-medium">
                          INACTIVE
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-1 rounded ${STATUS_COLORS[t.status]}`}>
                      {t.status_label}
                    </span>
                    <select
                      value={t.status}
                      onChange={(e) =>
                        updateStatus.mutate({ id: t.id, status: e.target.value })
                      }
                      className="text-xs border border-slate-300 rounded px-2 py-1"
                    >
                      <option value="AVAILABLE">Available</option>
                      <option value="OCCUPIED">Occupied</option>
                      <option value="CLEANING">Cleaning</option>
                      <option value="MAINTENANCE">Maintenance</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

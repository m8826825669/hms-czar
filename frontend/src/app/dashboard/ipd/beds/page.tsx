"use client";

import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { bedsApi } from "@/lib/api/ipd";
import type { BedStatus } from "@/types/ipd";

const STATUS_COLOUR: Record<BedStatus, string> = {
  AVAILABLE: "bg-emerald-100 border-emerald-300 hover:bg-emerald-200 text-emerald-800",
  OCCUPIED: "bg-blue-100 border-blue-400 hover:bg-blue-200 text-blue-900",
  RESERVED: "bg-amber-100 border-amber-400 hover:bg-amber-200 text-amber-900",
  MAINTENANCE: "bg-slate-200 border-slate-400 text-slate-600 line-through",
};

export default function BedBoardPage() {
  const qc = useQueryClient();
  const board = useQuery({
    queryKey: ["bed-board"],
    queryFn: bedsApi.availability,
    refetchInterval: 30_000,
  });

  const mark = useMutation({
    mutationFn: ({ id, status }: { id: number; status: "AVAILABLE" | "RESERVED" | "MAINTENANCE" }) =>
      bedsApi.mark(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bed-board"] }),
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/dashboard/ipd" className="text-sm text-slate-500 hover:text-sky-700">
            ← IPD dashboard
          </Link>
          <h1 className="text-2xl font-semibold text-slate-900 mt-1">Bed Board</h1>
        </div>
        <Link
          href="/dashboard/ipd/admissions/new"
          className="px-4 py-2 bg-sky-600 text-white rounded-md hover:bg-sky-700 text-sm font-medium"
        >
          + New Admission
        </Link>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-sm">
        <span className="flex items-center gap-2">
          <span className="w-3 h-3 rounded bg-emerald-300 border border-emerald-500" />
          Available
        </span>
        <span className="flex items-center gap-2">
          <span className="w-3 h-3 rounded bg-blue-300 border border-blue-500" />
          Occupied
        </span>
        <span className="flex items-center gap-2">
          <span className="w-3 h-3 rounded bg-amber-300 border border-amber-500" />
          Reserved
        </span>
        <span className="flex items-center gap-2">
          <span className="w-3 h-3 rounded bg-slate-300 border border-slate-500" />
          Maintenance
        </span>
      </div>

      {board.isLoading ? (
        <div className="p-12 text-center text-slate-400">Loading bed board…</div>
      ) : !board.data?.wards.length ? (
        <div className="p-12 text-center text-slate-400">
          No wards configured. Run <code>seed_phase2c_ipd</code> or add wards from admin.
        </div>
      ) : (
        <div className="space-y-6">
          {board.data.wards.map(w => (
            <div key={w.ward_id} className="bg-white border border-slate-200 rounded-lg overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-slate-800">
                    {w.ward_name} <span className="text-xs text-slate-500 font-mono">({w.ward_code})</span>
                  </h2>
                  <div className="text-xs text-slate-500 mt-0.5">{w.ward_type_label}</div>
                </div>
                <div className="flex gap-3 text-xs">
                  <span className="text-emerald-700 font-medium">{w.available} avail</span>
                  <span className="text-blue-700 font-medium">{w.occupied} occ</span>
                  <span className="text-slate-500">/ {w.total} total</span>
                </div>
              </div>
              <div className="p-5 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {w.beds.map(b => {
                  const className = STATUS_COLOUR[b.status];
                  return (
                    <div
                      key={b.id}
                      className={`relative border rounded-md p-3 transition cursor-default ${className}`}
                    >
                      <div className="font-mono text-sm font-bold">{b.display_code}</div>
                      <div className="text-xs mt-1 truncate">
                        {b.status === "OCCUPIED" ? (
                          <Link
                            href={`/dashboard/ipd/admissions?bed=${b.id}`}
                            className="hover:underline truncate block"
                            title={b.current_patient_name}
                          >
                            {b.current_patient_name}
                          </Link>
                        ) : (
                          <span className="opacity-70">{b.status_label}</span>
                        )}
                      </div>
                      {b.status !== "OCCUPIED" && (
                        <div className="mt-1.5 flex gap-1">
                          {b.status === "AVAILABLE" && (
                            <>
                              <button
                                onClick={() => mark.mutate({ id: b.id, status: "RESERVED" })}
                                className="text-[10px] px-1.5 py-0.5 bg-white/50 hover:bg-white border border-current rounded"
                              >
                                Reserve
                              </button>
                              <button
                                onClick={() => mark.mutate({ id: b.id, status: "MAINTENANCE" })}
                                className="text-[10px] px-1.5 py-0.5 bg-white/50 hover:bg-white border border-current rounded"
                              >
                                Maint.
                              </button>
                            </>
                          )}
                          {(b.status === "RESERVED" || b.status === "MAINTENANCE") && (
                            <button
                              onClick={() => mark.mutate({ id: b.id, status: "AVAILABLE" })}
                              className="text-[10px] px-1.5 py-0.5 bg-white/50 hover:bg-white border border-current rounded"
                            >
                              Free
                            </button>
                          )}
                        </div>
                      )}
                      <div className="text-[10px] text-slate-600 opacity-60 mt-1">
                        ₹{Number(b.bed_rent).toFixed(0)}/day
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

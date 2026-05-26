"use client";

import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { maintenanceLogsApi } from "@/lib/api/phase4a";
import type { AssetMaintenanceLog } from "@/types/phase4a";


export default function MaintenanceLogsPage() {
  const queryClient = useQueryClient();

  const { data: logs = [] } = useQuery({
    queryKey: ["maintenance-logs"],
    queryFn: async () => await maintenanceLogsApi.list(),
  });

  const complete = useMutation({
    mutationFn: ({ id, work }: { id: number; work: string }) =>
      maintenanceLogsApi.complete(id, { work_performed: work }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["maintenance-logs"] }),
  });

  return (
    <div className="p-6 space-y-5 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Maintenance Logs</h1>
          <p className="text-sm text-slate-500 mt-1">
            {logs.length} log{logs.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Link href="/dashboard/assets"
              className="px-4 py-2 text-sm border border-slate-300 rounded-md hover:bg-slate-50">
          ← Assets
        </Link>
      </div>

      <div className="space-y-2">
        {logs.length === 0 && (
          <div className="text-center py-8 text-slate-500 italic">
            No maintenance logs yet. Schedule via asset detail.
          </div>
        )}
        {logs.map((log: AssetMaintenanceLog) => (
          <div key={log.id} className="border border-slate-200 rounded-md p-3 bg-white">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <span className="font-mono text-xs text-slate-500">{log.asset_code}</span>
                <span className="ml-3 font-medium">{log.asset_name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-0.5 bg-slate-100 rounded">{log.type_label}</span>
                <span className={`text-xs px-2 py-0.5 rounded ${
                  log.status === "COMPLETED" ? "bg-emerald-100 text-emerald-800" :
                  log.status === "IN_PROGRESS" ? "bg-blue-100 text-blue-800" :
                  log.status === "CANCELLED" ? "bg-rose-100 text-rose-800" :
                                                "bg-amber-100 text-amber-800"
                }`}>{log.status_label}</span>
                {log.status === "SCHEDULED" && (
                  <button onClick={() => {
                    const work = prompt("Work performed:");
                    if (work) complete.mutate({ id: log.id, work });
                  }} className="text-xs px-2 py-1 bg-emerald-600 text-white rounded">
                    Mark Complete
                  </button>
                )}
              </div>
            </div>
            <div className="text-sm mt-1">{log.description}</div>
            <div className="text-xs text-slate-500 mt-1">
              Scheduled: {new Date(log.scheduled_date).toLocaleDateString("en-IN")}
              {log.vendor_name && <span> · Vendor: {log.vendor_name}</span>}
              {Number(log.cost) > 0 && <span> · Cost: ₹{log.cost}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

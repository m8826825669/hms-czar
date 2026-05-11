"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  complaintsDashboardApi, ticketsApi, npsApi,
} from "@/lib/api/phase4c";
import type {
  ComplaintsDashboard, Ticket, NPSResponse,
} from "@/types/phase4c";

const STATUS_CHIPS: Record<string, string> = {
  OPEN:        "bg-rose-100 text-rose-800",
  IN_PROGRESS: "bg-blue-100 text-blue-800",
  WAITING:     "bg-amber-100 text-amber-800",
  RESOLVED:    "bg-emerald-100 text-emerald-800",
  CLOSED:      "bg-slate-200 text-slate-600",
  REOPENED:    "bg-rose-200 text-rose-900",
  CANCELLED:   "bg-slate-100 text-slate-500",
};
const PRIORITY_CHIPS: Record<string, string> = {
  LOW:    "bg-slate-100 text-slate-700",
  MEDIUM: "bg-blue-100 text-blue-800",
  HIGH:   "bg-amber-100 text-amber-800",
  URGENT: "bg-rose-100 text-rose-800 font-semibold",
};


export default function ComplaintsDashboardPage() {
  const queryClient = useQueryClient();

  const { data: stats } = useQuery<ComplaintsDashboard>({
    queryKey: ["complaints-dashboard"],
    queryFn: async () => (await complaintsDashboardApi.get()).data,
    refetchInterval: 30000,
  });
  const { data: openTickets = [] } = useQuery({
    queryKey: ["tickets-open"],
    queryFn: async () => (await ticketsApi.list({ status: "OPEN" })).data,
  });
  const { data: allTickets = [] } = useQuery({
    queryKey: ["tickets-all"],
    queryFn: async () => (await ticketsApi.list()).data,
  });
  const { data: nps = [] } = useQuery({
    queryKey: ["nps"],
    queryFn: async () => (await npsApi.list()).data,
  });

  const resolve = useMutation({
    mutationFn: ({ id, resolution }: { id: number; resolution: string }) =>
      ticketsApi.resolve(id, resolution),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tickets-open"] });
      queryClient.invalidateQueries({ queryKey: ["tickets-all"] });
      queryClient.invalidateQueries({ queryKey: ["complaints-dashboard"] });
    },
  });
  const close_ = useMutation({
    mutationFn: (id: number) => ticketsApi.close(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tickets-all"] });
      queryClient.invalidateQueries({ queryKey: ["complaints-dashboard"] });
    },
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Complaints & Feedback</h1>
        <p className="text-sm text-slate-500 mt-1">
          Tickets, SLA tracking, NPS feedback
        </p>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Stat label="Open Tickets" value={stats.open_tickets} tone="rose" />
          <Stat label="SLA Breached" value={stats.sla_breached} tone="rose" />
          <Stat label="NPS Score (30d)"
                value={stats.nps_30d.nps}
                suffix=""
                tone={stats.nps_30d.nps > 50 ? "emerald" :
                       stats.nps_30d.nps > 0 ? "amber" : "rose"} />
          <Stat label="NPS Promoters" value={stats.nps_30d.promoters} tone="emerald" />
          <Stat label="NPS Detractors" value={stats.nps_30d.detractors} tone="rose" />
        </div>
      )}

      <section>
        <h2 className="text-lg font-medium mb-3">Open Tickets</h2>
        {openTickets.length === 0 ? (
          <div className="text-center py-6 text-slate-500 italic">
            No open tickets.
          </div>
        ) : (
          <div className="space-y-2">
            {openTickets.map((t: Ticket) => (
              <div key={t.id} className="border border-slate-200 rounded-md p-3 bg-white">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <span className="font-mono text-xs text-slate-500">{t.code}</span>
                    <span className="ml-3 font-medium">{t.title}</span>
                    <span className="ml-2 text-xs text-slate-500">
                      by {t.reporter_name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded ${PRIORITY_CHIPS[t.priority]}`}>
                      {t.priority_label}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded ${STATUS_CHIPS[t.status]}`}>
                      {t.status_label}
                    </span>
                    {t.is_sla_breached && (
                      <span className="text-xs px-2 py-0.5 bg-rose-200 text-rose-900 rounded font-semibold">
                        SLA Breached
                      </span>
                    )}
                    <button onClick={() => {
                      const res = prompt("Resolution:");
                      if (res) resolve.mutate({ id: t.id, resolution: res });
                    }} className="text-xs px-2 py-1 bg-emerald-600 text-white rounded">
                      Resolve
                    </button>
                  </div>
                </div>
                <div className="text-sm mt-1 text-slate-700">{t.description}</div>
                <div className="text-xs text-slate-500 mt-1">
                  {t.category_name}
                  {t.related_department_name && <span> · {t.related_department_name}</span>}
                  {t.target_resolution_at && (
                    <span> · SLA by {new Date(t.target_resolution_at).toLocaleString("en-IN")}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-medium mb-3">Resolved (Awaiting Close)</h2>
        <div className="space-y-2">
          {allTickets.filter((t: Ticket) => t.status === "RESOLVED").map((t: Ticket) => (
            <div key={t.id} className="border border-slate-200 rounded-md p-3 bg-white">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <span className="font-mono text-xs text-slate-500">{t.code}</span>
                  <span className="ml-3 font-medium">{t.title}</span>
                </div>
                <button onClick={() => close_.mutate(t.id)}
                        className="text-xs px-2 py-1 bg-slate-700 text-white rounded">
                  Close
                </button>
              </div>
              <div className="text-sm mt-1 text-emerald-700">{t.resolution}</div>
            </div>
          ))}
          {allTickets.filter((t: Ticket) => t.status === "RESOLVED").length === 0 && (
            <div className="text-center py-4 text-slate-500 italic text-sm">
              No resolved tickets pending close.
            </div>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-medium mb-3">Recent NPS Feedback</h2>
        <div className="space-y-2">
          {nps.slice(0, 10).map((n: NPSResponse) => (
            <div key={n.id} className="border border-slate-200 rounded-md p-3 bg-white">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <span className="font-medium">{n.reporter_name}</span>
                  {n.related_department_name && (
                    <span className="ml-2 text-xs text-slate-500">
                      · {n.related_department_name}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    n.category === "PROMOTER" ? "bg-emerald-100 text-emerald-800" :
                    n.category === "PASSIVE" ? "bg-amber-100 text-amber-800" :
                                                "bg-rose-100 text-rose-800"
                  }`}>
                    {n.category} · {n.score}/10
                  </span>
                </div>
              </div>
              {n.feedback && (
                <div className="text-sm mt-1 text-slate-700 italic">"{n.feedback}"</div>
              )}
            </div>
          ))}
          {nps.length === 0 && (
            <div className="text-center py-4 text-slate-500 italic text-sm">
              No NPS responses yet. Collect via POST /api/complaints/nps/
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, tone = "slate", suffix = "" }: {
  label: string; value: number; suffix?: string;
  tone?: "slate" | "emerald" | "amber" | "rose";
}) {
  const tones: Record<string, string> = {
    slate: "border-slate-300",
    emerald: "border-emerald-300 bg-emerald-50/30",
    amber: "border-amber-300 bg-amber-50/30",
    rose: "border-rose-300 bg-rose-50/30",
  };
  return (
    <div className={`border rounded-lg p-3 ${tones[tone]}`}>
      <div className="text-xs font-medium uppercase opacity-70">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}{suffix}</div>
    </div>
  );
}

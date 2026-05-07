"use client";
import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { publicApi } from "@/lib/api/billing";

export default function PublicQueueTVPage() {
  const { hospitalId } = useParams<{ hospitalId: string }>();
  const search = useSearchParams();
  const doctorId = search.get("doctor");
  const locationId = search.get("location");

  const hospId = Number(hospitalId);

  const { data, isLoading } = useQuery({
    queryKey: ["public-queue", hospId, doctorId, locationId],
    queryFn: () => publicApi.queue(hospId, {
      doctor: doctorId ? Number(doctorId) : undefined,
      location: locationId ? Number(locationId) : undefined,
    }),
    refetchInterval: 5000,
    enabled: !!hospId,
  });

  // Live clock
  const [now, setNow] = useState<Date>(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <p className="text-2xl">Loading queue…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <header className="border-b border-slate-800 px-8 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">QUEUE STATUS</h1>
            <p className="text-xs text-slate-400">
              Auto-refreshes every 5 seconds
            </p>
          </div>
          <div className="text-right">
            <div className="font-mono text-3xl font-bold tabular-nums">
              {now.toLocaleTimeString("en-IN", { hour12: false })}
            </div>
            <div className="text-xs text-slate-400">
              {now.toLocaleDateString("en-IN", {
                weekday: "long", day: "numeric", month: "long",
              })}
            </div>
          </div>
        </div>
      </header>

      {/* Now serving — big tokens */}
      <section className="px-8 py-8">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-emerald-400">
          ▸ Now Serving
        </h2>
        {(!data?.now_serving || data.now_serving.length === 0) ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-800 p-12 text-center">
            <p className="text-2xl text-slate-500">Counter idle</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {data.now_serving.map((t, i) => (
              <div key={i}
                className="rounded-2xl border-2 border-emerald-400 bg-emerald-950/40 p-6 shadow-2xl shadow-emerald-900/40">
                <div className="text-center">
                  <div className="font-mono text-7xl font-black tracking-tight tabular-nums text-emerald-300">
                    {t.token_no}
                  </div>
                  <div className="mt-2 text-base font-semibold text-emerald-100">
                    {t.doctor}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Waiting list */}
      <section className="px-8 pb-8">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-amber-400">
          ▸ Waiting ({data?.waiting_count ?? 0})
        </h2>
        {(!data?.waiting || data.waiting.length === 0) ? (
          <p className="text-center text-lg text-slate-500">No patients in queue</p>
        ) : (
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4">
            {data.waiting.map((t, i) => (
              <div key={i}
                className="rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-mono text-2xl font-bold tabular-nums text-amber-200">
                    {t.token_no}
                  </div>
                  <div className="flex-1 text-right">
                    <div className="truncate text-sm text-slate-300">{t.doctor}</div>
                    <div className="text-xs text-slate-500">
                      {t.status === "IN_VITALS" ? "At vitals desk" : "Waiting"}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Footer stats */}
      <footer className="fixed bottom-0 left-0 right-0 border-t border-slate-800 bg-slate-950/95 px-8 py-3 backdrop-blur">
        <div className="flex items-center justify-between text-sm">
          <div className="flex gap-6 text-slate-400">
            <span>
              <span className="text-emerald-400 font-bold">
                {data?.now_serving?.length ?? 0}
              </span>{" "}
              now serving
            </span>
            <span>
              <span className="text-amber-400 font-bold">
                {data?.waiting_count ?? 0}
              </span>{" "}
              waiting
            </span>
            <span>
              <span className="text-slate-300 font-bold">
                {data?.completed_today ?? 0}
              </span>{" "}
              completed today
            </span>
          </div>
          <div className="text-xs text-slate-500">
            {data?.as_of && (
              <>
                Last updated:{" "}
                {new Date(data.as_of).toLocaleTimeString("en-IN", { hour12: false })}
              </>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}

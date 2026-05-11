"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { bookingsApi } from "@/lib/api/ot";
import type { OTDashboard, SurgeryBooking, OperationTheatre } from "@/types/ot";

const THEATRE_STATUS_COLORS: Record<string, string> = {
  AVAILABLE:   "bg-emerald-50 border-emerald-300 text-emerald-900",
  OCCUPIED:    "bg-blue-50 border-blue-400 text-blue-900",
  CLEANING:    "bg-amber-50 border-amber-300 text-amber-900",
  MAINTENANCE: "bg-slate-100 border-slate-400 text-slate-700",
};

const STATUS_CHIPS: Record<string, string> = {
  SCHEDULED:   "bg-slate-100 text-slate-700",
  CHECKED_IN:  "bg-indigo-100 text-indigo-800",
  IN_PROGRESS: "bg-blue-100 text-blue-800",
  COMPLETED:   "bg-emerald-100 text-emerald-800",
  CANCELLED:   "bg-rose-100 text-rose-800",
  POSTPONED:   "bg-amber-100 text-amber-800",
};

const URGENCY_CHIPS: Record<string, string> = {
  ELECTIVE:  "bg-slate-100 text-slate-600",
  URGENT:    "bg-amber-100 text-amber-800",
  EMERGENCY: "bg-rose-100 text-rose-800 font-semibold",
};


export default function OTDashboardPage() {
  const { data, isLoading } = useQuery<OTDashboard>({
    queryKey: ["ot-dashboard"],
    queryFn: async () => (await bookingsApi.today()).data,
    refetchInterval: 30000,
  });

  if (isLoading) {
    return <div className="p-8 text-slate-500">Loading OT dashboard…</div>;
  }
  if (!data) {
    return <div className="p-8 text-slate-500">No data.</div>;
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Operation Theatre — Today
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {new Date(data.date).toLocaleDateString("en-IN", {
              weekday: "long", year: "numeric", month: "long", day: "numeric",
            })}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/dashboard/ot/theatres"
            className="px-4 py-2 text-sm border border-slate-300 rounded-md hover:bg-slate-50"
          >
            Manage Theatres
          </Link>
          <Link
            href="/dashboard/ot/bookings/new"
            className="px-4 py-2 text-sm bg-sky-700 text-white rounded-md hover:bg-sky-800"
          >
            + Book Surgery
          </Link>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Scheduled" value={data.counts.scheduled} tone="slate" />
        <StatCard label="In Progress" value={data.counts.in_progress} tone="blue" />
        <StatCard label="Completed" value={data.counts.completed} tone="emerald" />
        <StatCard label="Cancelled" value={data.counts.cancelled} tone="rose" />
      </div>

      {/* Theatre grid */}
      <section>
        <h2 className="text-lg font-medium text-slate-900 mb-3">
          Theatre Status
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {data.theatres.map((t) => (
            <TheatreCard key={t.id} theatre={t} />
          ))}
        </div>
      </section>

      {/* Today's bookings */}
      <section>
        <h2 className="text-lg font-medium text-slate-900 mb-3">
          Today's Surgeries ({data.bookings.length})
        </h2>
        {data.bookings.length === 0 ? (
          <div className="text-sm text-slate-500 italic border border-dashed border-slate-300 rounded-md p-8 text-center">
            No surgeries scheduled today.
          </div>
        ) : (
          <div className="space-y-2">
            {data.bookings.map((b) => (
              <BookingRow key={b.id} booking={b} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}


function StatCard({
  label, value, tone,
}: { label: string; value: number; tone: "slate" | "blue" | "emerald" | "rose" }) {
  const tones: Record<string, string> = {
    slate:   "border-slate-200",
    blue:    "border-blue-300 bg-blue-50/30",
    emerald: "border-emerald-300 bg-emerald-50/30",
    rose:    "border-rose-300 bg-rose-50/30",
  };
  return (
    <div className={`border ${tones[tone]} rounded-lg p-4`}>
      <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">
        {label}
      </div>
      <div className="text-3xl font-semibold text-slate-900 mt-1">{value}</div>
    </div>
  );
}


function TheatreCard({ theatre }: { theatre: OperationTheatre }) {
  const cls = THEATRE_STATUS_COLORS[theatre.status] ?? "border-slate-300";
  return (
    <div className={`border-2 rounded-lg p-3 ${cls}`}>
      <div className="flex items-start justify-between">
        <div className="font-semibold text-sm">{theatre.code}</div>
        <span className="text-xs uppercase font-medium tracking-wider">
          {theatre.status_label}
        </span>
      </div>
      <div className="text-xs mt-1 opacity-80">{theatre.name}</div>
      <div className="text-xs mt-1 opacity-60">
        {theatre.theatre_type_label} · {theatre.floor || "—"} floor
      </div>
    </div>
  );
}


function BookingRow({ booking }: { booking: SurgeryBooking }) {
  const start = new Date(booking.scheduled_start);
  const end = new Date(booking.scheduled_end);
  return (
    <Link
      href={`/dashboard/ot/bookings/${booking.id}`}
      className="block border border-slate-200 rounded-md p-3 hover:bg-slate-50 transition"
    >
      <div className="flex items-center gap-3 flex-wrap">
        <span className="font-mono text-xs text-slate-500 w-32">
          {start.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
          {" – "}
          {end.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
        </span>
        <span className="font-medium text-slate-900 flex-1 min-w-[200px]">
          {booking.procedure_name}
        </span>
        <span className="text-xs text-slate-600 min-w-[100px]">
          {booking.theatre_code}
        </span>
        <span className="text-sm text-slate-600 min-w-[150px]">
          {booking.patient_name}
        </span>
        <span className={`text-xs px-2 py-0.5 rounded ${URGENCY_CHIPS[booking.urgency]}`}>
          {booking.urgency_label}
        </span>
        <span className={`text-xs px-2 py-0.5 rounded ${STATUS_CHIPS[booking.status]}`}>
          {booking.status_label}
        </span>
      </div>
      <div className="text-xs text-slate-500 mt-1">
        {booking.code} · Surgeon: {booking.primary_surgeon_name}
        {booking.anaesthetist_name && ` · Anaes: ${booking.anaesthetist_name}`}
      </div>
    </Link>
  );
}

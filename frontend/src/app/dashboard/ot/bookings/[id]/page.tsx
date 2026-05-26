"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { bookingsApi } from "@/lib/api/ot";
import type { SurgeryBooking, OTRegister } from "@/types/ot";

const STATUS_CHIPS: Record<string, string> = {
  SCHEDULED:   "bg-slate-100 text-slate-700 border-slate-300",
  CHECKED_IN:  "bg-indigo-100 text-indigo-800 border-indigo-300",
  IN_PROGRESS: "bg-blue-100 text-blue-800 border-blue-300",
  COMPLETED:   "bg-emerald-100 text-emerald-800 border-emerald-300",
  CANCELLED:   "bg-rose-100 text-rose-800 border-rose-300",
  POSTPONED:   "bg-amber-100 text-amber-800 border-amber-300",
};


export default function SurgeryBookingDetailPage() {
  const params = useParams();
  const id = Number(params?.id);
  const queryClient = useQueryClient();

  const { data: booking, isLoading } = useQuery<SurgeryBooking>({
    queryKey: ["booking", id],
    queryFn: async () => await bookingsApi.get(id),
    enabled: !!id,
    refetchInterval: 15000,
  });

  if (isLoading || !booking) {
    return <div className="p-8 text-slate-500">Loading…</div>;
  }

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["booking", id] });

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-slate-900">
              {booking.procedure_name}
            </h1>
            <span className={`text-xs px-2 py-1 rounded border ${STATUS_CHIPS[booking.status]}`}>
              {booking.status_label}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1 font-mono">{booking.code}</p>
        </div>

        <ActionBar booking={booking} onChange={refresh} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-6">
          <PatientCard booking={booking} />
          <TeamSection booking={booking} onChange={refresh} />
          <ConsumablesSection booking={booking} onChange={refresh} />
          <RegisterEditor booking={booking} onChange={refresh} />
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <SidebarCard title="Theatre">
            <div className="font-medium">{booking.theatre_code}</div>
            <div className="text-xs text-slate-500">{booking.theatre_name}</div>
          </SidebarCard>
          <SidebarCard title="Procedure">
            <div className="font-medium">{booking.procedure_name}</div>
            <div className="text-xs text-slate-500">{booking.procedure_category}</div>
          </SidebarCard>
          <SidebarCard title="Schedule">
            <div className="text-sm">
              <strong>Scheduled:</strong>{" "}
              {new Date(booking.scheduled_start).toLocaleString("en-IN")}
              {" → "}
              {new Date(booking.scheduled_end).toLocaleTimeString("en-IN", {
                hour: "2-digit", minute: "2-digit",
              })}
            </div>
            {booking.actual_start && (
              <div className="text-sm mt-1">
                <strong>Actual:</strong>{" "}
                {new Date(booking.actual_start).toLocaleTimeString("en-IN", {
                  hour: "2-digit", minute: "2-digit",
                })}
                {booking.actual_end && (
                  <>
                    {" → "}
                    {new Date(booking.actual_end).toLocaleTimeString("en-IN", {
                      hour: "2-digit", minute: "2-digit",
                    })}
                    <span className="ml-2 text-slate-500">
                      ({booking.duration_minutes} min)
                    </span>
                  </>
                )}
              </div>
            )}
          </SidebarCard>
          <SidebarCard title="Pricing">
            <div className="text-sm">
              <strong>₹{booking.locked_procedure_price}</strong>
              {Number(booking.locked_gst_rate) > 0 && (
                <span className="text-slate-500 text-xs">
                  {" "}+ {booking.locked_gst_rate}% GST
                </span>
              )}
            </div>
            {booking.invoice_code && (
              <Link
                href={`/dashboard/billing/invoices/${booking.invoice}`}
                className="text-xs text-sky-700 hover:underline mt-1 inline-block"
              >
                Invoice: {booking.invoice_code} ({booking.invoice_status})
              </Link>
            )}
            {booking.admission_code && (
              <div className="text-xs text-slate-500 mt-1">
                Billed to admission: {booking.admission_code}
              </div>
            )}
          </SidebarCard>
          {booking.pre_op_diagnosis && (
            <SidebarCard title="Pre-op Diagnosis">
              <div className="text-sm">{booking.pre_op_diagnosis}</div>
            </SidebarCard>
          )}
        </div>
      </div>
    </div>
  );
}


function ActionBar({
  booking, onChange,
}: { booking: SurgeryBooking; onChange: () => void }) {
  const checkIn = useMutation({
    mutationFn: () => bookingsApi.checkIn(booking.id),
    onSuccess: onChange,
  });
  const start = useMutation({
    mutationFn: () => bookingsApi.start(booking.id),
    onSuccess: onChange,
  });
  const complete = useMutation({
    mutationFn: () => bookingsApi.complete(booking.id, true),
    onSuccess: onChange,
  });
  const cancel = useMutation({
    mutationFn: (reason: string) => bookingsApi.cancel(booking.id, reason),
    onSuccess: onChange,
  });

  const buttons = [];
  if (booking.status === "SCHEDULED") {
    buttons.push(
      <Btn key="ci" tone="indigo" onClick={() => checkIn.mutate()}>Check-In Patient</Btn>
    );
  }
  if (booking.status === "CHECKED_IN") {
    buttons.push(
      <Btn key="st" tone="blue" onClick={() => start.mutate()}>Start Surgery</Btn>
    );
  }
  if (booking.status === "IN_PROGRESS") {
    buttons.push(
      <Btn key="cm" tone="emerald" onClick={() => {
        if (confirm("Complete the surgery? This will generate billing."))
          complete.mutate();
      }}>Complete Surgery</Btn>
    );
  }
  if (!["COMPLETED", "CANCELLED"].includes(booking.status)) {
    buttons.push(
      <Btn key="cn" tone="rose" onClick={() => {
        const reason = prompt("Cancellation reason:");
        if (reason) cancel.mutate(reason);
      }}>Cancel</Btn>
    );
  }
  if (booking.status === "COMPLETED") {
    buttons.push(
      <a
        key="pdf"
        href={bookingsApi.registerPdfUrl(booking.id)}
        target="_blank"
        rel="noreferrer"
        className="px-4 py-2 text-sm border border-slate-300 rounded-md hover:bg-slate-50"
      >
        ↓ Register PDF
      </a>
    );
  }

  return <div className="flex gap-2 flex-wrap">{buttons}</div>;
}


function Btn({
  children, onClick, tone,
}: {
  children: React.ReactNode; onClick: () => void;
  tone: "blue" | "emerald" | "rose" | "indigo" | "slate";
}) {
  const tones: Record<string, string> = {
    blue:    "bg-blue-600 hover:bg-blue-700",
    emerald: "bg-emerald-600 hover:bg-emerald-700",
    rose:    "bg-rose-600 hover:bg-rose-700",
    indigo:  "bg-indigo-600 hover:bg-indigo-700",
    slate:   "bg-slate-600 hover:bg-slate-700",
  };
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm text-white rounded-md ${tones[tone]}`}
    >
      {children}
    </button>
  );
}


function PatientCard({ booking }: { booking: SurgeryBooking }) {
  return (
    <Card title="Patient">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        <Cell label="Name" value={booking.patient_name} />
        <Cell label="MRN" value={booking.patient_mrn} />
        <Cell label="Age / Gender"
              value={`${booking.patient_age ?? "—"} / ${booking.patient_gender || "—"}`} />
        <Cell label="Urgency" value={booking.urgency_label} />
      </div>
      {booking.pre_op_assessment && (
        <div className="mt-3 text-sm text-slate-700">
          <span className="font-medium">Pre-op Assessment: </span>
          {booking.pre_op_assessment}
        </div>
      )}
    </Card>
  );
}


function TeamSection({
  booking, onChange,
}: { booking: SurgeryBooking; onChange: () => void }) {
  const [showAdd, setShowAdd] = useState(false);
  const [role, setRole] = useState("ASSISTANT");
  const [memberName, setMemberName] = useState("");

  const add = useMutation({
    mutationFn: () => bookingsApi.addTeamMember(booking.id, {
      role, member_name: memberName,
    }),
    onSuccess: () => { setShowAdd(false); setMemberName(""); onChange(); },
  });

  return (
    <Card
      title={`Surgical Team (${booking.team.length})`}
      action={
        booking.status !== "COMPLETED" && booking.status !== "CANCELLED" && (
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="text-xs text-sky-700 hover:underline"
          >
            {showAdd ? "Cancel" : "+ Add Member"}
          </button>
        )
      }
    >
      <table className="w-full text-sm">
        <thead className="text-xs text-slate-500 uppercase border-b border-slate-200">
          <tr>
            <th className="text-left py-2">Role</th>
            <th className="text-left py-2">Member</th>
          </tr>
        </thead>
        <tbody>
          {booking.team.map((tm) => (
            <tr key={tm.id} className="border-b border-slate-100 last:border-0">
              <td className="py-2">{tm.role_label}</td>
              <td className="py-2">{tm.display_name}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {showAdd && (
        <div className="mt-3 p-3 bg-slate-50 rounded-md grid grid-cols-3 gap-2 items-end">
          <div>
            <label className="text-xs text-slate-600 block mb-1">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full border border-slate-300 rounded px-2 py-1 text-sm"
            >
              <option value="ASSISTANT">Assistant Surgeon</option>
              <option value="NURSE_SCRUB">Scrub Nurse</option>
              <option value="NURSE_CIRCULATING">Circulating Nurse</option>
              <option value="TECHNICIAN">OT Technician</option>
              <option value="PERFUSIONIST">Perfusionist</option>
              <option value="OBSERVER">Observer</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-600 block mb-1">Name</label>
            <input
              value={memberName}
              onChange={(e) => setMemberName(e.target.value)}
              placeholder="e.g. Sister Mary"
              className="w-full border border-slate-300 rounded px-2 py-1 text-sm"
            />
          </div>
          <button
            onClick={() => add.mutate()}
            disabled={!memberName || add.isPending}
            className="px-3 py-1 bg-sky-700 text-white rounded text-sm disabled:bg-slate-300"
          >
            Add
          </button>
        </div>
      )}
    </Card>
  );
}


function ConsumablesSection({
  booking, onChange,
}: { booking: SurgeryBooking; onChange: () => void }) {
  const [showAdd, setShowAdd] = useState(false);
  const [item, setItem] = useState("");
  const [qty, setQty] = useState("1");
  const [price, setPrice] = useState("");
  const [unit, setUnit] = useState("pcs");
  const [gstRate, setGstRate] = useState("0");

  const add = useMutation({
    mutationFn: () => bookingsApi.addConsumable(booking.id, {
      item_name: item, quantity: qty, unit_price: price, unit, gst_rate: gstRate,
    }),
    onSuccess: () => {
      setShowAdd(false); setItem(""); setQty("1"); setPrice("");
      onChange();
    },
  });

  const total = booking.consumables.reduce(
    (s, c) => s + Number(c.total), 0,
  );

  return (
    <Card
      title={`Consumables (${booking.consumables.length})`}
      action={
        booking.status !== "COMPLETED" && booking.status !== "CANCELLED" && (
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="text-xs text-sky-700 hover:underline"
          >
            {showAdd ? "Cancel" : "+ Add Item"}
          </button>
        )
      }
    >
      {booking.consumables.length === 0 ? (
        <p className="text-sm text-slate-500 italic">No consumables recorded.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-xs text-slate-500 uppercase border-b border-slate-200">
            <tr>
              <th className="text-left py-2">Item</th>
              <th className="text-right py-2">Qty</th>
              <th className="text-right py-2">Unit Price</th>
              <th className="text-right py-2">GST</th>
              <th className="text-right py-2">Total</th>
            </tr>
          </thead>
          <tbody>
            {booking.consumables.map((c) => (
              <tr key={c.id} className="border-b border-slate-100 last:border-0">
                <td className="py-2">{c.item_name}</td>
                <td className="py-2 text-right">{c.quantity} {c.unit}</td>
                <td className="py-2 text-right">₹{c.unit_price}</td>
                <td className="py-2 text-right text-slate-500">{c.gst_rate}%</td>
                <td className="py-2 text-right font-medium">₹{c.total}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-slate-300">
              <td colSpan={4} className="py-2 text-right font-medium">Total</td>
              <td className="py-2 text-right font-semibold">₹{total.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
      )}

      {showAdd && (
        <div className="mt-3 p-3 bg-slate-50 rounded-md grid grid-cols-6 gap-2 items-end">
          <div className="col-span-2">
            <label className="text-xs text-slate-600 block mb-1">Item</label>
            <input
              value={item}
              onChange={(e) => setItem(e.target.value)}
              placeholder="e.g. Vicryl 2-0 suture"
              className="w-full border border-slate-300 rounded px-2 py-1 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-slate-600 block mb-1">Qty</label>
            <input
              type="number" step="0.01"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              className="w-full border border-slate-300 rounded px-2 py-1 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-slate-600 block mb-1">Unit</label>
            <input
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="w-full border border-slate-300 rounded px-2 py-1 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-slate-600 block mb-1">Price (₹)</label>
            <input
              type="number" step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full border border-slate-300 rounded px-2 py-1 text-sm"
            />
          </div>
          <button
            onClick={() => add.mutate()}
            disabled={!item || !price || add.isPending}
            className="px-3 py-1 bg-sky-700 text-white rounded text-sm disabled:bg-slate-300"
          >
            Add
          </button>
        </div>
      )}
    </Card>
  );
}


function RegisterEditor({
  booking, onChange,
}: { booking: SurgeryBooking; onChange: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const reg = booking.ot_register ?? null;
  const [fields, setFields] = useState<Partial<OTRegister>>(reg ?? {});
  const finalized = reg?.is_finalized;

  const save = useMutation({
    mutationFn: (finalize: boolean) =>
      bookingsApi.upsertRegister(booking.id, { ...fields, finalize }),
    onSuccess: onChange,
  });

  const field = (k: keyof OTRegister, multiline = true, rows = 2) => (
    <div>
      <label className="text-xs text-slate-600 block mb-1 font-medium">
        {String(k).replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
      </label>
      {multiline ? (
        <textarea
          rows={rows}
          value={(fields[k] as string) ?? ""}
          onChange={(e) => setFields({ ...fields, [k]: e.target.value })}
          disabled={finalized}
          className="w-full border border-slate-300 rounded px-2 py-1 text-sm disabled:bg-slate-100"
        />
      ) : (
        <input
          value={(fields[k] as any) ?? ""}
          onChange={(e) => setFields({ ...fields, [k]: e.target.value })}
          disabled={finalized}
          className="w-full border border-slate-300 rounded px-2 py-1 text-sm disabled:bg-slate-100"
        />
      )}
    </div>
  );

  return (
    <Card
      title="OT Register"
      action={
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-sky-700 hover:underline"
        >
          {expanded ? "Collapse" : "Expand"}
        </button>
      }
    >
      {!expanded ? (
        <p className="text-sm text-slate-500">
          {reg && reg.surgical_steps
            ? `Last updated ${new Date(reg.prepared_at).toLocaleString("en-IN")}`
            : "Not yet started."}
          {finalized && (
            <span className="ml-2 px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded text-xs">
              ✓ Finalized
            </span>
          )}
        </p>
      ) : (
        <div className="space-y-3">
          {field("pre_op_findings")}
          {field("surgical_steps", true, 5)}
          {field("intra_op_findings")}
          {field("complications", true, 2)}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-600 block mb-1 font-medium">
                Blood Loss (ml)
              </label>
              <input
                type="number"
                value={(fields.blood_loss_ml as any) ?? 0}
                onChange={(e) => setFields({ ...fields, blood_loss_ml: Number(e.target.value) })}
                disabled={finalized}
                className="w-full border border-slate-300 rounded px-2 py-1 text-sm disabled:bg-slate-100"
              />
            </div>
            <div>
              <label className="text-xs text-slate-600 block mb-1 font-medium">
                Blood Transfused (units)
              </label>
              <input
                type="number"
                value={(fields.blood_transfused_units as any) ?? 0}
                onChange={(e) => setFields({ ...fields, blood_transfused_units: Number(e.target.value) })}
                disabled={finalized}
                className="w-full border border-slate-300 rounded px-2 py-1 text-sm disabled:bg-slate-100"
              />
            </div>
          </div>
          {field("anaesthesia_type", false)}
          {field("anaesthesia_notes")}
          {field("instruments_used")}
          {field("implants_used", true, 2)}
          {field("specimens_sent", true, 2)}
          {field("post_op_orders", true, 3)}
          {field("condition_on_shifting", false)}

          {!finalized && (
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                onClick={() => save.mutate(false)}
                disabled={save.isPending}
                className="px-4 py-2 text-sm border border-slate-300 rounded-md hover:bg-slate-50"
              >
                Save Draft
              </button>
              <button
                onClick={() => {
                  if (confirm("Finalize the register? This cannot be undone."))
                    save.mutate(true);
                }}
                disabled={save.isPending}
                className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-md hover:bg-emerald-700"
              >
                Finalize
              </button>
            </div>
          )}
          {save.isError && (
            <div className="text-xs text-rose-600 mt-2">
              {(save.error as any)?.response?.data?.detail
                ?? (save.error as Error).message}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}


function Card({
  title, children, action,
}: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="border border-slate-200 rounded-lg p-4 bg-white">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-slate-900">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function SidebarCard({
  title, children,
}: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-slate-200 rounded-lg p-3 bg-white">
      <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
        {title}
      </div>
      {children}
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="text-xs text-slate-500 uppercase">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}

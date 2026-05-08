"use client";

import { use, useState, useEffect } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { admissionsApi, bedsApi } from "@/lib/api/ipd";
import type { Admission, AdmissionStatus, BedAvailability } from "@/types/ipd";

const STATUS_BADGE: Record<AdmissionStatus, string> = {
  ADMITTED: "bg-blue-100 text-blue-800 ring-blue-300",
  DISCHARGED: "bg-emerald-100 text-emerald-800 ring-emerald-300",
  ABSCONDED: "bg-orange-100 text-orange-800 ring-orange-300",
  DAMA: "bg-amber-100 text-amber-800 ring-amber-300",
  EXPIRED: "bg-slate-300 text-slate-800 ring-slate-400",
  TRANSFERRED: "bg-indigo-100 text-indigo-800 ring-indigo-300",
  CANCELLED: "bg-slate-100 text-slate-500 ring-slate-200",
};

export default function AdmissionDetailPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const admissionId = Number(id);
  const qc = useQueryClient();

  const { data: admission, isLoading } = useQuery({
    queryKey: ["admission", admissionId],
    queryFn: () => admissionsApi.get(admissionId),
    refetchInterval: (q) =>
      q.state.data?.status === "ADMITTED" ? 30_000 : false,
  });

  if (isLoading || !admission) {
    return <div className="p-12 text-center text-slate-400">Loading…</div>;
  }

  const isActive = admission.status === "ADMITTED";

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link
            href="/dashboard/ipd"
            className="text-sm text-slate-500 hover:text-sky-700"
          >
            ← IPD dashboard
          </Link>
          <div className="flex items-center gap-3 mt-1">
            <h1 className="text-2xl font-semibold text-slate-900 font-mono">
              {admission.code}
            </h1>
            <span
              className={`px-3 py-1 rounded-full text-xs font-medium ring-1 ${
                STATUS_BADGE[admission.status]
              }`}
            >
              {admission.status_label}
            </span>
          </div>
        </div>

        <div className="flex gap-2">
          {admission.status === "DISCHARGED" && (
            <a
              href={admissionsApi.dischargePdfUrl(admissionId)}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 text-sm font-medium"
            >
              📄 Download Discharge Summary
            </a>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Patient + clinical info */}
          <PatientCard admission={admission} />

          {/* Discharge actions / status */}
          {isActive && (
            <DischargePanel admission={admission} qc={qc} />
          )}
          {admission.status === "DISCHARGED" && admission.invoice_code && (
            <DischargedInvoiceCard admission={admission} />
          )}

          {/* Add service form (active only) */}
          {isActive && (
            <AddServicePanel admission={admission} qc={qc} />
          )}

          {/* Daily charges */}
          <DailyChargesCard admission={admission} qc={qc} />

          {/* Admission services */}
          <AdmissionServicesCard admission={admission} />

          {/* Discharge summary editor (active or discharged) */}
          <DischargeSummaryEditor admission={admission} qc={qc} />
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <BedCard admission={admission} qc={qc} />
          <AttendingDoctorCard admission={admission} />
          <StayCard admission={admission} />
          <BillingCard admission={admission} />
        </div>
      </div>
    </div>
  );
}

// ─── Cards ─────────────────────────────────────────────────────────────────────

function PatientCard({ admission }: { admission: Admission }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5">
      <h2 className="text-base font-semibold text-slate-800 mb-4">Patient</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
        <Field label="Name" value={admission.patient_name} sub={admission.patient_mrn} />
        <Field label="Age / Gender" value={`${admission.patient_age}y / ${admission.patient_gender}`} />
        <Field label="Phone" value={admission.patient_phone} />
        <Field label="Admission Type" value={admission.admission_type_label} />
        <Field label="Admitted At"
          value={admission.admitted_at?.replace("T", " ").substring(0, 16)} />
        <Field label="Expected Discharge"
          value={admission.expected_discharge_date ?? "—"} />
      </div>

      {admission.chief_complaint && (
        <div className="mt-4 pt-4 border-t border-slate-100">
          <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">
            Chief Complaint
          </div>
          <div className="text-sm text-slate-700">{admission.chief_complaint}</div>
        </div>
      )}

      <div className="mt-3">
        <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">
          Admission Diagnosis
        </div>
        <div className="text-sm text-slate-800 font-medium">
          {admission.admission_diagnosis}
        </div>
      </div>

      {admission.notes && (
        <div className="mt-3">
          <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">
            Notes
          </div>
          <div className="text-sm text-slate-700 whitespace-pre-line">
            {admission.notes}
          </div>
        </div>
      )}
    </div>
  );
}

function DischargePanel({
  admission, qc,
}: { admission: Admission; qc: ReturnType<typeof useQueryClient> }) {
  const [open, setOpen] = useState(false);
  const [dischargeType, setDischargeType] = useState("ROUTINE");
  const [includePharmacy, setIncludePharmacy] = useState(true);
  const [includeLab, setIncludeLab] = useState(true);

  const discharge = useMutation({
    mutationFn: () =>
      admissionsApi.discharge(admission.id, {
        discharge_type: dischargeType,
        include_pharmacy: includePharmacy,
        include_lab: includeLab,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admission", admission.id] });
      setOpen(false);
    },
  });

  if (!open) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-blue-900">Patient Currently Admitted</h3>
            <p className="text-sm text-blue-800 mt-1">
              Discharging will accrue final charges, generate an invoice, and free the bed.
            </p>
          </div>
          <button
            onClick={() => setOpen(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium whitespace-nowrap"
          >
            Discharge Patient →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-blue-300 rounded-lg p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-slate-900">Discharge Patient</h3>
        <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-700 text-xl">
          ×
        </button>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Discharge Type
        </label>
        <select
          value={dischargeType}
          onChange={(e) => setDischargeType(e.target.value)}
          className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 outline-none"
        >
          <option value="ROUTINE">Routine</option>
          <option value="DAMA">Discharge Against Medical Advice (DAMA)</option>
          <option value="ABSCONDED">Absconded</option>
          <option value="EXPIRED">Expired</option>
          <option value="TRANSFERRED">Transferred to another facility</option>
        </select>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-slate-700">
          Include in final invoice
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={includePharmacy}
            onChange={(e) => setIncludePharmacy(e.target.checked)}
          />
          Roll up pharmacy orders (COMPLETED, not yet billed)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={includeLab}
            onChange={(e) => setIncludeLab(e.target.checked)}
          />
          Roll up lab orders (not yet billed, not cancelled)
        </label>
      </div>

      {discharge.isError && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-700">
          {(discharge.error as { response?: { data?: { detail?: string } } })?.response?.data
            ?.detail ?? "Discharge failed"}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
        <button
          onClick={() => setOpen(false)}
          className="px-4 py-2 border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50 text-sm"
        >
          Cancel
        </button>
        <button
          onClick={() => discharge.mutate()}
          disabled={discharge.isPending}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
        >
          {discharge.isPending ? "Discharging…" : "Confirm Discharge"}
        </button>
      </div>
    </div>
  );
}

function DischargedInvoiceCard({ admission }: { admission: Admission }) {
  return (
    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-emerald-900">
            Discharged
          </h3>
          <p className="text-sm text-emerald-800 mt-1">
            Final invoice generated.
            Discharged at {admission.discharged_at?.replace("T", " ").substring(0, 16)}
            ({admission.discharge_type})
          </p>
        </div>
        <Link
          href={`/dashboard/billing/${admission.invoice}`}
          className="px-4 py-2 bg-white border border-emerald-300 text-emerald-700 rounded-md hover:bg-emerald-100 text-sm font-medium whitespace-nowrap"
        >
          {admission.invoice_code} →
        </Link>
      </div>
    </div>
  );
}

function AddServicePanel({
  admission, qc,
}: { admission: Admission; qc: ReturnType<typeof useQueryClient> }) {
  const [description, setDescription] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [gstRate, setGstRate] = useState("0");

  const add = useMutation({
    mutationFn: () =>
      admissionsApi.addService(admission.id, {
        description,
        unit_price: unitPrice,
        quantity: Number(quantity),
        gst_rate: gstRate,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admission", admission.id] });
      setDescription("");
      setUnitPrice("");
      setQuantity("1");
    },
  });

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5">
      <h3 className="text-base font-semibold text-slate-800 mb-3">Add Service Charge</h3>
      <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
        <div className="md:col-span-3">
          <label className="block text-xs uppercase tracking-wide text-slate-500 mb-1">
            Description
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Doctor visit charge, ECG, dressing change"
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 outline-none"
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wide text-slate-500 mb-1">
            Unit Price
          </label>
          <input
            type="number"
            value={unitPrice}
            onChange={(e) => setUnitPrice(e.target.value)}
            min={0}
            step={0.01}
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-sky-500 outline-none"
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wide text-slate-500 mb-1">
            Qty
          </label>
          <input
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            min={1}
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-sky-500 outline-none"
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wide text-slate-500 mb-1">
            GST %
          </label>
          <select
            value={gstRate}
            onChange={(e) => setGstRate(e.target.value)}
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 outline-none"
          >
            <option value="0">0%</option>
            <option value="5">5%</option>
            <option value="12">12%</option>
            <option value="18">18%</option>
            <option value="28">28%</option>
          </select>
        </div>
      </div>
      <div className="mt-3 flex justify-end">
        <button
          onClick={() => add.mutate()}
          disabled={add.isPending || !description.trim() || !unitPrice}
          className="px-4 py-2 bg-sky-600 text-white rounded-md hover:bg-sky-700 disabled:opacity-50 text-sm font-medium"
        >
          {add.isPending ? "Adding…" : "Add Service"}
        </button>
      </div>
    </div>
  );
}

function DailyChargesCard({
  admission, qc,
}: { admission: Admission; qc: ReturnType<typeof useQueryClient> }) {
  const accrue = useMutation({
    mutationFn: () => admissionsApi.accrueCharges(admission.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admission", admission.id] }),
  });

  const total = admission.daily_charges.reduce(
    (sum, c) => sum + Number(c.total),
    0,
  );

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-800">
          Daily Charges{" "}
          <span className="text-sm font-normal text-slate-500">
            ({admission.daily_charges.length} day{admission.daily_charges.length !== 1 ? "s" : ""}
            {" · ₹"}{total.toFixed(2)})
          </span>
        </h2>
        {admission.status === "ADMITTED" && (
          <button
            onClick={() => accrue.mutate()}
            disabled={accrue.isPending}
            className="px-3 py-1 text-xs border border-slate-300 text-slate-700 rounded hover:bg-slate-50 disabled:opacity-50"
          >
            {accrue.isPending ? "Refreshing…" : "Refresh Charges"}
          </button>
        )}
      </div>
      {admission.daily_charges.length === 0 ? (
        <div className="p-8 text-center text-slate-400 text-sm">
          No daily charges accrued yet.
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600 text-left text-xs uppercase tracking-wide">
            <tr>
              <th className="px-5 py-2 font-medium">Date</th>
              <th className="px-5 py-2 font-medium text-right">Bed Rent</th>
              <th className="px-5 py-2 font-medium text-right">Nursing</th>
              <th className="px-5 py-2 font-medium text-right">Other</th>
              <th className="px-5 py-2 font-medium text-right">GST</th>
              <th className="px-5 py-2 font-medium text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-mono">
            {admission.daily_charges.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="px-5 py-2 text-slate-700">{c.charge_date}</td>
                <td className="px-5 py-2 text-right">₹{Number(c.bed_rent).toFixed(2)}</td>
                <td className="px-5 py-2 text-right">₹{Number(c.nursing_charge).toFixed(2)}</td>
                <td className="px-5 py-2 text-right">₹{Number(c.other_charge).toFixed(2)}</td>
                <td className="px-5 py-2 text-right text-xs text-slate-500">
                  {Number(c.gst_rate).toFixed(0)}% · ₹{Number(c.gst_amount).toFixed(2)}
                </td>
                <td className="px-5 py-2 text-right font-medium text-slate-800">
                  ₹{Number(c.total).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function AdmissionServicesCard({ admission }: { admission: Admission }) {
  const total = admission.services.reduce((sum, s) => sum + Number(s.total), 0);
  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100">
        <h2 className="text-base font-semibold text-slate-800">
          Services{" "}
          <span className="text-sm font-normal text-slate-500">
            ({admission.services.length} item{admission.services.length !== 1 ? "s" : ""}
            {" · ₹"}{total.toFixed(2)})
          </span>
        </h2>
      </div>
      {admission.services.length === 0 ? (
        <div className="p-8 text-center text-slate-400 text-sm">
          No additional services charged yet.
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600 text-left text-xs uppercase tracking-wide">
            <tr>
              <th className="px-5 py-2 font-medium">Date</th>
              <th className="px-5 py-2 font-medium">Description</th>
              <th className="px-5 py-2 font-medium text-center">Qty</th>
              <th className="px-5 py-2 font-medium text-right">Unit</th>
              <th className="px-5 py-2 font-medium text-right">GST</th>
              <th className="px-5 py-2 font-medium text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {admission.services.map((s) => (
              <tr key={s.id} className="hover:bg-slate-50">
                <td className="px-5 py-2 text-xs text-slate-500">{s.service_date}</td>
                <td className="px-5 py-2">{s.description}</td>
                <td className="px-5 py-2 text-center">{s.quantity}</td>
                <td className="px-5 py-2 text-right font-mono">₹{Number(s.unit_price).toFixed(2)}</td>
                <td className="px-5 py-2 text-right text-xs text-slate-500 font-mono">
                  {Number(s.gst_rate).toFixed(0)}% · ₹{Number(s.gst_amount).toFixed(2)}
                </td>
                <td className="px-5 py-2 text-right font-mono font-medium">
                  ₹{Number(s.total).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function DischargeSummaryEditor({
  admission, qc,
}: { admission: Admission; qc: ReturnType<typeof useQueryClient> }) {
  const summary = admission.discharge_summary;
  const [expanded, setExpanded] = useState(!!summary);
  const [fields, setFields] = useState({
    final_diagnosis: summary?.final_diagnosis ?? admission.admission_diagnosis ?? "",
    course_in_hospital: summary?.course_in_hospital ?? "",
    procedures_done: summary?.procedures_done ?? "",
    treatment_given: summary?.treatment_given ?? "",
    investigations_summary: summary?.investigations_summary ?? "",
    condition_at_discharge: summary?.condition_at_discharge ?? "",
    discharge_advice: summary?.discharge_advice ?? "",
    medications_on_discharge: summary?.medications_on_discharge ?? "",
    follow_up_advice: summary?.follow_up_advice ?? "",
  });

  // Re-sync when admission data refreshes after upsert
  useEffect(() => {
    if (summary) {
      setFields({
        final_diagnosis: summary.final_diagnosis ?? "",
        course_in_hospital: summary.course_in_hospital ?? "",
        procedures_done: summary.procedures_done ?? "",
        treatment_given: summary.treatment_given ?? "",
        investigations_summary: summary.investigations_summary ?? "",
        condition_at_discharge: summary.condition_at_discharge ?? "",
        discharge_advice: summary.discharge_advice ?? "",
        medications_on_discharge: summary.medications_on_discharge ?? "",
        follow_up_advice: summary.follow_up_advice ?? "",
      });
    }
  }, [summary?.id, summary?.prepared_at]);

  const save = useMutation({
    mutationFn: (finalize: boolean) =>
      admissionsApi.upsertSummary(admission.id, fields, finalize),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admission", admission.id] }),
  });

  const finalized = !!summary?.is_finalized;

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-5 py-3 border-b border-slate-100 flex items-center justify-between hover:bg-slate-50"
      >
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold text-slate-800">
            Discharge Summary
          </h2>
          {summary && (
            <span
              className={`px-2 py-0.5 rounded text-xs font-medium ${
                finalized
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-amber-100 text-amber-800"
              }`}
            >
              {finalized ? "Finalized" : "Draft"}
            </span>
          )}
        </div>
        <span className="text-slate-400 text-sm">{expanded ? "▼" : "▶"}</span>
      </button>

      {expanded && (
        <div className="p-5 space-y-3">
          {finalized && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-md p-3 text-xs text-emerald-800">
              This summary has been finalized
              {summary.prepared_by_name ? ` by ${summary.prepared_by_name}` : ""} and
              cannot be edited. Download the PDF from the top of the page.
            </div>
          )}

          <SummaryField label="Final Diagnosis *"
            value={fields.final_diagnosis} onChange={(v) => setFields((f) => ({ ...f, final_diagnosis: v }))}
            disabled={finalized} highlight />
          <SummaryField label="Course in Hospital *"
            value={fields.course_in_hospital} onChange={(v) => setFields((f) => ({ ...f, course_in_hospital: v }))}
            disabled={finalized} rows={3} />
          <SummaryField label="Procedures Done"
            value={fields.procedures_done} onChange={(v) => setFields((f) => ({ ...f, procedures_done: v }))}
            disabled={finalized} rows={2} />
          <SummaryField label="Treatment Given"
            value={fields.treatment_given} onChange={(v) => setFields((f) => ({ ...f, treatment_given: v }))}
            disabled={finalized} rows={3} />
          <SummaryField label="Investigations Summary"
            value={fields.investigations_summary} onChange={(v) => setFields((f) => ({ ...f, investigations_summary: v }))}
            disabled={finalized} rows={2} />
          <SummaryField label="Condition at Discharge"
            value={fields.condition_at_discharge} onChange={(v) => setFields((f) => ({ ...f, condition_at_discharge: v }))}
            disabled={finalized} />
          <SummaryField label="Medications on Discharge"
            value={fields.medications_on_discharge} onChange={(v) => setFields((f) => ({ ...f, medications_on_discharge: v }))}
            disabled={finalized} rows={3} />
          <SummaryField label="Discharge Advice"
            value={fields.discharge_advice} onChange={(v) => setFields((f) => ({ ...f, discharge_advice: v }))}
            disabled={finalized} rows={2} />
          <SummaryField label="Follow-up Advice"
            value={fields.follow_up_advice} onChange={(v) => setFields((f) => ({ ...f, follow_up_advice: v }))}
            disabled={finalized} rows={2} />

          {save.isError && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-700">
              {(save.error as { response?: { data?: { detail?: string } } })?.response?.data
                ?.detail ?? "Save failed"}
            </div>
          )}

          {!finalized && (
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => save.mutate(false)}
                disabled={save.isPending || !fields.final_diagnosis.trim()}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50 disabled:opacity-50 text-sm"
              >
                {save.isPending ? "Saving…" : "Save Draft"}
              </button>
              <button
                onClick={() => save.mutate(true)}
                disabled={
                  save.isPending ||
                  !fields.final_diagnosis.trim() ||
                  !fields.course_in_hospital.trim()
                }
                className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50 text-sm font-medium"
              >
                Finalize & Lock
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SummaryField({
  label, value, onChange, disabled, rows = 1, highlight,
}: {
  label: string; value: string; onChange: (v: string) => void;
  disabled?: boolean; rows?: number; highlight?: boolean;
}) {
  return (
    <div>
      <label className={`block text-xs uppercase tracking-wide mb-1 ${
        highlight ? "text-amber-800 font-bold" : "text-slate-500"
      }`}>
        {label}
      </label>
      {rows > 1 ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          disabled={disabled}
          className={`w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 outline-none disabled:bg-slate-50 disabled:text-slate-700 ${
            highlight ? "border-amber-300 bg-amber-50/40" : "border-slate-300"
          }`}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={`w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 outline-none disabled:bg-slate-50 disabled:text-slate-700 ${
            highlight ? "border-amber-300 bg-amber-50/40" : "border-slate-300"
          }`}
        />
      )}
    </div>
  );
}

// ─── Sidebar ───────────────────────────────────────────────────────────────────

function BedCard({
  admission, qc,
}: { admission: Admission; qc: ReturnType<typeof useQueryClient> }) {
  const [showTransfer, setShowTransfer] = useState(false);

  const availability = useQuery({
    queryKey: ["bed-availability"],
    queryFn: bedsApi.availability,
    enabled: showTransfer,
  });

  const [newBedId, setNewBedId] = useState<number | "">("");
  const [reason, setReason] = useState("");

  const transfer = useMutation({
    mutationFn: () =>
      admissionsApi.transfer(admission.id, {
        new_bed_id: Number(newBedId),
        reason,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admission", admission.id] });
      qc.invalidateQueries({ queryKey: ["bed-availability"] });
      setShowTransfer(false);
      setNewBedId("");
      setReason("");
    },
  });

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4">
      <div className="text-xs uppercase tracking-wide text-slate-500 mb-2">Bed</div>
      <div className="font-mono text-sm font-semibold text-slate-800">
        {admission.bed_code}
      </div>
      <div className="text-xs text-slate-500 mt-0.5">{admission.ward_name}</div>

      {admission.status === "ADMITTED" && (
        <>
          {!showTransfer ? (
            <button
              onClick={() => setShowTransfer(true)}
              className="mt-3 w-full px-3 py-1.5 text-xs border border-slate-300 text-slate-700 rounded hover:bg-slate-50"
            >
              Transfer to another bed
            </button>
          ) : (
            <div className="mt-3 space-y-2 pt-3 border-t border-slate-100">
              <select
                value={newBedId}
                onChange={(e) =>
                  setNewBedId(e.target.value ? Number(e.target.value) : "")
                }
                className="w-full border border-slate-300 rounded-md px-2 py-1 text-xs"
              >
                <option value="">Select target bed…</option>
                {availability.data?.wards.flatMap((w: BedAvailability["wards"][number]) =>
                  w.beds
                    .filter((b) => b.status === "AVAILABLE")
                    .map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.display_code} ({w.name}, ₹{b.bed_rent}/day)
                      </option>
                    )),
                )}
              </select>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason for transfer"
                className="w-full border border-slate-300 rounded-md px-2 py-1 text-xs"
              />
              {transfer.isError && (
                <div className="text-xs text-red-700">
                  {(transfer.error as { response?: { data?: { detail?: string } } })
                    ?.response?.data?.detail ?? "Transfer failed"}
                </div>
              )}
              <div className="flex gap-1">
                <button
                  onClick={() => setShowTransfer(false)}
                  className="flex-1 px-2 py-1 text-xs border border-slate-300 text-slate-700 rounded hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => transfer.mutate()}
                  disabled={!newBedId || transfer.isPending}
                  className="flex-1 px-2 py-1 text-xs bg-sky-600 text-white rounded hover:bg-sky-700 disabled:opacity-50"
                >
                  Transfer
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function AttendingDoctorCard({ admission }: { admission: Admission }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4">
      <div className="text-xs uppercase tracking-wide text-slate-500 mb-2">
        Attending Doctor
      </div>
      <div className="text-sm font-medium text-slate-800">
        {admission.attending_doctor_name}
      </div>
      {admission.department_name && (
        <div className="text-xs text-slate-500 mt-0.5">{admission.department_name}</div>
      )}
    </div>
  );
}

function StayCard({ admission }: { admission: Admission }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4">
      <div className="text-xs uppercase tracking-wide text-slate-500 mb-2">
        Stay Duration
      </div>
      <div className="text-2xl font-bold text-slate-800">
        {admission.stay_days} <span className="text-sm font-normal text-slate-500">days</span>
      </div>
      <div className="text-xs text-slate-500 mt-1">
        Locked rates: ₹{Number(admission.locked_bed_rent).toFixed(2)} bed +
        ₹{Number(admission.locked_nursing_charge).toFixed(2)} nursing
      </div>
    </div>
  );
}

function BillingCard({ admission }: { admission: Admission }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4">
      <div className="text-xs uppercase tracking-wide text-slate-500 mb-2">
        Accrued Total
      </div>
      <div className="text-2xl font-bold font-mono text-slate-800">
        ₹{Number(admission.accrued_total ?? 0).toFixed(2)}
      </div>
      <div className="text-xs text-slate-500 mt-0.5">
        Daily charges + services{" "}
        {admission.status === "ADMITTED" && "(rolling)"}
      </div>

      {admission.invoice_code && (
        <Link
          href={`/dashboard/billing/${admission.invoice}`}
          className="block mt-3 pt-3 border-t border-slate-100 hover:bg-slate-50 -mx-1 px-1 rounded"
        >
          <div className="text-xs text-slate-500">Invoice</div>
          <div className="text-sm font-mono text-sky-700 hover:underline">
            {admission.invoice_code}
          </div>
        </Link>
      )}
    </div>
  );
}

function Field({
  label, value, sub,
}: { label: string; value: string | undefined; sub?: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-sm text-slate-800 font-medium">{value || "—"}</div>
      {sub && <div className="text-xs text-slate-500 font-mono">{sub}</div>}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { theatresApi, proceduresApi, bookingsApi } from "@/lib/api/ot";
import { apiClient } from "@/lib/api/client";

interface Patient {
  id: number; mrn: string; first_name: string; last_name: string; phone: string;
}
interface Doctor {
  id: number; user: { username: string; first_name: string; last_name: string };
  specialization: string;
}


export default function NewSurgeryBookingPage() {
  const router = useRouter();

  const { data: theatres = [] } = useQuery({
    queryKey: ["theatres-active"],
    queryFn: async () => (await theatresApi.list()).data,
  });
  const { data: procedures = [] } = useQuery({
    queryKey: ["procedures-active"],
    queryFn: async () => (await proceduresApi.list({ is_active: "true" })).data,
  });
  const { data: doctors = [] } = useQuery({
    queryKey: ["doctors"],
    queryFn: async () =>
      (await apiClient.get<Doctor[]>("/api/specialist/doctors/")).data,
  });

  // Patient search (debounced)
  const [patientQuery, setPatientQuery] = useState("");
  const [patient, setPatient] = useState<Patient | null>(null);
  const [patientResults, setPatientResults] = useState<Patient[]>([]);
  useEffect(() => {
    if (!patientQuery || patientQuery.length < 2) {
      setPatientResults([]);
      return;
    }
    const handle = setTimeout(async () => {
      try {
        const res = await apiClient.get<Patient[]>("/api/core/patients/", {
          params: { search: patientQuery },
        });
        setPatientResults(res.data.slice(0, 8));
      } catch {
        setPatientResults([]);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [patientQuery]);

  // Form state
  const [theatreId, setTheatreId] = useState<number | "">("");
  const [procedureId, setProcedureId] = useState<number | "">("");
  const [primarySurgeonId, setPrimarySurgeonId] = useState<number | "">("");
  const [anaesthetistId, setAnaesthetistId] = useState<number | "">("");

  // Default to next hour, 60 min duration
  const now = new Date();
  now.setHours(now.getHours() + 1, 0, 0, 0);
  const defaultEnd = new Date(now.getTime() + 60 * 60 * 1000);
  const fmt = (d: Date) => d.toISOString().slice(0, 16);

  const [scheduledStart, setScheduledStart] = useState(fmt(now));
  const [scheduledEnd, setScheduledEnd] = useState(fmt(defaultEnd));
  const [urgency, setUrgency] = useState<"ELECTIVE" | "URGENT" | "EMERGENCY">("ELECTIVE");
  const [preOpDiagnosis, setPreOpDiagnosis] = useState("");
  const [preOpAssessment, setPreOpAssessment] = useState("");
  const [consentObtained, setConsentObtained] = useState(false);
  const [admissionId, setAdmissionId] = useState<string>("");
  const [notes, setNotes] = useState("");

  // Auto-fill end time when procedure changes
  useEffect(() => {
    if (!procedureId) return;
    const proc = procedures.find((p: any) => p.id === procedureId);
    if (proc && proc.typical_duration_minutes) {
      const start = new Date(scheduledStart);
      const end = new Date(start.getTime() + proc.typical_duration_minutes * 60 * 1000);
      setScheduledEnd(fmt(end));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [procedureId]);

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!patient) throw new Error("Select a patient.");
      if (!theatreId || !procedureId || !primarySurgeonId)
        throw new Error("Theatre, procedure, and primary surgeon are required.");

      const payload: any = {
        patient: patient.id,
        theatre: theatreId,
        procedure: procedureId,
        primary_surgeon: primarySurgeonId,
        anaesthetist: anaesthetistId || null,
        scheduled_start: new Date(scheduledStart).toISOString(),
        scheduled_end: new Date(scheduledEnd).toISOString(),
        urgency,
        pre_op_diagnosis: preOpDiagnosis,
        pre_op_assessment: preOpAssessment,
        consent_obtained: consentObtained,
        notes,
      };
      if (admissionId) payload.admission = parseInt(admissionId, 10);

      return (await bookingsApi.create(payload)).data;
    },
    onSuccess: (b) => router.push(`/dashboard/ot/bookings/${b.id}`),
  });

  return (
    <div className="p-6 max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Book Surgery</h1>
        <p className="text-sm text-slate-500 mt-1">
          Schedule a new operation theatre booking with conflict checking.
        </p>
      </div>

      {createMutation.isError && (
        <div className="border border-rose-300 bg-rose-50 text-rose-800 rounded-md p-3 text-sm">
          {(createMutation.error as any)?.response?.data?.detail
            ?? (createMutation.error as Error).message}
        </div>
      )}

      <div className="space-y-5">
        {/* Patient picker */}
        <Field label="Patient *">
          {patient ? (
            <div className="flex items-center justify-between border border-slate-300 rounded-md px-3 py-2 bg-emerald-50">
              <div>
                <span className="font-medium">
                  {patient.first_name} {patient.last_name}
                </span>
                <span className="text-xs text-slate-500 ml-2">
                  MRN {patient.mrn} · {patient.phone}
                </span>
              </div>
              <button
                onClick={() => { setPatient(null); setPatientQuery(""); }}
                className="text-xs text-rose-600 hover:underline"
              >
                Change
              </button>
            </div>
          ) : (
            <div className="relative">
              <input
                type="text"
                value={patientQuery}
                onChange={(e) => setPatientQuery(e.target.value)}
                placeholder="Search by MRN, name, or phone…"
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
              />
              {patientResults.length > 0 && (
                <ul className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-md shadow max-h-60 overflow-auto">
                  {patientResults.map((p) => (
                    <li
                      key={p.id}
                      onClick={() => { setPatient(p); setPatientResults([]); }}
                      className="px-3 py-2 text-sm hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0"
                    >
                      <div className="font-medium">{p.first_name} {p.last_name}</div>
                      <div className="text-xs text-slate-500">
                        MRN {p.mrn} · {p.phone}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Theatre *">
            <select
              value={theatreId}
              onChange={(e) => setTheatreId(e.target.value ? Number(e.target.value) : "")}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="">— Select —</option>
              {theatres.map((t: any) => (
                <option key={t.id} value={t.id} disabled={!t.is_active}>
                  {t.code} — {t.name} ({t.theatre_type_label})
                </option>
              ))}
            </select>
          </Field>

          <Field label="Procedure *">
            <select
              value={procedureId}
              onChange={(e) => setProcedureId(e.target.value ? Number(e.target.value) : "")}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="">— Select —</option>
              {procedures.map((p: any) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.name} (₹{p.base_price}, {p.typical_duration_minutes} min)
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Primary Surgeon *">
            <select
              value={primarySurgeonId}
              onChange={(e) =>
                setPrimarySurgeonId(e.target.value ? Number(e.target.value) : "")
              }
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="">— Select —</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  Dr. {d.user.first_name} {d.user.last_name} ({d.specialization})
                </option>
              ))}
            </select>
          </Field>

          <Field label="Anaesthetist">
            <select
              value={anaesthetistId}
              onChange={(e) =>
                setAnaesthetistId(e.target.value ? Number(e.target.value) : "")
              }
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="">— None —</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  Dr. {d.user.first_name} {d.user.last_name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Scheduled Start *">
            <input
              type="datetime-local"
              value={scheduledStart}
              onChange={(e) => setScheduledStart(e.target.value)}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Scheduled End *">
            <input
              type="datetime-local"
              value={scheduledEnd}
              onChange={(e) => setScheduledEnd(e.target.value)}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
            />
          </Field>
        </div>

        <Field label="Urgency">
          <div className="flex gap-2">
            {(["ELECTIVE", "URGENT", "EMERGENCY"] as const).map((u) => (
              <button
                type="button"
                key={u}
                onClick={() => setUrgency(u)}
                className={`px-4 py-2 text-sm rounded-md border ${
                  urgency === u
                    ? u === "EMERGENCY"
                      ? "bg-rose-600 text-white border-rose-600"
                      : u === "URGENT"
                      ? "bg-amber-500 text-white border-amber-500"
                      : "bg-sky-700 text-white border-sky-700"
                    : "border-slate-300 text-slate-700 hover:bg-slate-50"
                }`}
              >
                {u.charAt(0) + u.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Pre-op Diagnosis">
          <input
            type="text"
            value={preOpDiagnosis}
            onChange={(e) => setPreOpDiagnosis(e.target.value)}
            placeholder="e.g. Acute appendicitis"
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
          />
        </Field>

        <Field label="Pre-op Assessment">
          <textarea
            value={preOpAssessment}
            onChange={(e) => setPreOpAssessment(e.target.value)}
            rows={3}
            placeholder="ASA grade, comorbidities, fitness for surgery, anaesthesia plan…"
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
          />
        </Field>

        <Field label="Linked IPD Admission (optional)">
          <input
            type="number"
            value={admissionId}
            onChange={(e) => setAdmissionId(e.target.value)}
            placeholder="Admission ID (leave blank for day-care surgery)"
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
          />
          <p className="text-xs text-slate-500 mt-1">
            For IPD patients, all surgery costs are added to the admission and
            billed at discharge. For day-care, a standalone invoice is created.
          </p>
        </Field>

        <Field label="Notes">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
          />
        </Field>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={consentObtained}
            onChange={(e) => setConsentObtained(e.target.checked)}
            className="rounded"
          />
          Informed consent obtained from patient / guardian
        </label>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
          <button
            onClick={() => router.back()}
            className="px-4 py-2 text-sm border border-slate-300 rounded-md hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending || !patient}
            className="px-6 py-2 text-sm bg-sky-700 text-white rounded-md hover:bg-sky-800 disabled:bg-slate-300"
          >
            {createMutation.isPending ? "Booking…" : "Book Surgery"}
          </button>
        </div>
      </div>
    </div>
  );
}


function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}

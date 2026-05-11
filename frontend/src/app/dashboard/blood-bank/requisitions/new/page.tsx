"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { requisitionsApi } from "@/lib/api/blood_bank";
import { apiClient } from "@/src/lib/api/client";

interface Patient {
  id: number; mrn: string; first_name: string; last_name: string; phone: string;
  blood_group?: string;
}
interface Doctor {
  id: number; user: { username: string; first_name: string; last_name: string };
  specialization: string;
}


export default function NewRequisitionPage() {
  const router = useRouter();

  const { data: doctors = [] } = useQuery({
    queryKey: ["doctors"],
    queryFn: async () =>
      (await apiClient.get<Doctor[]>("/api/specialist/doctors/")).data,
  });

  // Patient picker
  const [patientQuery, setPatientQuery] = useState("");
  const [patient, setPatient] = useState<Patient | null>(null);
  const [results, setResults] = useState<Patient[]>([]);
  useEffect(() => {
    if (!patientQuery || patientQuery.length < 2) { setResults([]); return; }
    const handle = setTimeout(async () => {
      try {
        const r = await apiClient.get<Patient[]>("/api/core/patients/", {
          params: { search: patientQuery },
        });
        setResults(r.data.slice(0, 8));
      } catch { setResults([]); }
    }, 300);
    return () => clearTimeout(handle);
  }, [patientQuery]);

  const [bloodGroup, setBloodGroup] = useState("O_POS");
  const [component, setComponent] = useState("PRBC");
  const [units, setUnits] = useState("1");
  const [urgency, setUrgency] = useState<"ROUTINE" | "URGENT" | "EMERGENCY">("ROUTINE");
  const [purpose, setPurpose] = useState("");
  const [requestedBy, setRequestedBy] = useState<number | "">("");
  const [admissionId, setAdmissionId] = useState("");
  const [notes, setNotes] = useState("");

  const create = useMutation({
    mutationFn: () => {
      const payload: any = {
        patient: patient!.id,
        requested_by: requestedBy,
        blood_group: bloodGroup,
        component,
        units_required: Number(units),
        urgency,
        purpose,
        notes,
      };
      if (admissionId) payload.admission = Number(admissionId);
      return requisitionsApi.create(payload);
    },
    onSuccess: (resp) =>
      router.push(`/dashboard/blood-bank/requisitions/${resp.data.id}`),
  });

  return (
    <div className="p-6 max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">New Blood Requisition</h1>
      </div>

      {create.isError && (
        <div className="border border-rose-300 bg-rose-50 text-rose-800 rounded p-3 text-sm">
          {(create.error as any)?.response?.data?.detail
            ?? (create.error as Error).message}
        </div>
      )}

      <Field label="Patient *">
        {patient ? (
          <div className="border border-emerald-300 bg-emerald-50 rounded p-3 flex justify-between items-center">
            <div>
              <div className="font-medium">{patient.first_name} {patient.last_name}</div>
              <div className="text-xs text-slate-500">MRN {patient.mrn} · {patient.phone}</div>
            </div>
            <button onClick={() => setPatient(null)}
                    className="text-xs text-rose-600 hover:underline">Change</button>
          </div>
        ) : (
          <div className="relative">
            <input value={patientQuery} onChange={(e) => setPatientQuery(e.target.value)}
                   placeholder="Search by MRN, name, or phone…"
                   className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
            {results.length > 0 && (
              <ul className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-md shadow max-h-60 overflow-auto">
                {results.map((p) => (
                  <li key={p.id} onClick={() => { setPatient(p); setResults([]); }}
                      className="px-3 py-2 text-sm hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0">
                    <div className="font-medium">{p.first_name} {p.last_name}</div>
                    <div className="text-xs text-slate-500">MRN {p.mrn} · {p.phone}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Field>

      <div className="grid grid-cols-3 gap-4">
        <Field label="Blood Group *">
          <select value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value)}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm">
            {[["A_POS","A+"],["A_NEG","A-"],["B_POS","B+"],["B_NEG","B-"],
              ["AB_POS","AB+"],["AB_NEG","AB-"],["O_POS","O+"],["O_NEG","O-"]].map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </Field>
        <Field label="Component *">
          <select value={component} onChange={(e) => setComponent(e.target.value)}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm">
            <option value="WHOLE">Whole Blood</option>
            <option value="PRBC">PRBC</option>
            <option value="FFP">FFP</option>
            <option value="PLATELETS">Platelets</option>
            <option value="CRYO">Cryoprecipitate</option>
          </select>
        </Field>
        <Field label="Units Required *">
          <input type="number" min={1} value={units}
                 onChange={(e) => setUnits(e.target.value)}
                 className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
        </Field>
      </div>

      <Field label="Urgency *">
        <div className="flex gap-2">
          {(["ROUTINE", "URGENT", "EMERGENCY"] as const).map((u) => (
            <button type="button" key={u} onClick={() => setUrgency(u)}
                    className={`px-4 py-2 text-sm rounded-md border ${
                      urgency === u
                        ? u === "EMERGENCY"
                          ? "bg-rose-600 text-white border-rose-600"
                          : u === "URGENT"
                          ? "bg-amber-500 text-white border-amber-500"
                          : "bg-sky-700 text-white border-sky-700"
                        : "border-slate-300 text-slate-700 hover:bg-slate-50"
                    }`}>
              {u.charAt(0) + u.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Requested By (Doctor) *">
        <select value={requestedBy}
                onChange={(e) => setRequestedBy(e.target.value ? Number(e.target.value) : "")}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm">
          <option value="">— Select —</option>
          {doctors.map((d) => (
            <option key={d.id} value={d.id}>
              Dr. {d.user.first_name} {d.user.last_name} ({d.specialization})
            </option>
          ))}
        </select>
      </Field>

      <Field label="Clinical Indication / Purpose *">
        <textarea value={purpose} onChange={(e) => setPurpose(e.target.value)}
                  rows={2}
                  placeholder="e.g. Severe anaemia, Hb 6.2 g/dL"
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
      </Field>

      <Field label="Linked IPD Admission (optional)">
        <input type="number" value={admissionId}
               onChange={(e) => setAdmissionId(e.target.value)}
               placeholder="Admission ID (for in-patients)"
               className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
      </Field>

      <Field label="Notes">
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
      </Field>

      <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
        <button onClick={() => router.back()}
                className="px-4 py-2 text-sm border border-slate-300 rounded-md hover:bg-slate-50">
          Cancel
        </button>
        <button
          onClick={() => create.mutate()}
          disabled={create.isPending || !patient || !requestedBy || !purpose}
          className="px-6 py-2 text-sm bg-rose-700 text-white rounded-md hover:bg-rose-800 disabled:bg-slate-300"
        >
          {create.isPending ? "Submitting…" : "Create Requisition"}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      {children}
    </div>
  );
}

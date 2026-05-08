"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation } from "@tanstack/react-query";
import { admissionsApi, bedsApi } from "@/lib/api/ipd";
import { api } from "@/lib/api";
import type { Bed, AdmissionType } from "@/types/ipd";

interface Patient {
  id: number; mrn: string; full_name: string; phone: string;
  age: number; gender: string;
}

interface Doctor {
  id: number;
  user_full_name: string;
  registration_number: string;
}

interface Department {
  id: number; name: string; code: string;
}

const TYPES: { v: AdmissionType; label: string; tone: string }[] = [
  { v: "PLANNED",   label: "Planned",   tone: "bg-sky-600" },
  { v: "EMERGENCY", label: "Emergency", tone: "bg-red-600" },
  { v: "REFERRAL",  label: "Referral",  tone: "bg-indigo-600" },
  { v: "MATERNITY", label: "Maternity", tone: "bg-pink-600" },
];

export default function NewAdmissionPage() {
  const router = useRouter();

  // Patient picker
  const [pq, setPq] = useState("");
  const [pqDeb, setPqDeb] = useState("");
  const [patient, setPatient] = useState<Patient | null>(null);
  useEffect(() => {
    const t = setTimeout(() => setPqDeb(pq), 300);
    return () => clearTimeout(t);
  }, [pq]);

  const patientResults = useQuery({
    queryKey: ["patient-search-ipd", pqDeb],
    queryFn: () =>
      api.get<{ results: Patient[] }>("/core/patients/", {
        params: { search: pqDeb, page_size: 8 },
      }).then(r => r.data.results),
    enabled: pqDeb.length >= 2 && !patient,
  });

  // Available beds (all wards)
  const beds = useQuery({
    queryKey: ["ipd-available-beds"],
    queryFn: bedsApi.available,
  });
  const [bedId, setBedId] = useState<number | null>(null);

  // Group beds by ward
  const bedsByWard = useMemo(() => {
    const map = new Map<string, Bed[]>();
    (beds.data?.results ?? []).forEach(b => {
      const k = `${b.ward_code} — ${b.ward_name}`;
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(b);
    });
    return Array.from(map.entries()).sort();
  }, [beds.data]);

  // Doctors
  const doctors = useQuery({
    queryKey: ["doctors-active"],
    queryFn: () =>
      api.get<{ results: Doctor[] }>("/specialist/doctors/", {
        params: { is_active: true, page_size: 100 },
      }).then(r => r.data.results),
  });
  const [doctorId, setDoctorId] = useState<number | "">("");

  // Departments
  const departments = useQuery({
    queryKey: ["departments-active"],
    queryFn: () =>
      api.get<{ results: Department[] }>("/department/departments/", {
        params: { is_active: true, page_size: 100 },
      }).then(r => r.data.results).catch(() => []),
  });
  const [deptId, setDeptId] = useState<number | "">("");

  // Other fields
  const [admissionType, setAdmissionType] = useState<AdmissionType>("PLANNED");
  const [diagnosis, setDiagnosis] = useState("");
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [notes, setNotes] = useState("");
  const [expDischarge, setExpDischarge] = useState("");

  const create = useMutation({
    mutationFn: () => {
      if (!patient || !bedId || !doctorId) throw new Error("Missing required fields");
      return admissionsApi.create({
        patient: patient.id,
        bed: bedId,
        attending_doctor: Number(doctorId),
        department: deptId ? Number(deptId) : undefined,
        admission_type: admissionType,
        admission_diagnosis: diagnosis,
        chief_complaint: chiefComplaint,
        admission_notes: notes,
        expected_discharge_date: expDischarge || undefined,
      });
    },
    onSuccess: (adm) => router.push(`/dashboard/ipd/admissions/${adm.id}`),
  });

  const selectedBed = beds.data?.results.find(b => b.id === bedId);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/dashboard/ipd" className="text-sm text-slate-500 hover:text-sky-700">
            ← IPD dashboard
          </Link>
          <h1 className="text-2xl font-semibold text-slate-900 mt-1">New Admission</h1>
        </div>
      </div>

      {/* Patient */}
      <div className="bg-white border border-slate-200 rounded-lg p-5">
        <h2 className="text-base font-semibold text-slate-800 mb-3">Patient</h2>
        {patient ? (
          <div className="flex items-center justify-between border border-slate-200 rounded-md p-3 bg-slate-50">
            <div>
              <div className="font-medium text-slate-800">{patient.full_name}</div>
              <div className="text-xs text-slate-500">
                {patient.mrn} · {patient.age}y {patient.gender} · {patient.phone}
              </div>
            </div>
            <button
              onClick={() => { setPatient(null); setPq(""); }}
              className="text-xs text-slate-500 hover:text-red-600"
            >
              Change
            </button>
          </div>
        ) : (
          <>
            <input
              type="text"
              value={pq}
              onChange={e => setPq(e.target.value)}
              placeholder="Search by name, MRN, or phone…"
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 outline-none"
            />
            {pqDeb.length >= 2 && (
              <div className="mt-2 max-h-48 overflow-y-auto border border-slate-200 rounded-md">
                {patientResults.isLoading ? (
                  <div className="p-3 text-sm text-slate-400">Searching…</div>
                ) : !patientResults.data?.length ? (
                  <div className="p-3 text-sm text-slate-400">No patients found.</div>
                ) : (
                  patientResults.data.map(p => (
                    <button
                      key={p.id}
                      onClick={() => setPatient(p)}
                      className="w-full text-left p-2 hover:bg-sky-50 border-b border-slate-100 last:border-b-0"
                    >
                      <div className="text-sm font-medium">{p.full_name}</div>
                      <div className="text-xs text-slate-500">
                        {p.mrn} · {p.age}y {p.gender}
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Bed */}
      <div className="bg-white border border-slate-200 rounded-lg p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-slate-800">Allocate Bed</h2>
          {selectedBed && (
            <div className="text-sm text-slate-600">
              Rate: <span className="font-mono font-medium">
                ₹{Number(selectedBed.bed_rent).toFixed(0)}/day
              </span> + ₹{Number(selectedBed.nursing_charge).toFixed(0)} nursing
              {Number(selectedBed.gst_rate) > 0 && (
                <span className="text-amber-700"> · {selectedBed.gst_rate}% GST</span>
              )}
            </div>
          )}
        </div>
        {beds.isLoading ? (
          <div className="text-sm text-slate-400">Loading beds…</div>
        ) : bedsByWard.length === 0 ? (
          <div className="text-sm text-amber-700">
            No available beds. Run <code>seed_phase2c_ipd</code> or check the bed board.
          </div>
        ) : (
          <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
            {bedsByWard.map(([wardLabel, wardBeds]) => (
              <div key={wardLabel}>
                <div className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-1">
                  {wardLabel}
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                  {wardBeds.map(b => (
                    <button
                      key={b.id}
                      onClick={() => setBedId(b.id)}
                      className={`px-2 py-1.5 rounded border text-xs font-mono transition ${
                        bedId === b.id
                          ? "bg-sky-600 border-sky-700 text-white"
                          : "bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100"
                      }`}
                    >
                      {b.display_code}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Clinical context */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
        <h2 className="text-base font-semibold text-slate-800">Clinical & Administrative</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Attending Doctor <span className="text-red-500">*</span>
            </label>
            <select
              value={doctorId}
              onChange={e => setDoctorId(e.target.value ? Number(e.target.value) : "")}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 outline-none"
            >
              <option value="">Select a doctor…</option>
              {doctors.data?.map(d => (
                <option key={d.id} value={d.id}>
                  Dr. {d.user_full_name} ({d.registration_number})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Department</label>
            <select
              value={deptId}
              onChange={e => setDeptId(e.target.value ? Number(e.target.value) : "")}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 outline-none"
            >
              <option value="">— optional —</option>
              {(departments.data ?? []).map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Admission Type</label>
          <div className="flex flex-wrap gap-2">
            {TYPES.map(t => (
              <button
                key={t.v}
                onClick={() => setAdmissionType(t.v)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
                  admissionType === t.v
                    ? `${t.tone} text-white`
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Admission Diagnosis <span className="text-red-500">*</span>
          </label>
          <textarea
            value={diagnosis}
            onChange={e => setDiagnosis(e.target.value)}
            rows={2}
            placeholder="Provisional diagnosis on admission"
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Chief Complaint</label>
          <input
            type="text"
            value={chiefComplaint}
            onChange={e => setChiefComplaint(e.target.value)}
            placeholder="e.g. Fever × 3 days, abdominal pain"
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 outline-none"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Expected Discharge Date
            </label>
            <input
              type="date"
              value={expDischarge}
              onChange={e => setExpDischarge(e.target.value)}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Admission Notes</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 outline-none"
          />
        </div>
      </div>

      {create.isError && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-700">
          {(create.error as { response?: { data?: { detail?: string } } })?.response?.data?.detail
            ?? (create.error as Error)?.message
            ?? "Could not create admission"}
        </div>
      )}

      <div className="flex justify-end gap-3">
        <Link
          href="/dashboard/ipd"
          className="px-4 py-2 border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50 text-sm"
        >
          Cancel
        </Link>
        <button
          onClick={() => create.mutate()}
          disabled={
            create.isPending || !patient || !bedId || !doctorId || !diagnosis.trim()
          }
          className="px-4 py-2 bg-sky-600 text-white rounded-md hover:bg-sky-700 disabled:opacity-50 text-sm font-medium"
        >
          {create.isPending ? "Admitting…" : "Admit Patient →"}
        </button>
      </div>
    </div>
  );
}

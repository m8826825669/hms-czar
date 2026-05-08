"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation } from "@tanstack/react-query";
import { labTestsApi, labOrdersApi } from "@/lib/api/lab";
import { api } from "@/lib/api";
import type { TestCatalog, TestCategory, LabOrderPriority } from "@/types/lab";

interface Patient {
  id: number;
  mrn: string;
  full_name: string;
  phone: string;
  age: number;
  gender: string;
}

interface Doctor {
  id: number;
  user_full_name: string;
  registration_number: string;
}

const CATEGORIES: { code: TestCategory | "ALL"; label: string }[] = [
  { code: "ALL", label: "All" },
  { code: "HEMATOLOGY", label: "Haematology" },
  { code: "BIOCHEMISTRY", label: "Biochemistry" },
  { code: "MICROBIOLOGY", label: "Microbiology" },
  { code: "SEROLOGY", label: "Serology" },
  { code: "URINALYSIS", label: "Urinalysis" },
  { code: "RADIOLOGY", label: "Radiology" },
  { code: "PATHOLOGY", label: "Pathology" },
  { code: "OTHER", label: "Other" },
];

export default function NewLabOrderPage() {
  const router = useRouter();

  // Patient picker
  const [patientQ, setPatientQ] = useState("");
  const [patientQDebounced, setPatientQDebounced] = useState("");
  const [patient, setPatient] = useState<Patient | null>(null);
  useEffect(() => {
    const id = setTimeout(() => setPatientQDebounced(patientQ), 300);
    return () => clearTimeout(id);
  }, [patientQ]);
  const patientResults = useQuery({
    queryKey: ["patient-search", patientQDebounced],
    queryFn: () =>
      api.get<{ results: Patient[] }>("/core/patients/", {
        params: { search: patientQDebounced, page_size: 8 },
      }).then(r => r.data.results),
    enabled: patientQDebounced.length >= 2 && !patient,
  });

  // Doctor (orderer)
  const doctorList = useQuery({
    queryKey: ["doctors-active"],
    queryFn: () =>
      api.get<{ results: Doctor[] }>("/specialist/doctors/", {
        params: { is_active: true, page_size: 100 },
      }).then(r => r.data.results),
  });
  const [doctorId, setDoctorId] = useState<number | "">("");

  // Test selection
  const [category, setCategory] = useState<TestCategory | "ALL">("ALL");
  const tests = useQuery({
    queryKey: ["lab-tests", category],
    queryFn: () =>
      category === "ALL"
        ? api.get<{ results: TestCatalog[] }>("/lab/tests/", {
            params: { is_active: true, page_size: 200 },
          }).then(r => r.data.results)
        : labTestsApi.byCategory(category),
  });
  const [selectedTests, setSelectedTests] = useState<Set<number>>(new Set());
  const [testSearch, setTestSearch] = useState("");

  // Other order fields
  const [priority, setPriority] = useState<LabOrderPriority>("ROUTINE");
  const [clinicalNotes, setClinicalNotes] = useState("");
  const [requiresFasting, setRequiresFasting] = useState(false);
  const [fastingHours, setFastingHours] = useState(0);

  const filteredTests = (tests.data ?? []).filter(t =>
    !testSearch || t.name.toLowerCase().includes(testSearch.toLowerCase()) ||
    t.code.toLowerCase().includes(testSearch.toLowerCase())
  );

  const totalPrice = (tests.data ?? [])
    .filter(t => selectedTests.has(t.id))
    .reduce((sum, t) => sum + parseFloat(t.price), 0);

  const createOrder = useMutation({
    mutationFn: async () => {
      if (!patient) throw new Error("Select a patient");
      if (!doctorId) throw new Error("Select an ordering doctor");
      if (selectedTests.size === 0) throw new Error("Select at least one test");

      const order = await labOrdersApi.create({
        patient: patient.id,
        ordered_by: Number(doctorId),
        priority,
        clinical_notes: clinicalNotes,
        requires_fasting: requiresFasting,
        fasting_hours: fastingHours,
      });
      // Add tests
      let current = order;
      for (const testId of selectedTests) {
        current = await labOrdersApi.addTest(current.id, testId);
      }
      return current;
    },
    onSuccess: (order) => {
      router.push(`/dashboard/lab/orders/${order.id}`);
    },
  });

  const toggle = (id: number) => {
    const next = new Set(selectedTests);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedTests(next);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/dashboard/lab" className="text-sm text-slate-500 hover:text-sky-700">
            ← Lab dashboard
          </Link>
          <h1 className="text-2xl font-semibold text-slate-900 mt-1">New Lab Order</h1>
        </div>
      </div>

      {/* Patient + Doctor */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white border border-slate-200 rounded-lg p-5">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Patient</label>
          {patient ? (
            <div className="flex items-center justify-between border border-slate-200 rounded-md p-3 bg-slate-50">
              <div>
                <div className="font-medium text-slate-800">{patient.full_name}</div>
                <div className="text-xs text-slate-500">
                  {patient.mrn} · {patient.age}y {patient.gender} · {patient.phone}
                </div>
              </div>
              <button
                onClick={() => { setPatient(null); setPatientQ(""); }}
                className="text-xs text-slate-500 hover:text-red-600"
              >
                Change
              </button>
            </div>
          ) : (
            <>
              <input
                type="text"
                value={patientQ}
                onChange={e => setPatientQ(e.target.value)}
                placeholder="Search by name, MRN, or phone…"
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none"
              />
              {patientQDebounced.length >= 2 && (
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

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Ordering Doctor</label>
          <select
            value={doctorId}
            onChange={e => setDoctorId(e.target.value ? Number(e.target.value) : "")}
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 outline-none"
          >
            <option value="">Select a doctor…</option>
            {doctorList.data?.map(d => (
              <option key={d.id} value={d.id}>
                Dr. {d.user_full_name} ({d.registration_number})
              </option>
            ))}
          </select>

          <div className="mt-4">
            <label className="block text-sm font-medium text-slate-700 mb-1">Priority</label>
            <div className="flex gap-2">
              {(["ROUTINE", "URGENT", "STAT"] as LabOrderPriority[]).map(p => (
                <button
                  key={p}
                  onClick={() => setPriority(p)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium ${
                    priority === p
                      ? p === "STAT" ? "bg-red-600 text-white"
                        : p === "URGENT" ? "bg-orange-500 text-white"
                        : "bg-sky-600 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-1">Clinical Notes / Provisional Diagnosis</label>
          <textarea
            value={clinicalNotes}
            onChange={e => setClinicalNotes(e.target.value)}
            rows={2}
            placeholder="e.g. Suspected anaemia, follow-up after iron therapy"
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 outline-none"
          />
        </div>

        <div className="md:col-span-2 flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={requiresFasting}
              onChange={e => setRequiresFasting(e.target.checked)}
            />
            Patient requires fasting
          </label>
          {requiresFasting && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-slate-600">Hours:</span>
              <input
                type="number"
                value={fastingHours}
                onChange={e => setFastingHours(Number(e.target.value))}
                className="w-20 border border-slate-300 rounded-md px-2 py-1 text-sm"
                min={0}
                max={24}
              />
            </div>
          )}
        </div>
      </div>

      {/* Test selection */}
      <div className="bg-white border border-slate-200 rounded-lg p-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
          <h2 className="text-base font-semibold text-slate-800">
            Select Tests
            <span className="ml-2 text-sm font-normal text-slate-500">
              ({selectedTests.size} selected · ₹{totalPrice.toFixed(2)})
            </span>
          </h2>
          <input
            type="text"
            value={testSearch}
            onChange={e => setTestSearch(e.target.value)}
            placeholder="Search tests…"
            className="w-full md:w-64 border border-slate-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-sky-500 outline-none"
          />
        </div>

        <div className="flex flex-wrap gap-2 mb-3">
          {CATEGORIES.map(c => (
            <button
              key={c.code}
              onClick={() => setCategory(c.code)}
              className={`px-3 py-1 rounded-full text-xs font-medium ${
                category === c.code
                  ? "bg-sky-600 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-96 overflow-y-auto pr-1">
          {tests.isLoading && <div className="text-sm text-slate-400 p-3">Loading…</div>}
          {filteredTests.map(t => {
            const checked = selectedTests.has(t.id);
            return (
              <label
                key={t.id}
                className={`flex items-start gap-3 p-3 border rounded-md cursor-pointer transition ${
                  checked
                    ? "border-sky-300 bg-sky-50"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(t.id)}
                  className="mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium text-sm text-slate-800 truncate">{t.name}</div>
                    <div className="text-sm font-mono text-slate-700">₹{t.price}</div>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
                    <span className="font-mono">{t.code}</span>
                    <span>·</span>
                    <span>{t.sample_type_label}</span>
                    {t.requires_fasting && (
                      <span className="text-amber-700 font-medium">· fasting</span>
                    )}
                  </div>
                </div>
              </label>
            );
          })}
        </div>
      </div>

      {createOrder.isError && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-700">
          {(createOrder.error as Error)?.message ?? "Could not create order"}
        </div>
      )}

      <div className="flex justify-end gap-3">
        <Link
          href="/dashboard/lab"
          className="px-4 py-2 border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50 text-sm"
        >
          Cancel
        </Link>
        <button
          onClick={() => createOrder.mutate()}
          disabled={createOrder.isPending || !patient || !doctorId || selectedTests.size === 0}
          className="px-4 py-2 bg-sky-600 text-white rounded-md hover:bg-sky-700 disabled:opacity-50 text-sm font-medium"
        >
          {createOrder.isPending ? "Creating…" : `Create Draft Order (₹${totalPrice.toFixed(2)})`}
        </button>
      </div>
    </div>
  );
}

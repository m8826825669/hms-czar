"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { dispatchesApi } from "@/lib/api/phase3b";


export default function NewDispatchPage() {
  const router = useRouter();

  const [callType, setCallType] = useState("EMERGENCY");
  const [priority, setPriority] = useState<"CRITICAL" | "URGENT" | "ROUTINE">("URGENT");
  const [pickupAddress, setPickupAddress] = useState("");
  const [pickupLandmark, setPickupLandmark] = useState("");
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [patientNameTemp, setPatientNameTemp] = useState("");
  const [patientPhoneTemp, setPatientPhoneTemp] = useState("");
  const [ageEstimate, setAgeEstimate] = useState("");
  const [callerName, setCallerName] = useState("");
  const [callerPhone, setCallerPhone] = useState("");
  const [callerRelation, setCallerRelation] = useState("");
  const [isConscious, setIsConscious] = useState<boolean | null>(null);
  const [isBreathing, setIsBreathing] = useState<boolean | null>(null);
  const [notes, setNotes] = useState("");

  const create = useMutation({
    mutationFn: () => dispatchesApi.create({
      call_type: callType,
      priority,
      pickup_address: pickupAddress,
      pickup_landmark: pickupLandmark,
      patient_name_temp: patientNameTemp,
      patient_phone_temp: patientPhoneTemp,
      caller_name: callerName,
      caller_phone: callerPhone,
      caller_relation: callerRelation,
      chief_complaint: chiefComplaint,
      age_estimate: ageEstimate ? Number(ageEstimate) : null,
      is_conscious: isConscious,
      is_breathing: isBreathing,
      notes,
    }),
    onSuccess: (resp) =>
      router.push(`/dashboard/ambulance/dispatches/${resp.id}`),
  });

  return (
    <div className="p-6 max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">New Dispatch</h1>
        <p className="text-sm text-slate-500 mt-1">
          Emergency call intake — capture critical info, then assign an ambulance.
        </p>
      </div>

      {create.isError && (
        <div className="border border-rose-300 bg-rose-50 text-rose-800 rounded p-3 text-sm">
          {(create.error as any)?.response?.data?.detail ?? (create.error as Error).message}
        </div>
      )}

      <Field label="Priority *">
        <div className="flex gap-2">
          {(["CRITICAL", "URGENT", "ROUTINE"] as const).map((p) => (
            <button type="button" key={p} onClick={() => setPriority(p)}
                    className={`px-4 py-2 text-sm rounded-md border ${
                      priority === p
                        ? p === "CRITICAL"
                          ? "bg-rose-600 text-white border-rose-600"
                          : p === "URGENT"
                          ? "bg-amber-500 text-white border-amber-500"
                          : "bg-emerald-600 text-white border-emerald-600"
                        : "border-slate-300 text-slate-700 hover:bg-slate-50"
                    }`}>
              {p}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Call Type *">
        <select value={callType} onChange={(e) => setCallType(e.target.value)}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm">
          <option value="EMERGENCY">Emergency Pickup</option>
          <option value="INTER_HOSPITAL">Inter-hospital Transfer</option>
          <option value="DISCHARGE">Discharge Drop-off</option>
          <option value="MORTUARY">Mortuary Transport</option>
          <option value="OTHER">Other</option>
        </select>
      </Field>

      <Field label="Pickup Address *">
        <textarea value={pickupAddress} onChange={(e) => setPickupAddress(e.target.value)}
                  rows={2}
                  placeholder="Full pickup address"
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
      </Field>

      <Field label="Landmark / Nearby">
        <input value={pickupLandmark} onChange={(e) => setPickupLandmark(e.target.value)}
               placeholder="e.g. Near Big Bazaar, Sector 22"
               className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
      </Field>

      <Field label="Chief Complaint">
        <input value={chiefComplaint} onChange={(e) => setChiefComplaint(e.target.value)}
               placeholder="e.g. Chest pain, road traffic accident, severe bleeding"
               className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
      </Field>

      <div className="grid grid-cols-3 gap-4">
        <Field label="Patient Name">
          <input value={patientNameTemp} onChange={(e) => setPatientNameTemp(e.target.value)}
                 placeholder="If known"
                 className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
        </Field>
        <Field label="Patient Phone">
          <input value={patientPhoneTemp} onChange={(e) => setPatientPhoneTemp(e.target.value)}
                 className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
        </Field>
        <Field label="Age (estimate)">
          <input type="number" value={ageEstimate} onChange={(e) => setAgeEstimate(e.target.value)}
                 className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Conscious?">
          <div className="flex gap-2">
            {[["Yes", true], ["No", false], ["Unknown", null]].map(([l, v]: any) => (
              <button type="button" key={l} onClick={() => setIsConscious(v)}
                      className={`px-3 py-1 text-sm rounded border ${
                        isConscious === v
                          ? "bg-sky-700 text-white border-sky-700"
                          : "border-slate-300 hover:bg-slate-50"
                      }`}>
                {l}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Breathing?">
          <div className="flex gap-2">
            {[["Yes", true], ["No", false], ["Unknown", null]].map(([l, v]: any) => (
              <button type="button" key={l} onClick={() => setIsBreathing(v)}
                      className={`px-3 py-1 text-sm rounded border ${
                        isBreathing === v
                          ? "bg-sky-700 text-white border-sky-700"
                          : "border-slate-300 hover:bg-slate-50"
                      }`}>
                {l}
              </button>
            ))}
          </div>
        </Field>
      </div>

      <h2 className="text-lg font-medium pt-3 border-t border-slate-200">Caller Info</h2>

      <div className="grid grid-cols-3 gap-4">
        <Field label="Caller Name">
          <input value={callerName} onChange={(e) => setCallerName(e.target.value)}
                 className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
        </Field>
        <Field label="Caller Phone *">
          <input value={callerPhone} onChange={(e) => setCallerPhone(e.target.value)}
                 className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
        </Field>
        <Field label="Relation">
          <input value={callerRelation} onChange={(e) => setCallerRelation(e.target.value)}
                 placeholder="Family / bystander / police"
                 className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
        </Field>
      </div>

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
          disabled={create.isPending || !pickupAddress || !callerPhone}
          className="px-6 py-2 text-sm bg-rose-700 text-white rounded-md hover:bg-rose-800 disabled:bg-slate-300"
        >
          {create.isPending ? "Creating…" : "Create Dispatch"}
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

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { donorsApi } from "@/lib/api/blood_bank";


export default function NewDonorPage() {
  const router = useRouter();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [gender, setGender] = useState<"M" | "F" | "O">("M");
  const [dob, setDob] = useState("");
  const [bloodGroup, setBloodGroup] = useState("O_POS");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [aadhaarLast4, setAadhaarLast4] = useState("");
  const [weight, setWeight] = useState("");
  const [donorType, setDonorType] = useState("VOLUNTARY");
  const [notes, setNotes] = useState("");

  const create = useMutation({
    mutationFn: () => donorsApi.create({
      first_name: firstName, last_name: lastName,
      gender, dob, blood_group: bloodGroup, phone,
      email, address, aadhaar_last4: aadhaarLast4,
      weight_kg: weight, donor_type: donorType, notes,
    }),
    onSuccess: () => router.push("/dashboard/blood-bank/donors"),
  });

  return (
    <div className="p-6 max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Register Blood Donor</h1>
        <p className="text-sm text-slate-500 mt-1">
          Donor must be 18-65 years old and weigh at least 50 kg.
        </p>
      </div>

      {create.isError && (
        <div className="border border-rose-300 bg-rose-50 text-rose-800 rounded-md p-3 text-sm">
          {(create.error as any)?.response?.data?.detail
            ?? (create.error as Error).message}
        </div>
      )}

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="First Name *">
            <input value={firstName} onChange={(e) => setFirstName(e.target.value)}
                   className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
          </Field>
          <Field label="Last Name">
            <input value={lastName} onChange={(e) => setLastName(e.target.value)}
                   className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
          </Field>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Field label="Gender *">
            <select value={gender} onChange={(e) => setGender(e.target.value as any)}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm">
              <option value="M">Male</option>
              <option value="F">Female</option>
              <option value="O">Other</option>
            </select>
          </Field>
          <Field label="Date of Birth *">
            <input type="date" value={dob} onChange={(e) => setDob(e.target.value)}
                   className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
          </Field>
          <Field label="Blood Group *">
            <select value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value)}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm">
              <option value="A_POS">A+</option>
              <option value="A_NEG">A-</option>
              <option value="B_POS">B+</option>
              <option value="B_NEG">B-</option>
              <option value="AB_POS">AB+</option>
              <option value="AB_NEG">AB-</option>
              <option value="O_POS">O+</option>
              <option value="O_NEG">O-</option>
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Phone *">
            <input value={phone} onChange={(e) => setPhone(e.target.value)}
                   placeholder="98xxxxxxxx"
                   className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
          </Field>
          <Field label="Email">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                   className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
          </Field>
        </div>

        <Field label="Address">
          <textarea value={address} onChange={(e) => setAddress(e.target.value)}
                    rows={2}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
        </Field>

        <div className="grid grid-cols-3 gap-4">
          <Field label="Weight (kg)">
            <input type="number" step="0.01" value={weight}
                   onChange={(e) => setWeight(e.target.value)}
                   placeholder="≥ 50"
                   className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
          </Field>
          <Field label="Aadhaar Last 4">
            <input maxLength={4} value={aadhaarLast4}
                   onChange={(e) => setAadhaarLast4(e.target.value.replace(/\D/g, ""))}
                   className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
          </Field>
          <Field label="Donor Type">
            <select value={donorType} onChange={(e) => setDonorType(e.target.value)}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm">
              <option value="VOLUNTARY">Voluntary</option>
              <option value="REPLACEMENT">Replacement</option>
              <option value="AUTOLOGOUS">Autologous</option>
              <option value="DIRECTED">Directed</option>
            </select>
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
            disabled={create.isPending || !firstName || !dob || !phone}
            className="px-6 py-2 text-sm bg-rose-700 text-white rounded-md hover:bg-rose-800 disabled:bg-slate-300"
          >
            {create.isPending ? "Registering…" : "Register Donor"}
          </button>
        </div>
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

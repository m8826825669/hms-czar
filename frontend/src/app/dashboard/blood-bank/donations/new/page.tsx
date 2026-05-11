"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { donorsApi, donationsApi } from "@/lib/api/blood_bank";
import type { BloodDonor } from "@/types/blood_bank";


export default function NewDonationPage() {
  const router = useRouter();

  // Donor picker
  const [donorQuery, setDonorQuery] = useState("");
  const [donor, setDonor] = useState<BloodDonor | null>(null);
  const [results, setResults] = useState<BloodDonor[]>([]);

  useEffect(() => {
    if (!donorQuery || donorQuery.length < 2) { setResults([]); return; }
    const handle = setTimeout(async () => {
      try {
        const r = await donorsApi.list({ search: donorQuery });
        setResults(r.data.slice(0, 8));
      } catch { setResults([]); }
    }, 300);
    return () => clearTimeout(handle);
  }, [donorQuery]);

  // Vitals
  const [volumeMl, setVolumeMl] = useState("350");
  const [hb, setHb] = useState("");
  const [bpSys, setBpSys] = useState("");
  const [bpDia, setBpDia] = useState("");
  const [pulse, setPulse] = useState("");
  const [temp, setTemp] = useState("36.8");
  const [notes, setNotes] = useState("");

  // Screening
  const [showScreen, setShowScreen] = useState(false);
  const [donationId, setDonationId] = useState<number | null>(null);
  const [tests, setTests] = useState({
    test_hiv: "NEGATIVE", test_hbsag: "NEGATIVE", test_hcv: "NEGATIVE",
    test_syphilis: "NEGATIVE", test_malaria: "NEGATIVE",
  });
  const [components, setComponents] = useState<string[]>(["WHOLE"]);
  const [storageLocation, setStorageLocation] = useState("");

  const create = useMutation({
    mutationFn: () => donationsApi.create({
      donor: donor!.id,
      volume_collected_ml: Number(volumeMl),
      pre_hb_g_dl: hb || "0",
      pre_bp_systolic: Number(bpSys || "0"),
      pre_bp_diastolic: Number(bpDia || "0"),
      pre_pulse: Number(pulse || "0"),
      pre_temperature_c: temp || "0",
      notes,
    }),
    onSuccess: (resp) => {
      setDonationId(resp.data.id);
      setShowScreen(true);
    },
  });

  const screen = useMutation({
    mutationFn: () => donationsApi.screen(donationId!, {
      ...tests, components, storage_location: storageLocation,
    }),
    onSuccess: () => router.push("/dashboard/blood-bank"),
  });

  return (
    <div className="p-6 max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Record Donation</h1>
        <p className="text-sm text-slate-500 mt-1">
          Step 1: collect vitals → Step 2: enter screening results → bags created automatically.
        </p>
      </div>

      {!donationId && (
        <>
          {/* Donor picker */}
          <Field label="Donor *">
            {donor ? (
              <div className="border rounded-md p-3 bg-emerald-50 border-emerald-300">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{donor.full_name}</div>
                    <div className="text-xs text-slate-500">
                      {donor.donor_id} · {donor.blood_group_label} · {donor.phone}
                    </div>
                  </div>
                  <button onClick={() => setDonor(null)}
                          className="text-xs text-rose-600 hover:underline">
                    Change
                  </button>
                </div>
                {!donor.eligibility.can_donate && (
                  <div className="mt-2 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded p-2">
                    ⚠ Not eligible: {donor.eligibility.reason}
                  </div>
                )}
              </div>
            ) : (
              <div className="relative">
                <input
                  value={donorQuery}
                  onChange={(e) => setDonorQuery(e.target.value)}
                  placeholder="Search by donor ID, name, or phone…"
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                />
                {results.length > 0 && (
                  <ul className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-md shadow max-h-60 overflow-auto">
                    {results.map((d) => (
                      <li key={d.id}
                          onClick={() => { setDonor(d); setResults([]); setDonorQuery(""); }}
                          className="px-3 py-2 text-sm hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0">
                        <div className="font-medium">{d.full_name}</div>
                        <div className="text-xs text-slate-500">
                          {d.donor_id} · {d.blood_group_label} · {d.phone}
                          {!d.eligibility.can_donate && (
                            <span className="text-rose-600 ml-2">⚠ {d.eligibility.reason}</span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </Field>

          {/* Vitals */}
          {donor && donor.eligibility.can_donate && (
            <>
              <h2 className="text-lg font-medium pt-3">Pre-donation Vitals</h2>
              <div className="grid grid-cols-3 gap-4">
                <Field label="Volume (ml)">
                  <input type="number" value={volumeMl} onChange={(e) => setVolumeMl(e.target.value)}
                         className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
                </Field>
                <Field label="Hb (g/dL)">
                  <input type="number" step="0.1" value={hb} onChange={(e) => setHb(e.target.value)}
                         placeholder="≥ 12.5 (M) / 12.0 (F)"
                         className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
                </Field>
                <Field label="Pulse">
                  <input type="number" value={pulse} onChange={(e) => setPulse(e.target.value)}
                         className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
                </Field>
                <Field label="BP Systolic">
                  <input type="number" value={bpSys} onChange={(e) => setBpSys(e.target.value)}
                         className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
                </Field>
                <Field label="BP Diastolic">
                  <input type="number" value={bpDia} onChange={(e) => setBpDia(e.target.value)}
                         className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
                </Field>
                <Field label="Temperature (°C)">
                  <input type="number" step="0.1" value={temp} onChange={(e) => setTemp(e.target.value)}
                         className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
                </Field>
              </div>
              <Field label="Notes">
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                          rows={2}
                          className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
              </Field>

              {create.isError && (
                <div className="border border-rose-300 bg-rose-50 text-rose-800 rounded p-3 text-sm">
                  {(create.error as any)?.response?.data?.detail ?? (create.error as Error).message}
                </div>
              )}

              <div className="flex justify-end pt-4">
                <button onClick={() => create.mutate()}
                        disabled={create.isPending}
                        className="px-6 py-2 text-sm bg-rose-700 text-white rounded-md hover:bg-rose-800 disabled:bg-slate-300">
                  {create.isPending ? "Recording…" : "Record Donation → Proceed to Screening"}
                </button>
              </div>
            </>
          )}
        </>
      )}

      {/* Screening step */}
      {donationId && showScreen && (
        <>
          <h2 className="text-lg font-medium">
            Screening Tests (NACO/NBTC mandatory panel)
          </h2>
          <p className="text-sm text-slate-500">
            All tests must be NEGATIVE for bags to be created. Any POSITIVE → donation fails.
          </p>

          <div className="grid grid-cols-2 gap-4">
            {(["test_hiv", "test_hbsag", "test_hcv", "test_syphilis", "test_malaria"] as const)
              .map((k) => (
              <Field key={k} label={k.replace("test_", "").toUpperCase()}>
                <select
                  value={tests[k]}
                  onChange={(e) => setTests({ ...tests, [k]: e.target.value })}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                >
                  <option value="NEGATIVE">Negative (Pass)</option>
                  <option value="POSITIVE">Positive (Fail)</option>
                  <option value="PENDING">Pending</option>
                </select>
              </Field>
            ))}
          </div>

          <Field label="Components to create from this donation">
            <div className="flex gap-3 flex-wrap">
              {["WHOLE", "PRBC", "FFP", "PLATELETS", "CRYO"].map((c) => (
                <label key={c} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={components.includes(c)}
                    onChange={(e) => {
                      if (e.target.checked) setComponents([...components, c]);
                      else setComponents(components.filter((x) => x !== c));
                    }}
                  />
                  {c}
                </label>
              ))}
            </div>
          </Field>

          <Field label="Storage Location">
            <input value={storageLocation}
                   onChange={(e) => setStorageLocation(e.target.value)}
                   placeholder="e.g. Fridge A, Shelf 3"
                   className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
          </Field>

          {screen.isError && (
            <div className="border border-rose-300 bg-rose-50 text-rose-800 rounded p-3 text-sm">
              {(screen.error as any)?.response?.data?.detail ?? (screen.error as Error).message}
            </div>
          )}

          <div className="flex justify-end pt-4">
            <button onClick={() => screen.mutate()}
                    disabled={screen.isPending}
                    className="px-6 py-2 text-sm bg-rose-700 text-white rounded-md hover:bg-rose-800 disabled:bg-slate-300">
              {screen.isPending ? "Submitting…" : "Submit Screening"}
            </button>
          </div>
        </>
      )}
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

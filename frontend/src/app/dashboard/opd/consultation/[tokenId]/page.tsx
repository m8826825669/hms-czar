"use client";
import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft, CheckCircle, Pill, AlertTriangle, FileText, Plus, X,
  Stethoscope, Activity, Clock,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import {
  consultationsApi, prescriptionsApi, drugsApi, emrApi,
} from "@/lib/api/hms";
import type { QueueToken, Consultation, Drug } from "@/types/hms";

export default function ConsultationConsolePage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { tokenId } = useParams<{ tokenId: string }>();
  const tokenIdNum = Number(tokenId);

  // Step 1: Get the queue token
  const { data: token } = useQuery({
    queryKey: ["queue-token", tokenIdNum],
    queryFn: () =>
      api.get<QueueToken>(`/reception/queue/${tokenIdNum}/`).then((r) => r.data),
    enabled: !!tokenIdNum,
  });

  // Step 2: Auto-start consultation when token loaded (if not already)
  const startMut = useMutation({
    mutationFn: () => consultationsApi.startFromToken(tokenIdNum),
    onSuccess: (cons) => {
      qc.setQueryData(["consultation-by-token", tokenIdNum], cons);
      qc.invalidateQueries({ queryKey: ["queue", "today"] });
    },
  });

  const { data: consultation } = useQuery({
    queryKey: ["consultation-by-token", tokenIdNum],
    queryFn: () => consultationsApi.startFromToken(tokenIdNum),
    enabled: !!token,
  });

  // EMR 360° (sidebar)
  const { data: emr } = useQuery({
    queryKey: ["emr-360", token?.patient],
    queryFn: () => (token ? emrApi.patient360(token.patient) : null),
    enabled: !!token?.patient,
  });

  if (!token) return <p className="p-8 text-center">Loading…</p>;
  if (!consultation) return <p className="p-8 text-center">Starting consultation…</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/opd"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1">
          <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Stethoscope className="h-5 w-5" />
            Consultation: {consultation.code}
          </h2>
          <p className="text-sm text-muted-foreground">
            Token {token.token_no} · {token.patient_name} ({token.patient_mrn})
          </p>
        </div>
        <Badge variant="warning" className="font-mono">{token.token_no}</Badge>
      </div>

      {/* 3-pane layout */}
      <div className="grid gap-4 lg:grid-cols-12">
        {/* LEFT: Patient context (EMR snapshot) */}
        <div className="lg:col-span-3 space-y-4">
          <PatientContextPanel emr={emr} />
        </div>

        {/* CENTER: SOAP notes + diagnosis */}
        <div className="lg:col-span-5 space-y-4">
          <ConsultationNotesPanel consultation={consultation} />
          <DiagnosisPanel consultation={consultation} />
        </div>

        {/* RIGHT: Prescription builder */}
        <div className="lg:col-span-4 space-y-4">
          <PrescriptionPanel consultation={consultation} />
          <CompletePanel consultation={consultation} onComplete={() => router.push("/dashboard/opd")} />
        </div>
      </div>
    </div>
  );
}

// ─── Left pane: patient context ──────────────────────────────
function PatientContextPanel({ emr }: { emr: ReturnType<typeof Object> | null | undefined }) {
  if (!emr) return <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Loading EMR…</p></CardContent></Card>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const e = emr as any;
  const p = e.patient;
  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Patient</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="font-medium">{p.full_name}</div>
          <div className="text-xs text-muted-foreground font-mono">{p.mrn}</div>
          <div className="text-xs">{p.age}{p.gender} · {p.blood_group}</div>
          {p.phone && <div className="text-xs">{p.phone}</div>}
        </CardContent>
      </Card>

      {p.allergies?.length > 0 && (
        <Card className="border-destructive">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-1 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4" /> Allergies
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {p.allergies.map((a: { substance: string; severity: string }, i: number) => (
              <Badge key={i} variant="destructive" className="mr-1">
                {a.substance}{a.severity && a.severity !== "unknown" ? ` (${a.severity})` : ""}
              </Badge>
            ))}
          </CardContent>
        </Card>
      )}

      {p.chronic_conditions?.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Chronic Conditions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {p.chronic_conditions.map((c: string, i: number) => (
              <Badge key={i} variant="warning" className="mr-1">{c}</Badge>
            ))}
          </CardContent>
        </Card>
      )}

      {e.recent_vitals?.[0] && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-1 text-sm">
              <Activity className="h-4 w-4" /> Latest Vitals
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-xs">
            {(() => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const v = e.recent_vitals[0] as any;
              return (
                <>
                  {v.bp_text && <div>BP: <span className="font-mono">{v.bp_text}</span> mmHg</div>}
                  {v.pulse_bpm && <div>Pulse: <span className="font-mono">{v.pulse_bpm}</span> bpm</div>}
                  {v.spo2_percent && <div>SpO₂: <span className="font-mono">{v.spo2_percent}%</span></div>}
                  {v.temperature_c && <div>Temp: <span className="font-mono">{v.temperature_c}°C</span></div>}
                  {v.weight_kg && <div>Weight: <span className="font-mono">{v.weight_kg}</span> kg</div>}
                  {v.bmi && <div>BMI: <span className="font-mono">{v.bmi}</span></div>}
                </>
              );
            })()}
            <div className="pt-1 text-muted-foreground">
              <Clock className="inline h-3 w-3" /> {new Date(e.recent_vitals[0].recorded_at).toLocaleTimeString()}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">History</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-xs">
          <div>Total visits: <strong>{e.summary.total_visits}</strong></div>
          <div>Prescriptions: <strong>{e.summary.total_prescriptions}</strong></div>
          {e.recent_visits?.slice(0, 3).map((v: { id: number; code: string; consultation_date: string; doctor_name: string }) => (
            <div key={v.id} className="border-l-2 border-muted pl-2 mt-1">
              <div className="font-mono">{v.code}</div>
              <div className="text-muted-foreground">{v.consultation_date} · {v.doctor_name}</div>
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  );
}

// ─── Center pane: notes ──────────────────────────────────────
function ConsultationNotesPanel({ consultation }: { consultation: Consultation }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    chief_complaint: consultation.chief_complaint ?? "",
    history_of_present_illness: consultation.history_of_present_illness ?? "",
    examination_findings: consultation.examination_findings ?? "",
    investigations_advised: consultation.investigations_advised ?? "",
    general_advice: consultation.general_advice ?? "",
  });

  const saveMut = useMutation({
    mutationFn: () => consultationsApi.update(consultation.id, form),
    onSuccess: () => {
      toast.success("Notes saved", { duration: 1500 });
      qc.invalidateQueries({ queryKey: ["consultation-by-token"] });
    },
  });

  // Auto-save every 10s of inactivity
  useEffect(() => {
    const t = setTimeout(() => {
      const hasContent = Object.values(form).some((v) => v && v.length > 0);
      if (hasContent) saveMut.mutate();
    }, 10_000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            <FileText className="h-4 w-4" />Clinical Notes
          </span>
          <Button size="sm" variant="outline" onClick={() => saveMut.mutate()}
            disabled={saveMut.isPending}>
            {saveMut.isPending ? "Saving…" : "Save"}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <Label className="text-xs">Chief Complaint</Label>
          <Textarea rows={2} value={form.chief_complaint}
            onChange={(e) => setForm({ ...form, chief_complaint: e.target.value })}
            placeholder="Patient's main complaint, in their words..." />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">History of Present Illness</Label>
          <Textarea rows={3} value={form.history_of_present_illness}
            onChange={(e) => setForm({ ...form, history_of_present_illness: e.target.value })}
            placeholder="Onset, duration, severity, modifying factors..." />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Examination Findings</Label>
          <Textarea rows={3} value={form.examination_findings}
            onChange={(e) => setForm({ ...form, examination_findings: e.target.value })}
            placeholder="General appearance, vitals review, system exam..." />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Investigations Advised</Label>
          <Textarea rows={2} value={form.investigations_advised}
            onChange={(e) => setForm({ ...form, investigations_advised: e.target.value })}
            placeholder="CBC, FBS, LFT, X-ray chest..." />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">General Advice</Label>
          <Textarea rows={2} value={form.general_advice}
            onChange={(e) => setForm({ ...form, general_advice: e.target.value })}
            placeholder="Diet, lifestyle, return precautions..." />
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Center pane: diagnosis ──────────────────────────────────
function DiagnosisPanel({ consultation }: { consultation: Consultation }) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [icd, setIcd] = useState("");
  const [type, setType] = useState<"PROVISIONAL" | "CONFIRMED" | "DIFFERENTIAL" | "FINAL">("PROVISIONAL");

  const addMut = useMutation({
    mutationFn: () =>
      consultationsApi.addDiagnosis({
        consultation: consultation.id,
        diagnosis_text: text, icd10_code: icd, diagnosis_type: type,
        is_primary: consultation.diagnoses.length === 0,
      }),
    onSuccess: () => {
      setText(""); setIcd("");
      toast.success("Diagnosis added");
      qc.invalidateQueries({ queryKey: ["consultation-by-token"] });
    },
  });

  const removeMut = useMutation({
    mutationFn: (id: number) => consultationsApi.removeDiagnosis(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["consultation-by-token"] }),
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Diagnoses</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {consultation.diagnoses.length === 0 ? (
          <p className="text-sm text-muted-foreground">No diagnoses yet.</p>
        ) : (
          <div className="space-y-1">
            {consultation.diagnoses.map((d) => (
              <div key={d.id} className="flex items-center justify-between rounded border p-2 text-sm">
                <div>
                  {d.is_primary && <Badge variant="info" className="mr-2">Primary</Badge>}
                  <span>{d.diagnosis_text}</span>
                  {d.icd10_code && <span className="ml-2 font-mono text-xs text-muted-foreground">[{d.icd10_code}]</span>}
                  <Badge variant="outline" className="ml-2">{d.diagnosis_type}</Badge>
                </div>
                <Button size="sm" variant="ghost" onClick={() => removeMut.mutate(d.id)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <Input placeholder="Diagnosis (e.g. Essential hypertension)"
            value={text} onChange={(e) => setText(e.target.value)} />
          <Input className="w-24 font-mono" placeholder="ICD-10"
            value={icd} onChange={(e) => setIcd(e.target.value.toUpperCase())} />
          <Select value={type} onChange={(e) => setType(e.target.value as never)} className="w-32">
            <option value="PROVISIONAL">Provisional</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="DIFFERENTIAL">Differential</option>
            <option value="FINAL">Final</option>
          </Select>
          <Button size="sm" onClick={() => addMut.mutate()}
            disabled={!text || addMut.isPending}>
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Right pane: prescription ────────────────────────────────
function PrescriptionPanel({ consultation }: { consultation: Consultation }) {
  const qc = useQueryClient();
  // Get or create a prescription for this consultation
  const existingRx = consultation.prescriptions[0];

  const createRxMut = useMutation({
    mutationFn: () =>
      prescriptionsApi.create({
        consultation: consultation.id,
        patient: consultation.patient,
        doctor: consultation.doctor,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["consultation-by-token"] }),
  });

  if (!existingRx) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Pill className="h-4 w-4" />Prescription
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Button onClick={() => createRxMut.mutate()} disabled={createRxMut.isPending}
            className="w-full">
            <Plus className="mr-2 h-4 w-4" />Start Prescription
          </Button>
        </CardContent>
      </Card>
    );
  }

  return <PrescriptionBuilder rx={existingRx} />;
}

function PrescriptionBuilder({ rx }: { rx: import("@/types/hms").Prescription }) {
  const qc = useQueryClient();
  const [drugQuery, setDrugQuery] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [selectedDrug, setSelectedDrug] = useState<Drug | null>(null);
  const [dose, setDose] = useState("");
  const [freq, setFreq] = useState("BD");
  const [duration, setDuration] = useState("5");
  const [route, setRoute] = useState("ORAL");
  const [instr, setInstr] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(drugQuery), 250);
    return () => clearTimeout(t);
  }, [drugQuery]);

  const { data: drugs = [] } = useQuery({
    queryKey: ["drugs", debouncedQ],
    queryFn: () => drugsApi.search(debouncedQ),
    enabled: debouncedQ.length >= 2,
  });

  const addMut = useMutation({
    mutationFn: () =>
      prescriptionsApi.addItem(rx.id, {
        drug: selectedDrug?.id ?? null,
        drug_name: selectedDrug?.display_name ?? drugQuery,
        dose, frequency: freq,
        duration_days: Number(duration), route, instructions: instr,
      }),
    onSuccess: () => {
      toast.success("Drug added");
      setSelectedDrug(null); setDrugQuery(""); setDose(""); setInstr("");
      qc.invalidateQueries({ queryKey: ["consultation-by-token"] });
    },
  });

  const removeMut = useMutation({
    mutationFn: (id: number) => prescriptionsApi.removeItem(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["consultation-by-token"] }),
  });

  const handlePickDrug = (d: Drug) => {
    setSelectedDrug(d);
    setDrugQuery(d.display_name);
    if (d.common_dose) {
      // try to parse "1 tab BD" into dose + freq
      const parts = d.common_dose.split(" ");
      if (parts.length >= 2) {
        setDose(parts.slice(0, 2).join(" "));
        if (["OD", "BD", "TDS", "QID", "HS", "SOS", "STAT"].includes(parts[2] ?? "")) {
          setFreq(parts[2]);
        }
      }
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            <Pill className="h-4 w-4" />Prescription {rx.code}
          </span>
          <Badge variant="outline" className="font-normal">{rx.items.length} items</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Existing items */}
        {rx.items.length > 0 && (
          <div className="space-y-1">
            {rx.items.map((item) => (
              <div key={item.id} className="flex items-start justify-between rounded border bg-muted/30 p-2">
                <div className="text-sm">
                  <div className="font-medium">{item.drug_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {item.dose} · {item.frequency} · {item.duration_days}d · {item.route}
                  </div>
                  {item.instructions && (
                    <div className="text-xs italic text-muted-foreground">{item.instructions}</div>
                  )}
                </div>
                <Button size="sm" variant="ghost" onClick={() => removeMut.mutate(item.id)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Add new item */}
        <div className="space-y-2 border-t pt-3">
          <Label className="text-xs">Add Drug</Label>
          <div className="relative">
            <Input placeholder="Type drug name (Crocin, Pantoprazole...)"
              value={drugQuery}
              onChange={(e) => { setDrugQuery(e.target.value); setSelectedDrug(null); }} />
            {drugs.length > 0 && !selectedDrug && (
              <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-48 overflow-y-auto rounded border bg-popover shadow-md">
                {drugs.slice(0, 8).map((d) => (
                  <button key={d.id} type="button"
                    onClick={() => handlePickDrug(d)}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-muted">
                    <div className="font-medium">{d.display_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {d.strength} · {d.dosage_form}
                      {d.is_schedule_h && <Badge variant="warning" className="ml-2">Sch H</Badge>}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Dose (1 tab)" value={dose}
              onChange={(e) => setDose(e.target.value)} />
            <Select value={freq} onChange={(e) => setFreq(e.target.value)}>
              <option value="OD">OD (once daily)</option>
              <option value="BD">BD (twice)</option>
              <option value="TDS">TDS (thrice)</option>
              <option value="QID">QID (4×)</option>
              <option value="HS">HS (bedtime)</option>
              <option value="SOS">SOS (as needed)</option>
              <option value="STAT">STAT (now)</option>
            </Select>
            <Input type="number" placeholder="Days" value={duration}
              onChange={(e) => setDuration(e.target.value)} />
            <Select value={route} onChange={(e) => setRoute(e.target.value)}>
              <option value="ORAL">Oral</option>
              <option value="IV">IV</option>
              <option value="IM">IM</option>
              <option value="SC">SC</option>
              <option value="TOPICAL">Topical</option>
              <option value="INHALATION">Inhalation</option>
              <option value="OPHTHALMIC">Eye drops</option>
            </Select>
          </div>
          <Input placeholder="Instructions (after meals, with milk...)"
            value={instr} onChange={(e) => setInstr(e.target.value)} />
          <Button size="sm" className="w-full" onClick={() => addMut.mutate()}
            disabled={!drugQuery || !dose || addMut.isPending}>
            <Plus className="mr-1 h-3 w-3" />Add to Rx
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Right pane: complete ────────────────────────────────────
function CompletePanel({ consultation, onComplete }:
  { consultation: Consultation; onComplete: () => void }) {
  const completeMut = useMutation({
    mutationFn: () => consultationsApi.complete(consultation.id),
    onSuccess: () => {
      toast.success("Consultation completed");
      onComplete();
    },
  });

  return (
    <Card>
      <CardContent className="p-3">
        <Button className="w-full" variant="default"
          onClick={() => completeMut.mutate()} disabled={completeMut.isPending}>
          <CheckCircle className="mr-2 h-4 w-4" />
          {completeMut.isPending ? "Completing…" : "Complete & Send Patient"}
        </Button>
      </CardContent>
    </Card>
  );
}

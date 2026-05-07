"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Save, Activity } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { vitalsApi } from "@/lib/api/hms";
import type { QueueToken } from "@/types/hms";

export default function VitalsPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { tokenId } = useParams<{ tokenId: string }>();
  const tokenIdNum = Number(tokenId);

  const { data: token } = useQuery({
    queryKey: ["queue-token", tokenIdNum],
    queryFn: () =>
      api.get<QueueToken>(`/reception/queue/${tokenIdNum}/`).then((r) => r.data),
    enabled: !!tokenIdNum,
  });

  const [form, setForm] = useState({
    temperature_c: "",
    pulse_bpm: "",
    bp_systolic: "",
    bp_diastolic: "",
    spo2_percent: "",
    respiration_rate: "",
    weight_kg: "",
    height_cm: "",
    blood_glucose_mgdl: "",
    pain_score: "",
    notes: "",
  });

  // Auto-compute BMI display
  const computedBmi = (() => {
    const w = parseFloat(form.weight_kg);
    const h = parseFloat(form.height_cm);
    if (!w || !h) return "";
    const m = h / 100;
    return (w / (m * m)).toFixed(2);
  })();

  const createMut = useMutation({
    mutationFn: () => {
      const payload: Record<string, unknown> = {
        patient: token!.patient,
        queue_token: tokenIdNum,
      };
      Object.entries(form).forEach(([k, v]) => {
        if (v === "") return;
        const numFields = ["temperature_c", "pulse_bpm", "bp_systolic", "bp_diastolic",
                           "spo2_percent", "respiration_rate", "weight_kg", "height_cm",
                           "blood_glucose_mgdl", "pain_score"];
        payload[k] = numFields.includes(k) ? Number(v) : v;
      });
      return vitalsApi.create(payload);
    },
    onSuccess: () => {
      toast.success("Vitals saved");
      qc.invalidateQueries({ queryKey: ["queue", "today"] });
      qc.invalidateQueries({ queryKey: ["queue-token", tokenIdNum] });
      router.push("/dashboard/opd");
    },
    onError: (e: unknown) => {
      const err = e as { response?: { data?: unknown } };
      toast.error(JSON.stringify(err?.response?.data ?? "Save failed"));
    },
  });

  if (!token) {
    return (
      <div className="space-y-6">
        <p className="p-8 text-center">Loading token…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/opd"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Vitals Capture</h2>
          <p className="text-sm text-muted-foreground">Token {token.token_no}</p>
        </div>
      </div>

      {/* Patient banner */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-semibold">{token.patient_name}</span>
                <Badge variant="info" className="font-mono">{token.token_no}</Badge>
              </div>
              <div className="text-sm text-muted-foreground">
                {token.patient_mrn} · {token.patient_age}{token.patient_gender} · {token.doctor_name}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />Vital Signs
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Temperature (°C)</Label>
              <Input type="number" step="0.1" placeholder="98.6"
                value={form.temperature_c}
                onChange={(e) => setForm({ ...form, temperature_c: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Pulse (bpm)</Label>
              <Input type="number" placeholder="72"
                value={form.pulse_bpm}
                onChange={(e) => setForm({ ...form, pulse_bpm: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>SpO₂ (%)</Label>
              <Input type="number" placeholder="98"
                value={form.spo2_percent}
                onChange={(e) => setForm({ ...form, spo2_percent: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>BP Systolic (mmHg)</Label>
              <Input type="number" placeholder="120"
                value={form.bp_systolic}
                onChange={(e) => setForm({ ...form, bp_systolic: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>BP Diastolic (mmHg)</Label>
              <Input type="number" placeholder="80"
                value={form.bp_diastolic}
                onChange={(e) => setForm({ ...form, bp_diastolic: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Respiration Rate</Label>
              <Input type="number" placeholder="16"
                value={form.respiration_rate}
                onChange={(e) => setForm({ ...form, respiration_rate: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Weight (kg)</Label>
              <Input type="number" step="0.01" placeholder="70.5"
                value={form.weight_kg}
                onChange={(e) => setForm({ ...form, weight_kg: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Height (cm)</Label>
              <Input type="number" step="0.01" placeholder="170"
                value={form.height_cm}
                onChange={(e) => setForm({ ...form, height_cm: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>BMI (auto)</Label>
              <Input value={computedBmi} disabled className="font-mono" />
            </div>
            <div className="space-y-2">
              <Label>Blood Glucose (mg/dL)</Label>
              <Input type="number" placeholder="110"
                value={form.blood_glucose_mgdl}
                onChange={(e) => setForm({ ...form, blood_glucose_mgdl: e.target.value })} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Pain Score (0–10)</Label>
              <Input type="number" min="0" max="10" placeholder="0"
                value={form.pain_score}
                onChange={(e) => setForm({ ...form, pain_score: e.target.value })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea rows={2} value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Patient reports headache, no vomiting..." />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button variant="outline" asChild>
          <Link href="/dashboard/opd">Cancel</Link>
        </Button>
        <Button onClick={() => createMut.mutate()} disabled={createMut.isPending}>
          <Save className="mr-2 h-4 w-4" />
          {createMut.isPending ? "Saving…" : "Save & Send to Doctor"}
        </Button>
      </div>
    </div>
  );
}

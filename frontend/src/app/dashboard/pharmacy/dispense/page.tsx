"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft, Search, Pill, FileText, User, AlertTriangle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { prescriptionsApi, patientsApi } from "@/lib/api/hms";
import { pharmacyOrdersApi } from "@/lib/api/pharmacy";

export default function DispenseLandingPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"rx" | "walkin">("rx");

  // Tab 1: Prescription search
  const [rxQuery, setRxQuery] = useState("");
  const [rxDebounced, setRxDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setRxDebounced(rxQuery), 300);
    return () => clearTimeout(t);
  }, [rxQuery]);

  const { data: rxResults } = useQuery({
    queryKey: ["rx-search", rxDebounced],
    queryFn: () => prescriptionsApi.list({ search: rxDebounced }),
    enabled: rxDebounced.length >= 2,
  });

  const startFromRxMut = useMutation({
    mutationFn: (rxId: number) => pharmacyOrdersApi.startFromPrescription(rxId),
    onSuccess: (res) => {
      if (res.warnings.length > 0) {
        toast.warning(`Order created with ${res.warnings.length} warning(s)`, {
          description: res.warnings.map(w => `${w.drug_name}: ${w.reason}`).join("\n"),
          duration: 5000,
        });
      } else {
        toast.success(`Order ${res.order.code} ready for dispense`);
      }
      router.push(`/dashboard/pharmacy/dispense/${res.order.id}`);
    },
    onError: (e: unknown) => {
      const err = e as { response?: { data?: { detail?: string } } };
      toast.error(err?.response?.data?.detail ?? "Failed to start order");
    },
  });

  // Tab 2: Walk-in (patient picker only)
  const [patQuery, setPatQuery] = useState("");
  const [patDebounced, setPatDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setPatDebounced(patQuery), 300);
    return () => clearTimeout(t);
  }, [patQuery]);

  const { data: patResults } = useQuery({
    queryKey: ["pat-search-disp", patDebounced],
    queryFn: () => patientsApi.list({ search: patDebounced }),
    enabled: patDebounced.length >= 2,
  });

  const startWalkInMut = useMutation({
    mutationFn: (patientId: number) => pharmacyOrdersApi.create({ patient: patientId }),
    onSuccess: (order) => {
      toast.success(`Order ${order.code} created`);
      router.push(`/dashboard/pharmacy/dispense/${order.id}`);
    },
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/pharmacy"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Pill className="h-6 w-6" />Dispense Drugs
          </h2>
          <p className="text-sm text-muted-foreground">
            Start from a prescription or as a walk-in sale
          </p>
        </div>
      </div>

      <div className="flex gap-2 border-b">
        <button onClick={() => setTab("rx")}
          className={`border-b-2 px-4 py-2 text-sm font-medium ${
            tab === "rx" ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground"
          }`}>
          <FileText className="mr-2 inline h-4 w-4" />From Prescription
        </button>
        <button onClick={() => setTab("walkin")}
          className={`border-b-2 px-4 py-2 text-sm font-medium ${
            tab === "walkin" ? "border-primary text-primary"
                            : "border-transparent text-muted-foreground hover:text-foreground"
          }`}>
          <User className="mr-2 inline h-4 w-4" />Walk-in Sale
        </button>
      </div>

      {tab === "rx" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Search Prescription</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" autoFocus
                placeholder="Search by RX code, patient name, MRN, or phone..."
                value={rxQuery}
                onChange={(e) => setRxQuery(e.target.value)} />
            </div>

            {rxResults?.results && rxResults.results.length > 0 && (
              <div className="divide-y rounded border">
                {rxResults.results.slice(0, 10).map((rx) => (
                  <button key={rx.id} type="button"
                    onClick={() => startFromRxMut.mutate(rx.id)}
                    disabled={startFromRxMut.isPending}
                    className="block w-full px-3 py-3 text-left hover:bg-muted disabled:opacity-50">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">
                          <span className="font-mono text-xs">{rx.code}</span>
                          {" — "}{rx.patient_name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {rx.patient_mrn} · {rx.doctor_name} ·
                          {" "}{new Date(rx.prescribed_at).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{rx.items.length} items</Badge>
                        {!rx.is_signed && (
                          <Badge variant="warning" className="gap-1">
                            <AlertTriangle className="h-3 w-3" />Unsigned
                          </Badge>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {rxDebounced && rxResults?.results.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No prescriptions found.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "walkin" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Walk-in Patient</CardTitle>
            <p className="text-xs text-muted-foreground">
              For OTC sales. Add drugs manually after selecting patient.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" autoFocus
                placeholder="Search by MRN, name, or phone..."
                value={patQuery}
                onChange={(e) => setPatQuery(e.target.value)} />
            </div>

            {patResults?.results && patResults.results.length > 0 && (
              <div className="divide-y rounded border">
                {patResults.results.slice(0, 10).map((p) => (
                  <button key={p.id} type="button"
                    onClick={() => startWalkInMut.mutate(p.id)}
                    disabled={startWalkInMut.isPending}
                    className="block w-full px-3 py-3 text-left hover:bg-muted disabled:opacity-50">
                    <div className="font-medium">{p.full_name}</div>
                    <div className="text-xs text-muted-foreground">
                      <span className="font-mono">{p.mrn}</span> · {p.age}{p.gender} · {p.phone}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

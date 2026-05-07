"use client";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { patientsApi, specialistApi, appointmentsApi } from "@/lib/api/hms";
import type { Patient } from "@/types/hms";

export default function NewAppointmentPage() {
  const router = useRouter();
  const params = useSearchParams();
  const initialPatientId = params.get("patient");

  const [patientId, setPatientId] = useState<number | null>(
    initialPatientId ? Number(initialPatientId) : null
  );
  const [patientQuery, setPatientQuery] = useState("");
  const [debouncedPQ, setDebouncedPQ] = useState("");
  const [doctorId, setDoctorId] = useState<number | null>(null);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState("10:00");
  const [visitType, setVisitType] = useState<"NEW" | "FOLLOWUP" | "EMERGENCY" | "TELE">("NEW");
  const [reason, setReason] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedPQ(patientQuery), 300);
    return () => clearTimeout(t);
  }, [patientQuery]);

  const { data: patientsData } = useQuery({
    queryKey: ["patients-search", debouncedPQ],
    queryFn: () => patientsApi.list({ search: debouncedPQ }),
    enabled: !!debouncedPQ && patientId === null,
  });

  const { data: selectedPatient } = useQuery({
    queryKey: ["patient", patientId],
    queryFn: () => (patientId ? patientsApi.get(patientId) : Promise.resolve(null)),
    enabled: !!patientId,
  });

  const { data: doctorsData } = useQuery({
    queryKey: ["doctors"],
    queryFn: () => specialistApi.listDoctors({ is_consulting: true }),
  });

  const { data: feeData } = useQuery({
    queryKey: ["doctor-fee", doctorId, visitType],
    queryFn: () => (doctorId ? specialistApi.doctorFee(doctorId, visitType) : null),
    enabled: !!doctorId,
  });

  const { data: availability } = useQuery<{ available: boolean; slots: Array<{ start: string; end: string; is_taken: boolean }> }>({
    queryKey: ["availability", doctorId, date],
    queryFn: () => (doctorId ? specialistApi.doctorAvailability(doctorId, date) : null),
    enabled: !!doctorId && !!date,
  });

  const createMut = useMutation({
    mutationFn: () =>
      appointmentsApi.create({
        patient: patientId!, doctor: doctorId!,
        scheduled_date: date, scheduled_time: time,
        visit_type: visitType, source: "WALK_IN", reason,
      } as never),
    onSuccess: (a) => {
      toast.success(`Appointment booked: ${a.code}`);
      router.push(`/dashboard/reception/appointments`);
    },
    onError: (e: unknown) => {
      const err = e as { response?: { data?: unknown } };
      toast.error(JSON.stringify(err?.response?.data ?? "Failed"));
    },
  });

  const canSubmit = patientId && doctorId && date && time;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/reception/appointments"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <h2 className="text-2xl font-bold tracking-tight">Book Appointment</h2>
      </div>

      {/* Patient */}
      <Card>
        <CardHeader><CardTitle>Patient</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {selectedPatient ? (
            <div className="flex items-center justify-between rounded border bg-muted/40 p-3">
              <div>
                <div className="font-medium">{selectedPatient.full_name}</div>
                <div className="text-sm text-muted-foreground">
                  {selectedPatient.mrn} · {selectedPatient.age}{selectedPatient.gender} ·{" "}
                  {selectedPatient.phone}
                </div>
              </div>
              <Button variant="ghost" size="sm"
                onClick={() => { setPatientId(null); setPatientQuery(""); }}>
                Change
              </Button>
            </div>
          ) : (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  autoFocus
                  className="pl-9"
                  placeholder="Search by MRN, name, phone…"
                  value={patientQuery}
                  onChange={(e) => setPatientQuery(e.target.value)}
                />
              </div>
              {patientsData && patientsData.results.length > 0 && (
                <div className="divide-y rounded border">
                  {patientsData.results.slice(0, 8).map((p: Patient) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => { setPatientId(p.id); setPatientQuery(""); }}
                      className="flex w-full justify-between p-3 text-left text-sm hover:bg-muted"
                    >
                      <span>
                        <span className="font-medium">{p.full_name}</span>{" "}
                        <span className="text-muted-foreground">
                          ({p.mrn} · {p.phone})
                        </span>
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {p.age}{p.gender}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {patientQuery && patientsData?.count === 0 && (
                <div className="rounded border bg-muted/40 p-3 text-sm">
                  No match.{" "}
                  <Link href="/dashboard/reception/register" className="text-primary underline">
                    Register new patient
                  </Link>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Doctor + Date + Time */}
      <Card>
        <CardHeader><CardTitle>Schedule</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Doctor *</Label>
            <Select
              value={doctorId ?? ""}
              onChange={(e) => setDoctorId(Number(e.target.value))}
            >
              <option value="">— Select —</option>
              {(doctorsData?.results ?? []).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.full_name} ({d.specialty_names.join(", ")})
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Visit Type</Label>
            <Select value={visitType} onChange={(e) => setVisitType(e.target.value as never)}>
              <option value="NEW">New Patient</option>
              <option value="FOLLOWUP">Follow-up</option>
              <option value="EMERGENCY">Emergency</option>
              <option value="TELE">Tele-consultation</option>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Date *</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Time *</Label>
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            {availability && !availability.available && (
              <p className="text-xs text-amber-600">
                Doctor unavailable on this date.
              </p>
            )}
          </div>
          {feeData && (
            <div className="md:col-span-2 rounded bg-muted/40 p-3 text-sm">
              <span className="text-muted-foreground">Consultation fee: </span>
              <span className="font-bold">
                {feeData.fee != null ? `₹${feeData.fee}` : "Not set"}
              </span>
            </div>
          )}
          <div className="space-y-2 md:col-span-2">
            <Label>Reason / Symptoms</Label>
            <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)}
              placeholder="Chief complaint, brief description…" />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button variant="outline" asChild>
          <Link href="/dashboard/reception/appointments">Cancel</Link>
        </Button>
        <Button disabled={!canSubmit || createMut.isPending}
          onClick={() => createMut.mutate()}>
          {createMut.isPending ? "Booking…" : "Book Appointment"}
        </Button>
      </div>
    </div>
  );
}

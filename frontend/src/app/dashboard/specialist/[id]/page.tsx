"use client";
import { useState, useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Stethoscope, GraduationCap, Languages, Briefcase, Phone, Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { specialistApi } from "@/lib/api/hms";

const DOWS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface Slot {
  id: number;
  day_of_week: number;
  day_of_week_label: string;
  start_time: string;
  end_time: string;
  slot_duration_minutes: number;
  max_patients: number;
  location: number;
  location_name: string;
  is_active: boolean;
}

interface Fee {
  id: number;
  visit_type: string;
  amount: string;
  follow_up_window_days: number;
  valid_from: string;
  valid_to: string | null;
}

export default function DoctorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const doctorId = Number(id);
  const [tab, setTab] = useState<"profile" | "slots" | "fees" | "availability">("profile");
  const [availDate, setAvailDate] = useState(new Date().toISOString().slice(0, 10));

  const { data: doctor, isLoading } = useQuery({
    queryKey: ["doctor", doctorId],
    queryFn: () => specialistApi.getDoctor(doctorId),
    enabled: !!doctorId,
  });

  const { data: slotsData } = useQuery({
    queryKey: ["doctor-slots", doctorId],
    queryFn: () =>
      api.get(`/specialist/slots/`, { params: { doctor: doctorId } }).then((r) => r.data),
    enabled: !!doctorId,
  });
  const slots: Slot[] = slotsData?.results ?? [];

  const { data: feesData } = useQuery({
    queryKey: ["doctor-fees", doctorId],
    queryFn: () =>
      api.get(`/specialist/fees/`, { params: { doctor: doctorId } }).then((r) => r.data),
    enabled: !!doctorId,
  });
  const fees: Fee[] = feesData?.results ?? [];

  const { data: availability } = useQuery({
    queryKey: ["doctor-availability", doctorId, availDate],
    queryFn: () => specialistApi.doctorAvailability(doctorId, availDate),
    enabled: tab === "availability" && !!doctorId,
  });

  const slotsByDay = useMemo(() => {
    const grouped: Record<number, Slot[]> = {};
    for (const s of slots) {
      (grouped[s.day_of_week] ??= []).push(s);
    }
    return grouped;
  }, [slots]);

  if (isLoading) return <p className="p-8 text-center">Loading…</p>;
  if (!doctor) return <p className="p-8 text-center">Doctor not found.</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/specialist"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{doctor.full_name}</h2>
          <p className="font-mono text-xs text-muted-foreground">{doctor.registration_number}</p>
        </div>
        <div className="ml-auto">
          {doctor.is_consulting ? (
            <Badge variant="success">Currently Consulting</Badge>
          ) : (
            <Badge variant="secondary">Not Consulting</Badge>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        {(["profile", "slots", "fees", "availability"] as const).map((t) => (
          <button key={t}
            onClick={() => setTab(t)}
            className={`border-b-2 px-4 py-2 text-sm font-medium capitalize transition-colors ${
              tab === t ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground"
            }`}>
            {t}
          </button>
        ))}
      </div>

      {tab === "profile" && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Specialties & Qualifications</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div className="mb-1 flex items-center gap-2 text-sm font-medium">
                  <Stethoscope className="h-4 w-4" /> Specialties
                </div>
                <div className="flex flex-wrap gap-1">
                  {doctor.specialty_names.length > 0 ? doctor.specialty_names.map((s) => (
                    <Badge key={s} variant="info">{s}</Badge>
                  )) : <span className="text-sm text-muted-foreground">—</span>}
                </div>
              </div>
              <div>
                <div className="mb-1 flex items-center gap-2 text-sm font-medium">
                  <GraduationCap className="h-4 w-4" /> Qualifications
                </div>
                <div className="flex flex-wrap gap-1">
                  {doctor.qualification_codes.length > 0 ? doctor.qualification_codes.map((q) => (
                    <Badge key={q} variant="outline">{q}</Badge>
                  )) : <span className="text-sm text-muted-foreground">—</span>}
                </div>
              </div>
              {doctor.languages?.length > 0 && (
                <div>
                  <div className="mb-1 flex items-center gap-2 text-sm font-medium">
                    <Languages className="h-4 w-4" /> Languages
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {doctor.languages.join(", ")}
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm">
                <Briefcase className="h-4 w-4" /> {doctor.years_of_experience} years experience
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Contact</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {doctor.email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4" />{doctor.email}
                </div>
              )}
              {doctor.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4" />{doctor.phone}
                </div>
              )}
              {doctor.department_name && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Department: </span>{doctor.department_name}
                </div>
              )}
              <div className="text-sm">
                <span className="text-muted-foreground">Username: </span>
                <code>{doctor.username}</code>
              </div>
            </CardContent>
          </Card>

          {doctor.bio && (
            <Card className="md:col-span-2">
              <CardHeader><CardTitle>Bio</CardTitle></CardHeader>
              <CardContent>
                <p className="whitespace-pre-line text-sm">{doctor.bio}</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {tab === "slots" && (
        <Card>
          <CardHeader>
            <CardTitle>Weekly OPD Schedule</CardTitle>
          </CardHeader>
          <CardContent>
            {slots.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No slots configured.</p>
            ) : (
              <div className="grid gap-2 md:grid-cols-7">
                {DOWS.map((label, dow) => {
                  const daySlots = slotsByDay[dow] ?? [];
                  return (
                    <div key={dow} className="rounded border bg-card p-3">
                      <div className="mb-2 text-center text-sm font-semibold">{label}</div>
                      {daySlots.length === 0 ? (
                        <p className="text-center text-xs text-muted-foreground">—</p>
                      ) : (
                        <div className="space-y-2">
                          {daySlots.map((s) => (
                            <div key={s.id} className="rounded bg-muted p-2 text-xs">
                              <div className="font-mono font-medium">
                                {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}
                              </div>
                              <div className="text-muted-foreground">{s.location_name}</div>
                              <div className="text-muted-foreground">
                                {s.slot_duration_minutes}min · max {s.max_patients}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "fees" && (
        <Card>
          <CardHeader><CardTitle>Consultation Fees</CardTitle></CardHeader>
          <CardContent>
            {fees.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No fees configured.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="pb-2">Visit Type</th>
                    <th className="pb-2">Amount</th>
                    <th className="pb-2">Follow-up window</th>
                    <th className="pb-2">Valid From</th>
                    <th className="pb-2">Valid To</th>
                  </tr>
                </thead>
                <tbody>
                  {fees.map((f) => (
                    <tr key={f.id} className="border-b last:border-0">
                      <td className="py-2">{f.visit_type}</td>
                      <td className="py-2 font-bold">₹{f.amount}</td>
                      <td className="py-2">{f.follow_up_window_days} days</td>
                      <td className="py-2">{f.valid_from}</td>
                      <td className="py-2">{f.valid_to ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "availability" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Availability</span>
              <Input type="date" className="w-[180px]"
                value={availDate} onChange={(e) => setAvailDate(e.target.value)} />
            </CardTitle>
          </CardHeader>
          <CardContent>
            {availability == null ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
            ) : !availability.available ? (
              <div className="rounded border bg-muted/40 p-4 text-sm">
                <Badge variant="warning">Unavailable</Badge>
                <span className="ml-2">
                  {availability.exception?.reason ?? "No slots scheduled for this day."}
                </span>
              </div>
            ) : availability.slots.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No slots.</p>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                {availability.slots.map((s: { start: string; end: string; is_taken: boolean }, i: number) => (
                  <div key={i}
                    className={`rounded border p-2 text-center text-xs ${
                      s.is_taken
                        ? "bg-muted text-muted-foreground line-through"
                        : "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                    }`}>
                    <div className="font-mono font-bold">{s.start}</div>
                    <div className="text-[10px]">
                      {s.is_taken ? "booked" : "open"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

"use client";
import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft, AlertTriangle, Activity, Pill, Calendar, FileText,
  Phone, Mail, MapPin,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { emrApi } from "@/lib/api/hms";

export default function Patient360Page() {
  const { patientId } = useParams<{ patientId: string }>();
  const id = Number(patientId);
  const [tab, setTab] = useState<"overview" | "visits" | "vitals" | "rx" | "appts">("overview");

  const { data: emr, isLoading } = useQuery({
    queryKey: ["emr-360", id],
    queryFn: () => emrApi.patient360(id),
    enabled: !!id,
  });

  if (isLoading) return <p className="p-8 text-center">Loading 360° record…</p>;
  if (!emr) return <p className="p-8 text-center">Patient not found.</p>;

  const p = emr.patient;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/emr"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{p.full_name}</h2>
          <p className="font-mono text-xs text-muted-foreground">{p.mrn}</p>
        </div>
        <div className="ml-auto flex gap-1">
          {p.is_vip && <Badge variant="warning">VIP</Badge>}
          {p.is_deceased && <Badge variant="destructive">Deceased</Badge>}
        </div>
      </div>

      {/* Hero card */}
      <Card>
        <CardContent className="grid gap-4 p-4 md:grid-cols-4">
          <div>
            <div className="text-xs text-muted-foreground">Age / Gender</div>
            <div className="font-medium">{p.age}{p.gender} · {p.blood_group}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Phone</div>
            <div className="flex items-center gap-1 font-medium">
              <Phone className="h-3 w-3" />{p.phone}
            </div>
          </div>
          {p.email && (
            <div>
              <div className="text-xs text-muted-foreground">Email</div>
              <div className="flex items-center gap-1 text-sm">
                <Mail className="h-3 w-3" />{p.email}
              </div>
            </div>
          )}
          {p.city && (
            <div>
              <div className="text-xs text-muted-foreground">Location</div>
              <div className="flex items-center gap-1 text-sm">
                <MapPin className="h-3 w-3" />{p.city}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Critical banners */}
      {(p.allergies?.length ?? 0) > 0 && (
        <Card className="border-destructive bg-destructive/5">
          <CardContent className="flex items-start gap-3 p-3">
            <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0" />
            <div>
              <div className="text-sm font-semibold text-destructive">Allergies</div>
              <div className="mt-1 flex flex-wrap gap-1">
                {p.allergies.map((a, i) => (
                  <Badge key={i} variant="destructive">
                    {a.substance}{a.severity && a.severity !== "unknown" ? ` (${a.severity})` : ""}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary stats */}
      <div className="grid gap-4 md:grid-cols-5">
        <StatCard label="Total Visits" value={emr.summary.total_visits} icon={FileText} />
        <StatCard label="Prescriptions" value={emr.summary.total_prescriptions} icon={Pill} />
        <StatCard label="Allergies" value={emr.summary.active_allergies_count} icon={AlertTriangle} />
        <StatCard label="Chronic" value={emr.summary.chronic_conditions_count} icon={Activity} />
        <StatCard label="Upcoming" value={emr.summary.upcoming_appointments_count} icon={Calendar} />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        {([
          ["overview", "Overview"], ["visits", "Visits"], ["vitals", "Vitals"],
          ["rx", "Prescriptions"], ["appts", "Appointments"],
        ] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === k ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground"
            }`}>
            {label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-base">Chronic Conditions</CardTitle></CardHeader>
            <CardContent>
              {p.chronic_conditions?.length === 0 ? (
                <p className="text-sm text-muted-foreground">None recorded.</p>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {p.chronic_conditions.map((c, i) => (
                    <Badge key={i} variant="warning">{c}</Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {emr.latest_prescription && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Latest Prescription ({emr.latest_prescription.code})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {emr.latest_prescription.items.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No items.</p>
                ) : emr.latest_prescription.items.map((item) => (
                  <div key={item.id} className="text-sm">
                    <span className="font-medium">{item.drug_name}</span>{" "}
                    <span className="text-muted-foreground">
                      — {item.dose} {item.frequency} × {item.duration_days}d
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {tab === "visits" && (
        <Card>
          <CardContent className="pt-6">
            {emr.recent_visits.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No consultations yet.</p>
            ) : (
              <div className="space-y-3">
                {emr.recent_visits.map((v) => (
                  <div key={v.id} className="rounded border p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-mono text-sm font-bold">{v.code}</span>
                        <Badge variant={
                          v.status === "COMPLETED" ? "success" :
                          v.status === "IN_PROGRESS" ? "warning" :
                          "secondary"
                        } className="ml-2">{v.status}</Badge>
                      </div>
                      <span className="text-sm text-muted-foreground">{v.consultation_date}</span>
                    </div>
                    <div className="mt-1 text-sm">{v.doctor_name}</div>
                    {v.chief_complaint && (
                      <div className="mt-2 text-sm">
                        <span className="text-muted-foreground">Chief complaint:</span> {v.chief_complaint}
                      </div>
                    )}
                    {v.diagnoses.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {v.diagnoses.map((d) => (
                          <Badge key={d.id} variant="info">
                            {d.diagnosis_text}
                            {d.icd10_code && ` (${d.icd10_code})`}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "vitals" && (
        <Card>
          <CardContent className="pt-6">
            {emr.recent_vitals.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No vitals recorded.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="pb-2">Date/Time</th>
                    <th className="pb-2">BP</th>
                    <th className="pb-2">Pulse</th>
                    <th className="pb-2">SpO₂</th>
                    <th className="pb-2">Temp</th>
                    <th className="pb-2">Wt</th>
                    <th className="pb-2">BMI</th>
                    <th className="pb-2">Glucose</th>
                  </tr>
                </thead>
                <tbody>
                  {emr.recent_vitals.map((v) => (
                    <tr key={v.id} className="border-b last:border-0">
                      <td className="py-2 text-xs">{new Date(v.recorded_at).toLocaleString()}</td>
                      <td className="py-2 font-mono">{v.bp_text || "—"}</td>
                      <td className="py-2 font-mono">{v.pulse_bpm ?? "—"}</td>
                      <td className="py-2 font-mono">{v.spo2_percent ?? "—"}</td>
                      <td className="py-2 font-mono">{v.temperature_c ?? "—"}</td>
                      <td className="py-2 font-mono">{v.weight_kg ?? "—"}</td>
                      <td className="py-2 font-mono">{v.bmi ?? "—"}</td>
                      <td className="py-2 font-mono">{v.blood_glucose_mgdl ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "rx" && (
        <Card>
          <CardContent className="pt-6">
            {emr.recent_visits.flatMap((v) => v.prescriptions).length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No prescriptions yet.</p>
            ) : (
              <div className="space-y-4">
                {emr.recent_visits.flatMap((v) => v.prescriptions).map((rx) => (
                  <div key={rx.id} className="rounded border p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sm font-bold">{rx.code}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(rx.prescribed_at).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">{rx.doctor_name}</div>
                    {rx.items.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {rx.items.map((item) => (
                          <div key={item.id} className="text-sm">
                            <span className="font-medium">{item.drug_name}</span>
                            <span className="text-muted-foreground">
                              {" "}— {item.dose} {item.frequency} × {item.duration_days}d ({item.route})
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "appts" && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-base">Upcoming</CardTitle></CardHeader>
            <CardContent>
              {emr.upcoming_appointments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No upcoming.</p>
              ) : emr.upcoming_appointments.map((a) => (
                <div key={a.id} className="border-b py-2 text-sm last:border-0">
                  <div className="font-mono text-xs">{a.code}</div>
                  <div>{a.scheduled_date} · {a.scheduled_time.slice(0, 5)}</div>
                  <div className="text-xs text-muted-foreground">{a.doctor_name}</div>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Past</CardTitle></CardHeader>
            <CardContent>
              {emr.past_appointments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No past visits.</p>
              ) : emr.past_appointments.map((a) => (
                <div key={a.id} className="border-b py-2 text-sm last:border-0">
                  <div className="font-mono text-xs">{a.code}</div>
                  <div>{a.scheduled_date}</div>
                  <div className="text-xs text-muted-foreground">{a.doctor_name} · {a.status}</div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
}

function StatCard({ label, value, icon: Icon }: StatCardProps) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <Icon className="h-5 w-5 text-muted-foreground" />
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-xl font-bold">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

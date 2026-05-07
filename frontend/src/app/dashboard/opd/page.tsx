"use client";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Stethoscope, Activity, Pill, FileText, Wifi, WifiOff } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { queueApi, specialistApi } from "@/lib/api/hms";
import { useQueueSocket, useCurrentHospitalId } from "@/hooks/useQueueSocket";

export default function OPDLandingPage() {
  const qc = useQueryClient();
  const hospitalId = useCurrentHospitalId();

  // Live queue subscription - invalidates query on any token event
  const { connected } = useQueueSocket({
    hospitalId,
    onEvent: () => qc.invalidateQueries({ queryKey: ["queue", "today"] }),
  });

  const { data: queue = [] } = useQuery({
    queryKey: ["queue", "today"],
    queryFn: () => queueApi.today(),
  });

  const { data: doctorsData } = useQuery({
    queryKey: ["doctors", "consulting"],
    queryFn: () => specialistApi.listDoctors({ is_consulting: true }),
  });

  const waiting = queue.filter((q) => q.status === "WAITING");
  const inVitals = queue.filter((q) => q.status === "IN_VITALS");
  const inConsult = queue.filter((q) => q.status === "IN_CONSULT");
  const done = queue.filter((q) => q.status === "DONE");
  const doctors = doctorsData?.results ?? [];

  // Group queue by doctor for the doctor cards
  const queueByDoctor = new Map<number, typeof queue>();
  queue.forEach((q) => {
    const list = queueByDoctor.get(q.doctor) ?? [];
    list.push(q);
    queueByDoctor.set(q.doctor, list);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">OPD Console</h2>
          <p className="text-muted-foreground">
            Live consultation queue · vitals desk · doctor's room
          </p>
        </div>
        <Badge variant={connected ? "success" : "secondary"} className="gap-1">
          {connected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
          {connected ? "Live" : "Offline"}
        </Badge>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Waiting</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{waiting.length}</div>
            <p className="text-xs text-muted-foreground">in queue</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Vitals Desk</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{inVitals.length}</div>
            <p className="text-xs text-muted-foreground">vitals being taken</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">In Consult</CardTitle>
            <Stethoscope className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{inConsult.length}</div>
            <p className="text-xs text-muted-foreground">currently with doctor</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{done.length}</div>
            <p className="text-xs text-muted-foreground">today</p>
          </CardContent>
        </Card>
      </div>

      {/* Vitals Desk - tokens waiting for vitals */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Vitals Desk ({waiting.length} waiting)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {waiting.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No tokens waiting for vitals.
            </p>
          ) : (
            <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
              {waiting.slice(0, 9).map((t) => (
                <Link key={t.id} href={`/dashboard/opd/vitals/${t.id}`}>
                  <Card className="cursor-pointer transition-shadow hover:shadow-md">
                    <CardContent className="space-y-1 p-3">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-base font-bold">{t.token_no}</span>
                        {t.priority === "EMERGENCY" && <Badge variant="destructive">EM</Badge>}
                        {t.priority === "URGENT" && <Badge variant="warning">U</Badge>}
                      </div>
                      <div className="text-sm">{t.patient_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {t.patient_mrn} · {t.patient_age}{t.patient_gender} · {t.doctor_name}
                      </div>
                      <Button size="sm" variant="outline" className="mt-2 w-full">
                        <Pill className="mr-1 h-3 w-3" />Take Vitals
                      </Button>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Doctor cards */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Stethoscope className="h-5 w-5" />Doctor's Rooms
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {doctors.map((d) => {
              const docQueue = queueByDoctor.get(d.id) ?? [];
              const docWait = docQueue.filter((q) => q.status === "WAITING" || q.status === "IN_VITALS").length;
              const docInConsult = docQueue.find((q) => q.status === "IN_CONSULT");
              const nextToken = docQueue.find((q) => q.status === "IN_VITALS" || q.status === "WAITING");

              return (
                <Card key={d.id}>
                  <CardContent className="space-y-2 p-4">
                    <div>
                      <div className="font-semibold">{d.full_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {d.specialty_names.join(", ")}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-muted-foreground">Waiting:</span>
                      <span className="font-bold">{docWait}</span>
                      {docInConsult && (
                        <Badge variant="warning" className="ml-auto font-mono">
                          {docInConsult.token_no}
                        </Badge>
                      )}
                    </div>
                    {nextToken ? (
                      <Link href={`/dashboard/opd/consultation/${nextToken.id}`}>
                        <Button size="sm" className="w-full">
                          Open Console — Next: {nextToken.token_no}
                        </Button>
                      </Link>
                    ) : (
                      <Button size="sm" variant="outline" className="w-full" disabled>
                        No patients
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

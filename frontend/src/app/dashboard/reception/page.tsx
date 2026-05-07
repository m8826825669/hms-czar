"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { UserPlus, Search, Calendar, Users, IdCard, ClipboardList } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { appointmentsApi, queueApi } from "@/lib/api/hms";

export default function ReceptionPage() {
  const { data: todaysAppts = [] } = useQuery({
    queryKey: ["appointments", "today"],
    queryFn: () => appointmentsApi.today(),
  });

  const { data: queue = [] } = useQuery({
    queryKey: ["queue", "today"],
    queryFn: () => queueApi.today(),
  });

  const waiting = queue.filter((q) => q.status === "WAITING").length;
  const inConsult = queue.filter((q) => q.status === "IN_CONSULT").length;
  const done = queue.filter((q) => q.status === "DONE").length;

  const quickActions = [
    { label: "New Patient Registration", href: "/dashboard/reception/register",
      icon: UserPlus, color: "text-emerald-600" },
    { label: "Search Patient", href: "/dashboard/reception/search",
      icon: Search, color: "text-sky-600" },
    { label: "Book Appointment", href: "/dashboard/reception/appointments/new",
      icon: Calendar, color: "text-violet-600" },
    { label: "Visitor Pass", href: "/dashboard/reception/visitor-pass",
      icon: IdCard, color: "text-amber-600" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Reception</h2>
          <p className="text-muted-foreground">
            Patient registration, appointments, queue, and visitor management
          </p>
        </div>
      </div>

      {/* Quick action tiles */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {quickActions.map((a) => {
          const Icon = a.icon;
          return (
            <Link href={a.href} key={a.href}>
              <Card className="cursor-pointer transition-shadow hover:shadow-md">
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="rounded-lg bg-muted p-2">
                    <Icon className={`h-5 w-5 ${a.color}`} />
                  </div>
                  <div className="font-medium">{a.label}</div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Today's stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Appointments Today</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todaysAppts.length}</div>
            <p className="text-xs text-muted-foreground">
              {todaysAppts.filter((a) => a.status === "BOOKED").length} pending check-in
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">In Queue</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{waiting}</div>
            <p className="text-xs text-muted-foreground">waiting</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">In Consultation</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{inConsult}</div>
            <p className="text-xs text-muted-foreground">currently with doctor</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{done}</div>
            <p className="text-xs text-muted-foreground">finished today</p>
          </CardContent>
        </Card>
      </div>

      {/* Today's appointments preview */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Today's Appointments</CardTitle>
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/reception/appointments">View all</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {todaysAppts.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No appointments scheduled today.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="pb-2">Code</th>
                    <th className="pb-2">Time</th>
                    <th className="pb-2">Patient</th>
                    <th className="pb-2">Doctor</th>
                    <th className="pb-2">Status</th>
                    <th className="pb-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {todaysAppts.slice(0, 8).map((a) => (
                    <tr key={a.id} className="border-b last:border-0">
                      <td className="py-2 font-mono text-xs">{a.code}</td>
                      <td className="py-2">{a.scheduled_time.slice(0, 5)}</td>
                      <td className="py-2">
                        <div>{a.patient_name}</div>
                        <div className="text-xs text-muted-foreground">{a.patient_mrn}</div>
                      </td>
                      <td className="py-2">{a.doctor_name}</td>
                      <td className="py-2">
                        <Badge variant={
                          a.status === "BOOKED" ? "outline"
                          : a.status === "CHECKED_IN" ? "info"
                          : a.status === "IN_CONSULT" ? "warning"
                          : a.status === "COMPLETED" ? "success"
                          : "secondary"
                        }>
                          {a.status_label}
                        </Badge>
                      </td>
                      <td className="py-2 text-right">
                        {a.status === "BOOKED" && (
                          <Button size="sm" variant="outline" asChild>
                            <Link href={`/dashboard/reception/appointments/${a.id}`}>
                              Check-in
                            </Link>
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

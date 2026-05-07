"use client";
import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Calendar, ArrowLeft, Plus, CheckCircle, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { appointmentsApi } from "@/lib/api/hms";

export default function AppointmentsPage() {
  const qc = useQueryClient();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [statusFilter, setStatusFilter] = useState("");

  const { data } = useQuery({
    queryKey: ["appointments", date, statusFilter],
    queryFn: () => appointmentsApi.list({
      scheduled_date: date,
      ...(statusFilter ? { status: statusFilter } : {}),
      ordering: "scheduled_time",
    }),
  });

  const checkInMut = useMutation({
    mutationFn: (id: number) => appointmentsApi.checkIn(id),
    onSuccess: (res: { queue_token?: { token_no: string } }) => {
      toast.success(`Checked-in. Token: ${res.queue_token?.token_no ?? "—"}`);
      qc.invalidateQueries({ queryKey: ["appointments"] });
      qc.invalidateQueries({ queryKey: ["queue"] });
    },
    onError: () => toast.error("Check-in failed"),
  });

  const cancelMut = useMutation({
    mutationFn: (id: number) => appointmentsApi.cancel(id, "Cancelled by reception"),
    onSuccess: () => {
      toast.success("Appointment cancelled");
      qc.invalidateQueries({ queryKey: ["appointments"] });
    },
  });

  const appts = data?.results ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard/reception"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Appointments</h2>
            <p className="text-sm text-muted-foreground">Manage scheduled visits</p>
          </div>
        </div>
        <Button asChild>
          <Link href="/dashboard/reception/appointments/new">
            <Plus className="mr-2 h-4 w-4" />Book New
          </Link>
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                className="w-[180px]" />
            </div>
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
              className="w-[180px]">
              <option value="">All statuses</option>
              <option value="BOOKED">Booked</option>
              <option value="CHECKED_IN">Checked-in</option>
              <option value="IN_CONSULT">In Consultation</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="NO_SHOW">No-show</option>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{appts.length} appointment(s)</CardTitle>
        </CardHeader>
        <CardContent>
          {appts.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No appointments.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="pb-2">Code</th>
                    <th className="pb-2">Time</th>
                    <th className="pb-2">Patient</th>
                    <th className="pb-2">Doctor</th>
                    <th className="pb-2">Type</th>
                    <th className="pb-2">Status</th>
                    <th className="pb-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {appts.map((a) => (
                    <tr key={a.id} className="border-b last:border-0">
                      <td className="py-2 font-mono text-xs">{a.code}</td>
                      <td className="py-2">{a.scheduled_time.slice(0, 5)}</td>
                      <td className="py-2">
                        <div>{a.patient_name}</div>
                        <div className="text-xs text-muted-foreground">{a.patient_mrn} · {a.patient_phone}</div>
                      </td>
                      <td className="py-2">{a.doctor_name}</td>
                      <td className="py-2">{a.visit_type}</td>
                      <td className="py-2">
                        <Badge variant={
                          a.status === "BOOKED" ? "outline"
                          : a.status === "CHECKED_IN" ? "info"
                          : a.status === "IN_CONSULT" ? "warning"
                          : a.status === "COMPLETED" ? "success"
                          : "secondary"
                        }>{a.status_label}</Badge>
                      </td>
                      <td className="py-2 text-right">
                        <div className="flex justify-end gap-1">
                          {a.status === "BOOKED" && (
                            <>
                              <Button size="sm" variant="outline"
                                onClick={() => checkInMut.mutate(a.id)}
                                disabled={checkInMut.isPending}>
                                <CheckCircle className="mr-1 h-3 w-3" />Check-in
                              </Button>
                              <Button size="sm" variant="ghost"
                                onClick={() => cancelMut.mutate(a.id)}>
                                <XCircle className="h-4 w-4 text-destructive" />
                              </Button>
                            </>
                          )}
                        </div>
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

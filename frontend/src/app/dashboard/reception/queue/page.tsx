"use client";
import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, ChevronRight, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { queueApi, specialistApi } from "@/lib/api/hms";

export default function QueuePage() {
  const qc = useQueryClient();
  const [doctorId, setDoctorId] = useState("");

  const { data: doctorsData } = useQuery({
    queryKey: ["doctors"],
    queryFn: () => specialistApi.listDoctors(),
  });

  const { data: queue = [] } = useQuery({
    queryKey: ["queue", "today", doctorId],
    queryFn: () => queueApi.today(doctorId ? { doctor: Number(doctorId) } : {}),
    refetchInterval: 10_000, // auto-refresh every 10s (Phase 1b: WebSocket)
  });

  const callNextMut = useMutation({
    mutationFn: (id: number) => queueApi.callNext(id),
    onSuccess: () => {
      toast.success("Token called");
      qc.invalidateQueries({ queryKey: ["queue"] });
    },
  });

  const completeMut = useMutation({
    mutationFn: (id: number) => queueApi.complete(id),
    onSuccess: () => {
      toast.success("Marked done");
      qc.invalidateQueries({ queryKey: ["queue"] });
    },
  });

  const grouped = {
    waiting: queue.filter((q) => q.status === "WAITING"),
    inConsult: queue.filter((q) => q.status === "IN_CONSULT" || q.status === "IN_VITALS"),
    done: queue.filter((q) => q.status === "DONE"),
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard/reception"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Today's Queue</h2>
            <p className="text-sm text-muted-foreground">Live OPD queue · auto-refreshes every 10s</p>
          </div>
        </div>
        <Select value={doctorId} onChange={(e) => setDoctorId(e.target.value)}
          className="w-[260px]">
          <option value="">All doctors</option>
          {(doctorsData?.results ?? []).map((d) => (
            <option key={d.id} value={d.id}>{d.full_name}</option>
          ))}
        </Select>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <QueueColumn
          title="Waiting"
          tokens={grouped.waiting}
          variant="info"
          actionLabel="Call"
          actionIcon={<ChevronRight className="h-3 w-3" />}
          onAction={(id) => callNextMut.mutate(id)}
        />
        <QueueColumn
          title="In Consultation"
          tokens={grouped.inConsult}
          variant="warning"
          actionLabel="Done"
          actionIcon={<Check className="h-3 w-3" />}
          onAction={(id) => completeMut.mutate(id)}
        />
        <QueueColumn
          title="Completed"
          tokens={grouped.done}
          variant="success"
        />
      </div>
    </div>
  );
}

interface QueueColumnProps {
  title: string;
  tokens: Array<{
    id: number; token_no: string; patient_name: string; patient_mrn: string;
    patient_age: number; patient_gender: string; doctor_name: string;
    priority: string; status_label: string; issued_at: string;
  }>;
  variant: "info" | "warning" | "success";
  actionLabel?: string;
  actionIcon?: React.ReactNode;
  onAction?: (id: number) => void;
}

function QueueColumn({ title, tokens, variant, actionLabel, actionIcon, onAction }: QueueColumnProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <span>{title}</span>
          <Badge variant={variant}>{tokens.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {tokens.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">No tokens.</p>
        ) : (
          <div className="space-y-2">
            {tokens.map((t) => (
              <div key={t.id} className="rounded border bg-card p-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-mono text-lg font-bold">{t.token_no}</div>
                    <div className="text-sm">{t.patient_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {t.patient_mrn} · {t.patient_age}{t.patient_gender} · {t.doctor_name}
                    </div>
                  </div>
                  {t.priority === "EMERGENCY" && <Badge variant="destructive">EM</Badge>}
                  {t.priority === "URGENT" && <Badge variant="warning">U</Badge>}
                </div>
                {actionLabel && onAction && (
                  <Button size="sm" variant="outline" className="mt-2 w-full"
                    onClick={() => onAction(t.id)}>
                    {actionIcon}<span className="ml-1">{actionLabel}</span>
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

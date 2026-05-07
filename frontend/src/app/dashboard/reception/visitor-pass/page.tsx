"use client";
import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, IdCard, LogIn, LogOut, Ban } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { visitorApi, patientsApi } from "@/lib/api/hms";

export default function VisitorPassPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    visitor_name: "",
    visitor_phone: "",
    purpose: "ATTENDANT" as const,
    visiting_patient: "",
    relationship: "",
    id_proof_type: "AADHAAR",
    id_proof_last4: "",
    valid_hours: "12",
  });
  const [patientQuery, setPatientQuery] = useState("");

  const { data: passes } = useQuery({
    queryKey: ["visitor-passes"],
    queryFn: () => visitorApi.list({ ordering: "-issued_at" }),
    refetchInterval: 30_000,
  });

  const { data: patientsData } = useQuery({
    queryKey: ["patients-pass-search", patientQuery],
    queryFn: () => patientsApi.list({ search: patientQuery }),
    enabled: !!patientQuery && patientQuery.length >= 2,
  });

  const createMut = useMutation({
    mutationFn: () => {
      const validUntil = new Date();
      validUntil.setHours(validUntil.getHours() + Number(form.valid_hours));
      return visitorApi.create({
        visitor_name: form.visitor_name,
        visitor_phone: form.visitor_phone,
        purpose: form.purpose,
        visiting_patient: form.visiting_patient ? Number(form.visiting_patient) : null,
        relationship: form.relationship,
        id_proof_type: form.id_proof_type,
        id_proof_last4: form.id_proof_last4,
        valid_until: validUntil.toISOString(),
      } as never);
    },
    onSuccess: (vp) => {
      toast.success(`Pass issued: ${vp.pass_no}`);
      qc.invalidateQueries({ queryKey: ["visitor-passes"] });
      setForm((f) => ({ ...f, visitor_name: "", visitor_phone: "",
                        relationship: "", id_proof_last4: "" }));
      setPatientQuery("");
    },
  });

  const entryMut = useMutation({
    mutationFn: (id: number) => visitorApi.markEntry(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["visitor-passes"] }),
  });
  const exitMut = useMutation({
    mutationFn: (id: number) => visitorApi.markExit(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["visitor-passes"] }),
  });
  const revokeMut = useMutation({
    mutationFn: (id: number) => visitorApi.revoke(id),
    onSuccess: () => {
      toast.success("Pass revoked");
      qc.invalidateQueries({ queryKey: ["visitor-passes"] });
    },
  });

  const list = passes?.results ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/reception"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Visitor Passes</h2>
          <p className="text-sm text-muted-foreground">
            Issue and track visitor entry passes
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* New Pass form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IdCard className="h-5 w-5" /> Issue New Pass
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label>Visitor Name *</Label>
              <Input value={form.visitor_name}
                onChange={(e) => setForm({ ...form, visitor_name: e.target.value })} />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={form.visitor_phone}
                  onChange={(e) => setForm({ ...form, visitor_phone: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Purpose *</Label>
                <Select value={form.purpose}
                  onChange={(e) => setForm({ ...form, purpose: e.target.value as never })}>
                  <option value="ATTENDANT">Patient Attendant</option>
                  <option value="VISITOR">General Visitor</option>
                  <option value="VENDOR">Vendor / Delivery</option>
                  <option value="CONTRACTOR">Contractor</option>
                  <option value="OFFICIAL">Official Visit</option>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Visiting Patient (optional)</Label>
              <Input placeholder="MRN / name / phone"
                value={patientQuery}
                onChange={(e) => setPatientQuery(e.target.value)} />
              {patientsData && patientsData.results.length > 0 && (
                <div className="max-h-32 divide-y overflow-y-auto rounded border">
                  {patientsData.results.slice(0, 5).map((p) => (
                    <button key={p.id} type="button"
                      onClick={() => {
                        setForm({ ...form, visiting_patient: String(p.id) });
                        setPatientQuery(`${p.full_name} (${p.mrn})`);
                      }}
                      className="block w-full p-2 text-left text-sm hover:bg-muted">
                      <span className="font-medium">{p.full_name}</span>{" "}
                      <span className="text-muted-foreground">({p.mrn})</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Relationship</Label>
                <Input value={form.relationship}
                  onChange={(e) => setForm({ ...form, relationship: e.target.value })}
                  placeholder="Father / Spouse / ..." />
              </div>
              <div className="space-y-2">
                <Label>Valid for (hours)</Label>
                <Input type="number" min="1" max="72" value={form.valid_hours}
                  onChange={(e) => setForm({ ...form, valid_hours: e.target.value })} />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label>ID Proof Type</Label>
                <Select value={form.id_proof_type}
                  onChange={(e) => setForm({ ...form, id_proof_type: e.target.value })}>
                  <option value="AADHAAR">Aadhaar</option>
                  <option value="VOTER">Voter ID</option>
                  <option value="DL">Driver's License</option>
                  <option value="PASSPORT">Passport</option>
                  <option value="OTHER">Other</option>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>ID Last 4 Digits</Label>
                <Input maxLength={4} value={form.id_proof_last4}
                  onChange={(e) => setForm({ ...form, id_proof_last4: e.target.value })} />
              </div>
            </div>

            <Button className="w-full" onClick={() => createMut.mutate()}
              disabled={!form.visitor_name || createMut.isPending}>
              {createMut.isPending ? "Issuing…" : "Issue Pass"}
            </Button>
          </CardContent>
        </Card>

        {/* Active passes */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Passes ({list.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {list.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No passes issued.</p>
            ) : (
              <div className="max-h-[600px] divide-y overflow-y-auto">
                {list.slice(0, 30).map((vp) => (
                  <div key={vp.id} className="space-y-2 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-bold">{vp.pass_no}</span>
                          {vp.is_revoked && <Badge variant="destructive">Revoked</Badge>}
                          {!vp.is_revoked && vp.exited_at && <Badge variant="secondary">Exited</Badge>}
                          {!vp.is_revoked && !vp.exited_at && vp.entered_at && (
                            <Badge variant="success">Inside</Badge>
                          )}
                          {!vp.is_revoked && !vp.entered_at && <Badge variant="info">Issued</Badge>}
                        </div>
                        <div className="text-sm">{vp.visitor_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {vp.purpose}
                          {vp.visiting_patient_name && ` · visiting ${vp.visiting_patient_name}`}
                          {vp.relationship && ` (${vp.relationship})`}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Valid until {new Date(vp.valid_until).toLocaleString()}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        {!vp.is_revoked && !vp.entered_at && (
                          <Button size="sm" variant="outline"
                            onClick={() => entryMut.mutate(vp.id)}>
                            <LogIn className="mr-1 h-3 w-3" />Entry
                          </Button>
                        )}
                        {!vp.is_revoked && vp.entered_at && !vp.exited_at && (
                          <Button size="sm" variant="outline"
                            onClick={() => exitMut.mutate(vp.id)}>
                            <LogOut className="mr-1 h-3 w-3" />Exit
                          </Button>
                        )}
                        {!vp.is_revoked && !vp.exited_at && (
                          <Button size="sm" variant="ghost"
                            onClick={() => revokeMut.mutate(vp.id)}>
                            <Ban className="h-3 w-3 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

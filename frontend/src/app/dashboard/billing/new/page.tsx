"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft, Plus, X, Search, Receipt, FileCheck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { patientsApi } from "@/lib/api/hms";
import { invoicesApi, servicesApi } from "@/lib/api/billing";
import type { Patient } from "@/types/hms";
import type { Service, Invoice } from "@/types/billing";

export default function NewInvoicePage() {
  const router = useRouter();
  const qc = useQueryClient();

  // Step 1: Patient selection
  const [patientQuery, setPatientQuery] = useState("");
  const [patientDebounce, setPatientDebounce] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [invoice, setInvoice] = useState<Invoice | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setPatientDebounce(patientQuery), 300);
    return () => clearTimeout(t);
  }, [patientQuery]);

  const { data: patientResults } = useQuery({
    queryKey: ["patient-search-bill", patientDebounce],
    queryFn: () => patientsApi.list({ search: patientDebounce }),
    enabled: patientDebounce.length >= 2,
  });

  const createInvoiceMut = useMutation({
    mutationFn: (patientId: number) => invoicesApi.create({ patient: patientId }),
    onSuccess: (inv) => {
      setInvoice(inv);
      toast.success(`Invoice ${inv.code} created`);
    },
    onError: () => toast.error("Failed to create invoice"),
  });

  const handlePatientPick = (p: Patient) => {
    setSelectedPatient(p);
    setPatientQuery(p.full_name);
    createInvoiceMut.mutate(p.id);
  };

  // Step 2: Add service items
  const [svcQuery, setSvcQuery] = useState("");
  const [svcDebounce, setSvcDebounce] = useState("");
  const [showAdHoc, setShowAdHoc] = useState(false);
  const [adHocName, setAdHocName] = useState("");
  const [adHocPrice, setAdHocPrice] = useState("");
  const [adHocGst, setAdHocGst] = useState("18");
  const [discount, setDiscount] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setSvcDebounce(svcQuery), 250);
    return () => clearTimeout(t);
  }, [svcQuery]);

  const { data: svcResults = [] } = useQuery({
    queryKey: ["svc-search", svcDebounce],
    queryFn: () => servicesApi.search(svcDebounce),
    enabled: svcDebounce.length >= 2,
  });

  const addItemMut = useMutation({
    mutationFn: (item: Record<string, unknown>) =>
      invoicesApi.addItem(invoice!.id, item),
    onSuccess: (inv) => {
      setInvoice(inv);
      setSvcQuery("");
      setAdHocName(""); setAdHocPrice("");
      toast.success("Item added");
    },
    onError: () => toast.error("Failed to add item"),
  });

  const removeItemMut = useMutation({
    mutationFn: (itemId: number) => invoicesApi.removeItem(invoice!.id, itemId),
    onSuccess: (inv) => setInvoice(inv),
  });

  const handlePickService = (s: Service) => {
    addItemMut.mutate({
      service: s.id,
      service_name: s.name,
      hsn_code: s.hsn_code,
      quantity: "1",
      unit_price: s.price,
      gst_rate: s.gst_rate,
    });
  };

  const handleAdHoc = () => {
    if (!adHocName || !adHocPrice) {
      toast.error("Item name and price required");
      return;
    }
    addItemMut.mutate({
      service_name: adHocName,
      quantity: "1",
      unit_price: adHocPrice,
      gst_rate: adHocGst,
    });
  };

  // Step 3: Finalize
  const finalizeMut = useMutation({
    mutationFn: () => invoicesApi.finalize(invoice!.id),
    onSuccess: (inv) => {
      toast.success("Invoice finalized — ready for payment");
      router.push(`/dashboard/billing/${inv.id}`);
    },
    onError: (e: unknown) => {
      const err = e as { response?: { data?: { detail?: string } } };
      toast.error(err?.response?.data?.detail ?? "Failed to finalize");
    },
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/billing"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Receipt className="h-6 w-6" />New Invoice
          </h2>
          <p className="text-sm text-muted-foreground">
            {invoice ? `${invoice.code} · DRAFT` : "Search a patient to begin"}
          </p>
        </div>
      </div>

      {/* Step 1: Patient picker */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">1. Select Patient</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!selectedPatient ? (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                className="pl-9"
                placeholder="Search by MRN, name, or phone..."
                value={patientQuery}
                onChange={(e) => setPatientQuery(e.target.value)}
              />
              {patientResults?.results && patientResults.results.length > 0 && (
                <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-64 overflow-y-auto rounded border bg-popover shadow-md">
                  {patientResults.results.map((p) => (
                    <button key={p.id} type="button"
                      onClick={() => handlePatientPick(p)}
                      className="block w-full px-3 py-2 text-left hover:bg-muted">
                      <div className="font-medium">{p.full_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {p.mrn} · {p.age}{p.gender} · {p.phone}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between rounded border p-3">
              <div>
                <div className="font-medium">{selectedPatient.full_name}</div>
                <div className="text-xs text-muted-foreground">
                  {selectedPatient.mrn} · {selectedPatient.age}{selectedPatient.gender} · {selectedPatient.phone}
                  {selectedPatient.state && ` · ${selectedPatient.state}`}
                </div>
              </div>
              <Button variant="outline" size="sm"
                onClick={() => { setSelectedPatient(null); setInvoice(null); setPatientQuery(""); }}>
                Change
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Step 2: Add items */}
      {invoice && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">2. Add Services</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Existing items */}
            {invoice.items.length > 0 && (
              <div className="overflow-x-auto rounded border">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/50 text-xs uppercase">
                    <tr>
                      <th className="px-3 py-2 text-left">Item</th>
                      <th className="px-3 py-2 text-right">Qty</th>
                      <th className="px-3 py-2 text-right">Rate</th>
                      <th className="px-3 py-2 text-right">GST%</th>
                      <th className="px-3 py-2 text-right">Total</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.items.map((item) => (
                      <tr key={item.id} className="border-b last:border-0">
                        <td className="px-3 py-2">
                          {item.service_name}
                          {item.hsn_code && (
                            <span className="ml-2 font-mono text-xs text-muted-foreground">
                              HSN: {item.hsn_code}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">{item.quantity}</td>
                        <td className="px-3 py-2 text-right font-mono">{item.unit_price}</td>
                        <td className="px-3 py-2 text-right">{item.gst_rate}%</td>
                        <td className="px-3 py-2 text-right font-mono font-medium">
                          ₹{item.total}
                        </td>
                        <td className="px-3 py-2">
                          <Button size="sm" variant="ghost"
                            onClick={() => removeItemMut.mutate(item.id)}>
                            <X className="h-3 w-3" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Service search */}
            <div className="space-y-2 border-t pt-4">
              <Label>Add from Catalog</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-9"
                  placeholder="Type service code or name (CONS-GEN, CBC, X-Ray...)"
                  value={svcQuery}
                  onChange={(e) => setSvcQuery(e.target.value)} />
                {svcResults.length > 0 && (
                  <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-64 overflow-y-auto rounded border bg-popover shadow-md">
                    {svcResults.map((s) => (
                      <button key={s.id} type="button"
                        onClick={() => handlePickService(s)}
                        className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-muted">
                        <div>
                          <div className="font-medium">{s.name}</div>
                          <div className="text-xs text-muted-foreground">
                            <span className="font-mono">{s.code}</span> · {s.category} · GST {s.gst_rate}%
                          </div>
                        </div>
                        <span className="font-mono text-sm">₹{s.price}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Ad-hoc item */}
            <div className="space-y-2 border-t pt-4">
              <button type="button"
                onClick={() => setShowAdHoc(!showAdHoc)}
                className="text-sm text-primary hover:underline">
                + Add custom item (not in catalog)
              </button>
              {showAdHoc && (
                <div className="grid gap-2 md:grid-cols-4">
                  <Input className="md:col-span-2"
                    placeholder="Item description"
                    value={adHocName}
                    onChange={(e) => setAdHocName(e.target.value)} />
                  <Input type="number" placeholder="Price"
                    value={adHocPrice}
                    onChange={(e) => setAdHocPrice(e.target.value)} />
                  <div className="flex gap-2">
                    <Input type="number" placeholder="GST%"
                      value={adHocGst}
                      onChange={(e) => setAdHocGst(e.target.value)} />
                    <Button size="sm" onClick={handleAdHoc}
                      disabled={addItemMut.isPending}>
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Totals preview */}
            <div className="space-y-1 border-t pt-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-mono">₹{invoice.subtotal}</span>
              </div>
              {Number(invoice.cgst_amount) > 0 && (
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>CGST + SGST</span>
                  <span className="font-mono">
                    ₹{invoice.cgst_amount} + ₹{invoice.sgst_amount}
                  </span>
                </div>
              )}
              {Number(invoice.igst_amount) > 0 && (
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>IGST (inter-state)</span>
                  <span className="font-mono">₹{invoice.igst_amount}</span>
                </div>
              )}
              <div className="flex justify-between border-t pt-1 text-base font-bold">
                <span>Total</span>
                <span className="font-mono">₹{invoice.total_amount}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                GST split: <Badge variant="outline">{invoice.gst_split}</Badge>
                {invoice.gst_split === "INTRA" && " (same state)"}
                {invoice.gst_split === "INTER" && " (cross state)"}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Finalize */}
      {invoice && invoice.items.length > 0 && (
        <div className="flex justify-end gap-3">
          <Button variant="outline" asChild>
            <Link href="/dashboard/billing">Save Draft & Exit</Link>
          </Button>
          <Button onClick={() => finalizeMut.mutate()}
            disabled={finalizeMut.isPending}>
            <FileCheck className="mr-2 h-4 w-4" />
            {finalizeMut.isPending ? "Finalizing…" : "Finalize & Proceed to Payment"}
          </Button>
        </div>
      )}
    </div>
  );
}

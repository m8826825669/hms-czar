"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft, Pill, X, Plus, Search, CheckCircle, AlertTriangle,
  Receipt, FileText,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { drugsApi } from "@/lib/api/hms";
import { pharmacyOrdersApi, stockApi } from "@/lib/api/pharmacy";
import type { Drug } from "@/types/hms";

export default function PharmacyOrderDetailPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { rxId } = useParams<{ rxId: string }>();
  const orderId = Number(rxId);  // The dynamic segment is named [rxId] for legacy

  const { data: order } = useQuery({
    queryKey: ["pharmacy-order", orderId],
    queryFn: () => pharmacyOrdersApi.get(orderId),
    enabled: !!orderId,
  });

  const dispenseMut = useMutation({
    mutationFn: () => pharmacyOrdersApi.dispense(orderId),
    onSuccess: (o) => {
      toast.success(`Dispensed! Invoice ${o.invoice_code} created`);
      qc.invalidateQueries({ queryKey: ["pharmacy-order", orderId] });
      qc.invalidateQueries({ queryKey: ["pharmacy"] });
    },
    onError: (e: unknown) => {
      const err = e as { response?: { data?: { detail?: string } } };
      toast.error(err?.response?.data?.detail ?? "Dispense failed");
    },
  });

  const cancelMut = useMutation({
    mutationFn: () => pharmacyOrdersApi.cancel(orderId, "Cancelled by user"),
    onSuccess: () => {
      toast.success("Order cancelled");
      qc.invalidateQueries({ queryKey: ["pharmacy-order", orderId] });
    },
  });

  if (!order) return <p className="p-8 text-center">Loading order…</p>;

  const isDraft = order.status === "DRAFT";
  const isCompleted = order.status === "COMPLETED";

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/pharmacy"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1">
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Pill className="h-6 w-6" />Order {order.code}
          </h2>
          <p className="text-sm text-muted-foreground">
            {order.patient_name} ({order.patient_mrn})
            {order.prescription_code && ` · From RX ${order.prescription_code}`}
          </p>
        </div>
        <Badge variant={
          isCompleted ? "success" : isDraft ? "warning" : "destructive"
        } className="text-sm">{order.status}</Badge>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Items - 2/3 width */}
        <div className="space-y-4 md:col-span-2">
          {/* Items table */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Items</CardTitle>
            </CardHeader>
            <CardContent>
              {order.items.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No items yet. Add drugs below.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b text-left text-xs uppercase">
                      <tr>
                        <th className="pb-2">Drug</th>
                        <th className="pb-2">Batch / Exp</th>
                        <th className="pb-2 text-right">Qty</th>
                        <th className="pb-2 text-right">MRP</th>
                        <th className="pb-2 text-right">Total</th>
                        {isDraft && <th></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {order.items.map((item) => (
                        <tr key={item.id} className="border-b last:border-0">
                          <td className="py-2">
                            <div className="font-medium">{item.drug_name}</div>
                            {item.drug_strength && (
                              <div className="text-xs text-muted-foreground">{item.drug_strength}</div>
                            )}
                          </td>
                          <td className="py-2">
                            <div className="font-mono text-xs">{item.batch_no}</div>
                            <div className="text-xs text-muted-foreground">
                              exp {item.expiry_date}
                            </div>
                          </td>
                          <td className="py-2 text-right font-medium">{item.quantity}</td>
                          <td className="py-2 text-right font-mono">₹{item.unit_mrp}</td>
                          <td className="py-2 text-right font-mono font-bold">₹{item.total}</td>
                          {isDraft && (
                            <td className="py-2">
                              <Button size="sm" variant="ghost"
                                onClick={() => pharmacyOrdersApi.removeItem(orderId, item.id)
                                  .then(() => qc.invalidateQueries({ queryKey: ["pharmacy-order", orderId] }))}>
                                <X className="h-3 w-3" />
                              </Button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Add item (only DRAFT) */}
          {isDraft && <AddItemForm orderId={orderId} />}
        </div>

        {/* Right sidebar */}
        <div className="space-y-4">
          {/* Totals */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Totals</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal (excl. GST)</span>
                <span className="font-mono">₹{order.subtotal}</span>
              </div>
              {Number(order.cgst_amount) > 0 && (
                <>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>CGST</span>
                    <span className="font-mono">₹{order.cgst_amount}</span>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>SGST</span>
                    <span className="font-mono">₹{order.sgst_amount}</span>
                  </div>
                </>
              )}
              {Number(order.igst_amount) > 0 && (
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>IGST</span>
                  <span className="font-mono">₹{order.igst_amount}</span>
                </div>
              )}
              <div className="flex justify-between border-t pt-1 text-base font-bold">
                <span>Total</span>
                <span className="font-mono">₹{order.total_amount}</span>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          {isDraft && (
            <Card>
              <CardContent className="space-y-2 p-3">
                <Button className="w-full"
                  onClick={() => dispenseMut.mutate()}
                  disabled={order.items.length === 0 || dispenseMut.isPending}>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  {dispenseMut.isPending ? "Dispensing…" : "Dispense & Generate Bill"}
                </Button>
                <Button variant="destructive" size="sm" className="w-full"
                  onClick={() => {
                    if (confirm("Cancel this draft order?")) cancelMut.mutate();
                  }}>
                  Cancel Order
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Linked invoice */}
          {isCompleted && order.invoice && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Receipt className="h-4 w-4" />Invoice
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm">{order.invoice_code}</span>
                  <Badge variant={
                    order.invoice_status === "PAID" ? "success" : "warning"
                  }>{order.invoice_status}</Badge>
                </div>
                <Link href={`/dashboard/billing/${order.invoice}`}>
                  <Button size="sm" variant="outline" className="w-full">
                    Open Invoice → Collect Payment
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}

          {/* Linked Rx */}
          {order.prescription_code && (
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center gap-2 text-sm">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">From RX:</span>
                  <span className="font-mono">{order.prescription_code}</span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Add item form ───────────────────────────────
function AddItemForm({ orderId }: { orderId: number }) {
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [selectedDrug, setSelectedDrug] = useState<Drug | null>(null);
  const [qty, setQty] = useState("1");
  const [discount, setDiscount] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 250);
    return () => clearTimeout(t);
  }, [query]);

  const { data: drugs = [] } = useQuery({
    queryKey: ["drug-search-disp", debounced],
    queryFn: () => drugsApi.search(debounced),
    enabled: debounced.length >= 2 && !selectedDrug,
  });

  // Live availability for selected drug + requested qty
  const { data: preview } = useQuery({
    queryKey: ["allocate-preview", selectedDrug?.id, qty],
    queryFn: () => stockApi.allocatePreview(selectedDrug!.id, Number(qty)),
    enabled: !!selectedDrug && Number(qty) > 0,
  });

  const addMut = useMutation({
    mutationFn: () => pharmacyOrdersApi.addItem(orderId, {
      drug_id: selectedDrug!.id,
      quantity: Number(qty),
      discount_pct: discount ? Number(discount) : 0,
    }),
    onSuccess: () => {
      toast.success("Drug added");
      setSelectedDrug(null); setQuery(""); setQty("1"); setDiscount("");
      qc.invalidateQueries({ queryKey: ["pharmacy-order", orderId] });
    },
    onError: (e: unknown) => {
      const err = e as { response?: { data?: { detail?: string } } };
      toast.error(err?.response?.data?.detail ?? "Failed to add");
    },
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Add Drug</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!selectedDrug ? (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9"
              placeholder="Search drug…"
              value={query}
              onChange={(e) => setQuery(e.target.value)} />
            {drugs.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-64 overflow-y-auto rounded border bg-popover shadow-md">
                {drugs.map((d) => (
                  <button key={d.id} type="button"
                    onClick={() => setSelectedDrug(d)}
                    className="block w-full px-3 py-2 text-left hover:bg-muted">
                    <div className="font-medium">{d.display_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {d.strength} · {d.dosage_form}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between rounded border p-2">
              <div className="text-sm">
                <div className="font-medium">{selectedDrug.display_name}</div>
                <div className="text-xs text-muted-foreground">{selectedDrug.strength}</div>
              </div>
              <Button size="sm" variant="ghost"
                onClick={() => { setSelectedDrug(null); setQuery(""); }}>
                <X className="h-3 w-3" />
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Qty</Label>
                <Input type="number" value={qty}
                  onChange={(e) => setQty(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Discount %</Label>
                <Input type="number" value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  placeholder="0" />
              </div>
            </div>

            {/* FEFO preview */}
            {preview && (
              <div className="rounded border bg-muted/30 p-2 text-xs">
                <div className="font-medium">
                  Allocation preview ({preview.total_available} available across {preview.allocations.length} batch{preview.allocations.length !== 1 ? "es" : ""})
                </div>
                {preview.allocations.length > 0 ? (
                  <div className="mt-1 space-y-0.5">
                    {preview.allocations.map((a, i) => (
                      <div key={i} className="font-mono">
                        Batch {a.batch_no} · take {a.take} · exp {a.expiry_date} · MRP ₹{a.mrp}
                      </div>
                    ))}
                  </div>
                ) : null}
                {preview.shortfall > 0 && (
                  <div className="mt-1 text-destructive">
                    <AlertTriangle className="inline h-3 w-3" /> Short by {preview.shortfall} unit(s)
                  </div>
                )}
              </div>
            )}

            <Button className="w-full" size="sm"
              onClick={() => addMut.mutate()}
              disabled={!selectedDrug || !qty || (preview?.shortfall ?? 0) > 0 || addMut.isPending}>
              <Plus className="mr-1 h-3 w-3" />
              {addMut.isPending ? "Adding…" : "Add to Order"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

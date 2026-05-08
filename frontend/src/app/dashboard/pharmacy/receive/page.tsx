"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Plus, Search, Package } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { drugsApi } from "@/lib/api/hms";
import { stockApi } from "@/lib/api/pharmacy";
import type { Drug } from "@/types/hms";

export default function ReceiveStockPage() {
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [selectedDrug, setSelectedDrug] = useState<Drug | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 250);
    return () => clearTimeout(t);
  }, [query]);

  const { data: drugs = [] } = useQuery({
    queryKey: ["drug-search-stock", debounced],
    queryFn: () => drugsApi.search(debounced),
    enabled: debounced.length >= 2,
  });

  const [form, setForm] = useState({
    batch_no: "",
    expiry_date: "",
    mfg_date: "",
    qty_purchased: "",
    mrp: "",
    purchase_price: "",
    supplier_name: "",
    supplier_invoice_no: "",
  });

  const receiveMut = useMutation({
    mutationFn: () => {
      if (!selectedDrug) throw new Error("No drug selected");
      const payload = {
        drug_id: selectedDrug.id,
        batch_no: form.batch_no,
        expiry_date: form.expiry_date,
        mfg_date: form.mfg_date || undefined,
        qty_purchased: Number(form.qty_purchased),
        mrp: Number(form.mrp),
        purchase_price: form.purchase_price ? Number(form.purchase_price) : undefined,
        supplier_name: form.supplier_name,
        supplier_invoice_no: form.supplier_invoice_no,
      };
      return stockApi.receive(payload);
    },
    onSuccess: () => {
      toast.success("Stock received");
      setForm({
        batch_no: "", expiry_date: "", mfg_date: "",
        qty_purchased: "", mrp: "", purchase_price: "",
        supplier_name: "", supplier_invoice_no: "",
      });
      setSelectedDrug(null);
      setQuery("");
      qc.invalidateQueries({ queryKey: ["pharmacy"] });
    },
    onError: (e: unknown) => {
      const err = e as { response?: { data?: unknown } };
      toast.error(JSON.stringify(err?.response?.data ?? "Failed"));
    },
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/pharmacy"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Package className="h-6 w-6" />Receive Stock
          </h2>
          <p className="text-sm text-muted-foreground">
            Add a new batch of a drug to inventory
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">1. Select Drug</CardTitle>
        </CardHeader>
        <CardContent>
          {!selectedDrug ? (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" autoFocus
                placeholder="Search by code, brand, or generic name..."
                value={query}
                onChange={(e) => setQuery(e.target.value)} />
              {drugs.length > 0 && (
                <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-64 overflow-y-auto rounded border bg-popover shadow-md">
                  {drugs.slice(0, 10).map((d) => (
                    <button key={d.id} type="button"
                      onClick={() => setSelectedDrug(d)}
                      className="block w-full px-3 py-2 text-left hover:bg-muted">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">{d.display_name}</div>
                          <div className="text-xs text-muted-foreground">
                            <span className="font-mono">{d.code}</span> · {d.strength} · {d.dosage_form}
                          </div>
                        </div>
                        {d.is_schedule_h && <Badge variant="warning">Sch H</Badge>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between rounded border p-3">
              <div>
                <div className="font-medium">{selectedDrug.display_name}</div>
                <div className="text-xs text-muted-foreground">
                  <span className="font-mono">{selectedDrug.code}</span> ·
                  {" "}{selectedDrug.strength} · {selectedDrug.dosage_form} ·
                  {" "}HSN {selectedDrug.hsn_code} · GST {selectedDrug.gst_rate}%
                </div>
              </div>
              <Button variant="outline" size="sm"
                onClick={() => { setSelectedDrug(null); setQuery(""); }}>
                Change
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedDrug && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">2. Batch Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label>Batch Number *</Label>
                <Input value={form.batch_no}
                  onChange={(e) => setForm({ ...form, batch_no: e.target.value.toUpperCase() })}
                  placeholder="ABC1234" />
              </div>
              <div>
                <Label>Quantity Received *</Label>
                <Input type="number" value={form.qty_purchased}
                  onChange={(e) => setForm({ ...form, qty_purchased: e.target.value })}
                  placeholder="100" />
              </div>
              <div>
                <Label>Manufacturing Date</Label>
                <Input type="date" value={form.mfg_date}
                  onChange={(e) => setForm({ ...form, mfg_date: e.target.value })} />
              </div>
              <div>
                <Label>Expiry Date *</Label>
                <Input type="date" value={form.expiry_date}
                  onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} />
              </div>
              <div>
                <Label>MRP per unit (GST-incl.) *</Label>
                <Input type="number" step="0.01" value={form.mrp}
                  onChange={(e) => setForm({ ...form, mrp: e.target.value })}
                  placeholder="2.50" />
              </div>
              <div>
                <Label>Purchase Price per unit</Label>
                <Input type="number" step="0.01" value={form.purchase_price}
                  onChange={(e) => setForm({ ...form, purchase_price: e.target.value })}
                  placeholder="1.20 (cost)" />
              </div>
              <div>
                <Label>Supplier</Label>
                <Input value={form.supplier_name}
                  onChange={(e) => setForm({ ...form, supplier_name: e.target.value })}
                  placeholder="MedPlus Distributors" />
              </div>
              <div>
                <Label>Supplier Invoice No.</Label>
                <Input value={form.supplier_invoice_no}
                  onChange={(e) => setForm({ ...form, supplier_invoice_no: e.target.value })}
                  placeholder="INV-12345" />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t pt-4">
              <Button variant="outline" asChild>
                <Link href="/dashboard/pharmacy">Cancel</Link>
              </Button>
              <Button
                onClick={() => receiveMut.mutate()}
                disabled={!form.batch_no || !form.expiry_date || !form.qty_purchased || !form.mrp || receiveMut.isPending}>
                <Plus className="mr-2 h-4 w-4" />
                {receiveMut.isPending ? "Saving…" : "Receive Stock"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

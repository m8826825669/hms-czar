"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Edit, Search, Tag } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { servicesApi } from "@/lib/api/billing";
import type { Service } from "@/types/billing";

const CATEGORIES: Service["category"][] = [
  "CONSULTATION", "INVESTIGATION", "PROCEDURE", "ROOM", "MEDICINE", "PACKAGE", "OTHER",
];

export default function ServiceCatalogPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [editing, setEditing] = useState<Service | null>(null);
  const [showForm, setShowForm] = useState(false);

  const { data } = useQuery({
    queryKey: ["services", search, categoryFilter],
    queryFn: () => servicesApi.list({
      search: search || undefined,
      category: categoryFilter || undefined,
      page_size: 100,
    }),
  });

  const services = data?.results ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Tag className="h-6 w-6" />Service Catalog
          </h2>
          <p className="text-muted-foreground">
            Master price list for consultations, labs, procedures
          </p>
        </div>
        <Button onClick={() => { setEditing(null); setShowForm(true); }}>
          <Plus className="mr-2 h-4 w-4" />Add Service
        </Button>
      </div>

      <Card>
        <CardContent className="grid gap-3 pt-6 md:grid-cols-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search by code or name..."
              value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="">All categories</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{services.length} services</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b text-left text-xs uppercase">
                <tr>
                  <th className="pb-2">Code</th>
                  <th className="pb-2">Name</th>
                  <th className="pb-2">Category</th>
                  <th className="pb-2 text-right">Price</th>
                  <th className="pb-2 text-right">GST%</th>
                  <th className="pb-2">HSN</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2"></th>
                </tr>
              </thead>
              <tbody>
                {services.map((s) => (
                  <tr key={s.id} className="border-b last:border-0">
                    <td className="py-2 font-mono text-xs">{s.code}</td>
                    <td className="py-2">{s.name}</td>
                    <td className="py-2"><Badge variant="outline">{s.category}</Badge></td>
                    <td className="py-2 text-right font-mono">₹{s.price}</td>
                    <td className="py-2 text-right">{s.gst_rate}%</td>
                    <td className="py-2 font-mono text-xs">{s.hsn_code}</td>
                    <td className="py-2">
                      {s.is_active ? <Badge variant="success">Active</Badge>
                                   : <Badge variant="secondary">Inactive</Badge>}
                    </td>
                    <td className="py-2">
                      <Button size="sm" variant="ghost"
                        onClick={() => { setEditing(s); setShowForm(true); }}>
                        <Edit className="h-3 w-3" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {showForm && (
        <ServiceForm
          service={editing}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSaved={() => {
            setShowForm(false); setEditing(null);
            qc.invalidateQueries({ queryKey: ["services"] });
          }}
        />
      )}
    </div>
  );
}

function ServiceForm({ service, onClose, onSaved }:
  { service: Service | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    code: service?.code ?? "",
    name: service?.name ?? "",
    category: service?.category ?? "CONSULTATION" as Service["category"],
    price: service?.price ?? "",
    hsn_code: service?.hsn_code ?? "",
    gst_rate: service?.gst_rate ?? "18",
    is_taxable: service?.is_taxable ?? true,
    is_active: service?.is_active ?? true,
    description: service?.description ?? "",
  });

  const saveMut = useMutation({
    mutationFn: () => service
      ? servicesApi.update(service.id, form)
      : servicesApi.create(form),
    onSuccess: () => {
      toast.success(service ? "Service updated" : "Service created");
      onSaved();
    },
    onError: (e: unknown) => {
      const err = e as { response?: { data?: unknown } };
      toast.error(JSON.stringify(err?.response?.data ?? "Save failed"));
    },
  });

  return (
    <Card className="border-primary">
      <CardHeader>
        <CardTitle>{service ? `Edit ${service.code}` : "New Service"}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Label>Code *</Label>
            <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              placeholder="CONS-GEN" />
          </div>
          <div>
            <Label>Category *</Label>
            <Select value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value as Service["category"] })}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label>Name *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <Label>Price (INR) *</Label>
            <Input type="number" value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })} />
          </div>
          <div>
            <Label>GST %</Label>
            <Select value={form.gst_rate}
              onChange={(e) => setForm({ ...form, gst_rate: e.target.value })}>
              <option value="0">0% (exempt)</option>
              <option value="5">5%</option>
              <option value="12">12%</option>
              <option value="18">18%</option>
              <option value="28">28%</option>
            </Select>
          </div>
          <div>
            <Label>HSN Code</Label>
            <Input value={form.hsn_code}
              onChange={(e) => setForm({ ...form, hsn_code: e.target.value })}
              placeholder="998311" />
          </div>
          <div className="flex items-center gap-4 pt-6">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.is_taxable}
                onChange={(e) => setForm({ ...form, is_taxable: e.target.checked })} />
              Taxable
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
              Active
            </label>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t pt-3">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
            {saveMut.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

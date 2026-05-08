"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Search, Package, AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { batchesApi } from "@/lib/api/pharmacy";

export default function StockBrowsePage() {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 250);
    return () => clearTimeout(t);
  }, [query]);

  const { data } = useQuery({
    queryKey: ["batches-browse", debounced],
    queryFn: () => batchesApi.list({
      search: debounced || undefined,
      ordering: "expiry_date",
      page_size: 50,
    }),
  });

  const batches = data?.results ?? [];

  // Group by drug
  const byDrug = new Map<string, typeof batches>();
  batches.forEach((b) => {
    const list = byDrug.get(b.drug_name) ?? [];
    list.push(b);
    byDrug.set(b.drug_name, list);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/pharmacy"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Package className="h-6 w-6" />Stock Browser
          </h2>
          <p className="text-sm text-muted-foreground">
            All drug batches with current quantities
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9"
              placeholder="Search by batch number, drug name, or brand..."
              value={query}
              onChange={(e) => setQuery(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{batches.length} batches across {byDrug.size} drugs</CardTitle>
        </CardHeader>
        <CardContent>
          {batches.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {debounced ? "No batches found." : "No batches in stock."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b text-left text-xs uppercase">
                  <tr>
                    <th className="pb-2">Drug</th>
                    <th className="pb-2">Batch</th>
                    <th className="pb-2">Expiry</th>
                    <th className="pb-2 text-right">In Stock</th>
                    <th className="pb-2 text-right">MRP</th>
                    <th className="pb-2 text-right">Cost</th>
                    <th className="pb-2">Supplier</th>
                  </tr>
                </thead>
                <tbody>
                  {batches.map((b) => (
                    <tr key={b.id} className="border-b last:border-0">
                      <td className="py-2">
                        <div className="font-medium">{b.drug_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {b.drug_strength} · {b.drug_dosage_form}
                        </div>
                      </td>
                      <td className="py-2 font-mono text-xs">{b.batch_no}</td>
                      <td className="py-2">
                        {b.expiry_date}
                        {b.is_expired && (
                          <Badge variant="destructive" className="ml-1">Expired</Badge>
                        )}
                        {b.is_near_expiry && !b.is_expired && (
                          <Badge variant="warning" className="ml-1 gap-1">
                            <AlertTriangle className="h-3 w-3" />Near
                          </Badge>
                        )}
                      </td>
                      <td className="py-2 text-right">
                        <span className={
                          b.qty_in_stock < 20 ? "font-bold text-orange-600" :
                          b.qty_in_stock < 50 ? "text-amber-600" : ""
                        }>
                          {b.qty_in_stock}
                        </span>
                      </td>
                      <td className="py-2 text-right font-mono">₹{b.mrp}</td>
                      <td className="py-2 text-right font-mono text-xs text-muted-foreground">
                        ₹{b.purchase_price}
                      </td>
                      <td className="py-2 text-xs text-muted-foreground">
                        {b.supplier_name || "—"}
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

"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Pill, Plus, AlertCircle, Calendar, TrendingUp, PackageMinus,
  Search,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { pharmacyOrdersApi, stockApi } from "@/lib/api/pharmacy";

export default function PharmacyDashboardPage() {
  const { data: orders } = useQuery({
    queryKey: ["pharmacy-orders", "today"],
    queryFn: () => pharmacyOrdersApi.list({
      order_date: new Date().toISOString().slice(0, 10),
      page_size: 50,
    }),
    refetchInterval: 30_000,
  });

  const { data: lowStock } = useQuery({
    queryKey: ["pharmacy", "low-stock"],
    queryFn: () => stockApi.lowStock(50),
  });

  const { data: nearExpiry } = useQuery({
    queryKey: ["pharmacy", "near-expiry"],
    queryFn: () => stockApi.nearExpiry(90),
  });

  const todayOrders = orders?.results ?? [];
  const completedToday = todayOrders.filter(o => o.status === "COMPLETED");
  const totalSales = completedToday.reduce(
    (s, o) => s + Number(o.total_amount), 0,
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Pill className="h-6 w-6" />Pharmacy
          </h2>
          <p className="text-muted-foreground">
            Inventory, dispensing, and stock alerts
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/pharmacy/receive">
            <Button variant="outline"><Plus className="mr-2 h-4 w-4" />Receive Stock</Button>
          </Link>
          <Link href="/dashboard/pharmacy/dispense">
            <Button><PackageMinus className="mr-2 h-4 w-4" />New Dispense</Button>
          </Link>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Today's Sales</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₹{totalSales.toLocaleString("en-IN")}
            </div>
            <p className="text-xs text-muted-foreground">
              {completedToday.length} dispensed today
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Open Orders</CardTitle>
            <Pill className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {todayOrders.filter(o => o.status === "DRAFT").length}
            </div>
            <p className="text-xs text-muted-foreground">drafts pending</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Low Stock</CardTitle>
            <AlertCircle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {lowStock?.count ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">drugs below threshold</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Near Expiry</CardTitle>
            <Calendar className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {nearExpiry?.count ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">batches in 90 days</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Today's orders */}
        <Card>
          <CardHeader>
            <CardTitle>Today's Orders</CardTitle>
          </CardHeader>
          <CardContent>
            {todayOrders.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No orders today.
              </p>
            ) : (
              <div className="divide-y">
                {todayOrders.slice(0, 8).map((o) => (
                  <Link href={`/dashboard/pharmacy/dispense/${o.id}`} key={o.id}
                    className="flex items-center justify-between gap-2 py-2 hover:bg-muted/30">
                    <div>
                      <div className="font-mono text-sm">{o.code}</div>
                      <div className="text-xs text-muted-foreground">{o.patient_name}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-sm">₹{o.total_amount}</div>
                      <Badge variant={
                        o.status === "COMPLETED" ? "success" :
                        o.status === "DRAFT" ? "warning" : "destructive"
                      } className="text-xs">{o.status}</Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Low stock alerts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-orange-500" />
              Low Stock Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!lowStock?.drugs?.length ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                All drugs above threshold (50).
              </p>
            ) : (
              <div className="divide-y">
                {lowStock.drugs.slice(0, 8).map((d) => (
                  <div key={d.drug_id} className="flex items-center justify-between py-2">
                    <div>
                      <div className="text-sm font-medium">{d.name}</div>
                      <div className="text-xs text-muted-foreground">
                        <span className="font-mono">{d.code}</span> · {d.dosage_form}
                      </div>
                    </div>
                    <Badge variant={d.total_in_stock < 10 ? "destructive" : "warning"}>
                      {d.total_in_stock} units
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Near expiry */}
      {nearExpiry?.batches && nearExpiry.batches.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-amber-500" />
              Batches Expiring in Next 90 Days
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b text-left text-xs uppercase">
                  <tr>
                    <th className="pb-2">Drug</th>
                    <th className="pb-2">Batch</th>
                    <th className="pb-2">Expiry</th>
                    <th className="pb-2 text-right">Stock</th>
                    <th className="pb-2 text-right">MRP</th>
                  </tr>
                </thead>
                <tbody>
                  {nearExpiry.batches.slice(0, 10).map((b) => (
                    <tr key={b.id} className="border-b last:border-0">
                      <td className="py-2">{b.drug_name}</td>
                      <td className="py-2 font-mono text-xs">{b.batch_no}</td>
                      <td className="py-2 text-amber-600">
                        {b.expiry_date}
                      </td>
                      <td className="py-2 text-right">{b.qty_in_stock}</td>
                      <td className="py-2 text-right font-mono">₹{b.mrp}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick links */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard/pharmacy/stock">
              <Button variant="outline" size="sm">
                <Search className="mr-2 h-4 w-4" />Browse Stock
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

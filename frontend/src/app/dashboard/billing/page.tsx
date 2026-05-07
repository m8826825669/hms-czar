"use client";
import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Receipt, IndianRupee, Plus, FileText, Clock, AlertCircle,
  CheckCircle, XCircle, Banknote,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { invoicesApi } from "@/lib/api/billing";
import type { Invoice } from "@/types/billing";

const STATUS_COLORS: Record<Invoice["status"], "secondary" | "warning" | "info" | "success" | "destructive" | "outline"> = {
  DRAFT: "secondary",
  PENDING: "warning",
  PARTIAL: "info",
  PAID: "success",
  CANCELLED: "destructive",
  REFUNDED: "outline",
};

export default function BillingDashboard() {
  const [search, setSearch] = useState("");

  const { data: today } = useQuery({
    queryKey: ["billing", "today"],
    queryFn: () => invoicesApi.today(),
    refetchInterval: 30_000,
  });

  const { data: searchResults } = useQuery({
    queryKey: ["billing", "search", search],
    queryFn: () => invoicesApi.list({ search }),
    enabled: search.length >= 2,
  });

  const invoices = search ? searchResults?.results ?? [] : today?.invoices ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Receipt className="h-6 w-6" />Billing
          </h2>
          <p className="text-muted-foreground">Invoices, payments, and daily collection</p>
        </div>
        <Link href="/dashboard/billing/new">
          <Button><Plus className="mr-2 h-4 w-4" />New Invoice</Button>
        </Link>
      </div>

      {/* Today's stats */}
      {today && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Billed</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₹{Number(today.total_billed).toLocaleString("en-IN")}</div>
              <p className="text-xs text-muted-foreground">{today.invoice_count} invoices today</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Collected</CardTitle>
              <Banknote className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">
                ₹{Number(today.total_collected).toLocaleString("en-IN")}
              </div>
              <p className="text-xs text-muted-foreground">payments received today</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Outstanding</CardTitle>
              <AlertCircle className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                ₹{Number(today.total_due).toLocaleString("en-IN")}
              </div>
              <p className="text-xs text-muted-foreground">pending collection</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">By Status</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="text-xs">
              {Object.entries(today.by_status).map(([k, v]) => v > 0 && (
                <div key={k} className="flex justify-between">
                  <span className="text-muted-foreground">{k}</span>
                  <span className="font-medium">{v}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <Input
            placeholder="Search by invoice number, MRN, patient name, or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </CardContent>
      </Card>

      {/* Invoice list */}
      <Card>
        <CardHeader>
          <CardTitle>{search ? `Search results (${invoices.length})` : "Today's invoices"}</CardTitle>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No invoices to show.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="pb-2">Invoice</th>
                    <th className="pb-2">Patient</th>
                    <th className="pb-2">Date</th>
                    <th className="pb-2 text-right">Total</th>
                    <th className="pb-2 text-right">Paid</th>
                    <th className="pb-2 text-right">Due</th>
                    <th className="pb-2">Status</th>
                    <th className="pb-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="py-2 font-mono text-xs font-medium">{inv.code}</td>
                      <td className="py-2">
                        <div className="font-medium">{inv.patient_name}</div>
                        <div className="text-xs text-muted-foreground">{inv.patient_mrn}</div>
                      </td>
                      <td className="py-2 text-xs">{inv.bill_date}</td>
                      <td className="py-2 text-right font-mono">
                        ₹{Number(inv.total_amount).toLocaleString("en-IN")}
                      </td>
                      <td className="py-2 text-right font-mono text-emerald-600">
                        ₹{Number(inv.amount_paid).toLocaleString("en-IN")}
                      </td>
                      <td className="py-2 text-right font-mono">
                        {Number(inv.amount_due) > 0 ? (
                          <span className="text-orange-600">
                            ₹{Number(inv.amount_due).toLocaleString("en-IN")}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="py-2">
                        <Badge variant={STATUS_COLORS[inv.status]}>{inv.status}</Badge>
                      </td>
                      <td className="py-2">
                        <Link href={`/dashboard/billing/${inv.id}`}>
                          <Button size="sm" variant="ghost">View →</Button>
                        </Link>
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

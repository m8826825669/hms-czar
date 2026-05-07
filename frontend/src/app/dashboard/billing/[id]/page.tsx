"use client";
import { useState, useEffect } from "react";
import Script from "next/script";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft, Receipt, Printer, Banknote, CreditCard, Smartphone,
  CheckCircle, XCircle, AlertCircle, IndianRupee, Building2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { invoicesApi } from "@/lib/api/billing";
import type { Invoice } from "@/types/billing";

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open: () => void };
  }
}

const STATUS_COLOR: Record<Invoice["status"], "secondary" | "warning" | "info" | "success" | "destructive" | "outline"> = {
  DRAFT: "secondary",
  PENDING: "warning",
  PARTIAL: "info",
  PAID: "success",
  CANCELLED: "destructive",
  REFUNDED: "outline",
};

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const invoiceId = Number(id);
  const qc = useQueryClient();

  const { data: invoice, refetch } = useQuery({
    queryKey: ["invoice", invoiceId],
    queryFn: () => invoicesApi.get(invoiceId),
    enabled: !!invoiceId,
  });

  const [cashAmount, setCashAmount] = useState("");
  const [cashMethod, setCashMethod] = useState("CASH");
  const [cashRef, setCashRef] = useState("");

  useEffect(() => {
    if (invoice && Number(invoice.amount_due) > 0) {
      setCashAmount(invoice.amount_due);
    }
  }, [invoice]);

  // Manual payment
  const payCashMut = useMutation({
    mutationFn: () => invoicesApi.payCash(invoiceId, {
      amount: Number(cashAmount),
      method: cashMethod,
      reference: cashRef,
    }),
    onSuccess: () => {
      toast.success("Payment recorded");
      setCashAmount(""); setCashRef("");
      qc.invalidateQueries({ queryKey: ["invoice", invoiceId] });
      qc.invalidateQueries({ queryKey: ["billing", "today"] });
    },
    onError: (e: unknown) => {
      const err = e as { response?: { data?: { detail?: string } } };
      toast.error(err?.response?.data?.detail ?? "Payment failed");
    },
  });

  // Razorpay flow
  const verifyMut = useMutation({
    mutationFn: invoicesApi.verifyPayment,
    onSuccess: (res) => {
      if (res.verified) {
        toast.success("Payment verified ✓");
      } else {
        toast.error("Signature mismatch — payment NOT marked paid");
      }
      qc.invalidateQueries({ queryKey: ["invoice", invoiceId] });
    },
  });

  const handleRazorpay = async () => {
    if (!invoice) return;
    try {
      const init = await invoicesApi.payOnline(invoiceId);
      const options = {
        key: init.razorpay_key_id,
        amount: init.amount_paise,
        currency: init.currency,
        name: "Hospital",
        description: `Invoice ${init.invoice_code}`,
        order_id: init.razorpay_order_id,
        prefill: {
          name: init.patient_name,
          contact: init.patient_phone,
          email: init.patient_email,
        },
        handler: function (response: {
          razorpay_payment_id: string;
          razorpay_order_id: string;
          razorpay_signature: string;
        }) {
          verifyMut.mutate({
            invoice_id: invoiceId,
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          });
        },
        theme: { color: "#0f172a" },
      };
      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      toast.error(err?.response?.data?.detail ?? "Razorpay init failed");
    }
  };

  // Cancel invoice
  const cancelMut = useMutation({
    mutationFn: () => invoicesApi.cancel(invoiceId, "Cancelled by user"),
    onSuccess: () => {
      toast.success("Invoice cancelled");
      qc.invalidateQueries({ queryKey: ["invoice", invoiceId] });
    },
  });

  if (!invoice) return <p className="p-8 text-center">Loading invoice…</p>;

  const isPayable = ["PENDING", "PARTIAL"].includes(invoice.status);
  const isPaid = invoice.status === "PAID";

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/billing"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1">
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Receipt className="h-6 w-6" />Invoice {invoice.code}
          </h2>
          <p className="text-sm text-muted-foreground">
            {invoice.bill_date} · {invoice.patient_name}
          </p>
        </div>
        <Badge variant={STATUS_COLOR[invoice.status]} className="text-sm">{invoice.status}</Badge>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Main invoice card - 2/3 width */}
        <div className="space-y-6 md:col-span-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Bill Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 text-sm md:grid-cols-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Patient</Label>
                  <div className="font-medium">{invoice.patient_name}</div>
                  <div className="text-xs">{invoice.patient_mrn} · {invoice.patient_phone}</div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">GST Type</Label>
                  <div>
                    <Badge variant="outline">{invoice.gst_split}</Badge>
                    {invoice.gst_split === "INTRA" && " (CGST + SGST)"}
                    {invoice.gst_split === "INTER" && " (IGST)"}
                  </div>
                </div>
              </div>

              {/* Items table */}
              <div className="overflow-x-auto rounded border">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/50 text-xs uppercase">
                    <tr>
                      <th className="px-3 py-2 text-left">Item</th>
                      <th className="px-3 py-2 text-right">Qty</th>
                      <th className="px-3 py-2 text-right">Rate</th>
                      <th className="px-3 py-2 text-right">GST</th>
                      <th className="px-3 py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.items.map((item) => (
                      <tr key={item.id} className="border-b last:border-0">
                        <td className="px-3 py-2">
                          {item.service_name}
                          {item.hsn_code && (
                            <span className="ml-2 font-mono text-xs text-muted-foreground">
                              HSN {item.hsn_code}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">{item.quantity}</td>
                        <td className="px-3 py-2 text-right font-mono">₹{item.unit_price}</td>
                        <td className="px-3 py-2 text-right">{item.gst_rate}%</td>
                        <td className="px-3 py-2 text-right font-mono font-medium">₹{item.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals breakdown */}
              <div className="space-y-1 border-t pt-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-mono">₹{invoice.subtotal}</span>
                </div>
                {Number(invoice.discount_amount) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Discount</span>
                    <span className="font-mono">-₹{invoice.discount_amount}</span>
                  </div>
                )}
                {Number(invoice.cgst_amount) > 0 && (
                  <>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>CGST</span>
                      <span className="font-mono">₹{invoice.cgst_amount}</span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>SGST</span>
                      <span className="font-mono">₹{invoice.sgst_amount}</span>
                    </div>
                  </>
                )}
                {Number(invoice.igst_amount) > 0 && (
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>IGST</span>
                    <span className="font-mono">₹{invoice.igst_amount}</span>
                  </div>
                )}
                <div className="flex justify-between border-t pt-1 text-base font-bold">
                  <span>Total</span>
                  <span className="font-mono">₹{invoice.total_amount}</span>
                </div>
                <div className="flex justify-between text-sm text-emerald-600">
                  <span>Paid</span>
                  <span className="font-mono">₹{invoice.amount_paid}</span>
                </div>
                {Number(invoice.amount_due) > 0 && (
                  <div className="flex justify-between text-base font-bold text-orange-600">
                    <span>DUE</span>
                    <span className="font-mono">₹{invoice.amount_due}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Payment history */}
          {invoice.payments.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Payment History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {invoice.payments.map((p) => (
                    <div key={p.id} className="flex items-center justify-between rounded border p-2">
                      <div className="flex items-center gap-2">
                        {p.status === "SUCCESS" ? (
                          <CheckCircle className="h-4 w-4 text-emerald-500" />
                        ) : p.status === "FAILED" ? (
                          <XCircle className="h-4 w-4 text-destructive" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-orange-500" />
                        )}
                        <div>
                          <div className="font-medium">₹{p.amount} via {p.method_label}</div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(p.received_at).toLocaleString()}
                            {p.razorpay_payment_id && ` · ${p.razorpay_payment_id}`}
                            {p.is_signature_verified && " · ✓ verified"}
                          </div>
                        </div>
                      </div>
                      <Badge variant={p.status === "SUCCESS" ? "success" : "destructive"}>
                        {p.status_label}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: payment actions */}
        <div className="space-y-4">
          {/* Print */}
          <Card>
            <CardContent className="p-3">
              <Button variant="outline" className="w-full" asChild>
                <a href={invoicesApi.printUrl(invoiceId)} target="_blank" rel="noopener">
                  <Printer className="mr-2 h-4 w-4" />Print Invoice (80mm)
                </a>
              </Button>
            </CardContent>
          </Card>

          {/* Manual payment */}
          {isPayable && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Banknote className="h-4 w-4" />Record Payment
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">Amount</Label>
                  <Input type="number" value={cashAmount}
                    onChange={(e) => setCashAmount(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Method</Label>
                  <Select value={cashMethod}
                    onChange={(e) => setCashMethod(e.target.value)}>
                    <option value="CASH">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="CARD">Card (POS)</option>
                    <option value="NETBANKING">Net Banking</option>
                    <option value="CHEQUE">Cheque</option>
                    <option value="WALLET">Wallet</option>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Reference (optional)</Label>
                  <Input value={cashRef}
                    onChange={(e) => setCashRef(e.target.value)}
                    placeholder="UPI ref / cheque no..." />
                </div>
                <Button className="w-full" onClick={() => payCashMut.mutate()}
                  disabled={!cashAmount || payCashMut.isPending}>
                  {payCashMut.isPending ? "Recording…" : "Record Payment"}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Razorpay online */}
          {isPayable && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Smartphone className="h-4 w-4" />Pay Online
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Button className="w-full" variant="default" onClick={handleRazorpay}>
                  <CreditCard className="mr-2 h-4 w-4" />
                  Pay ₹{invoice.amount_due} via Razorpay
                </Button>
                <p className="mt-2 text-xs text-muted-foreground">
                  Card / UPI / Netbanking / Wallets
                </p>
              </CardContent>
            </Card>
          )}

          {/* Cancel */}
          {!isPaid && invoice.status !== "CANCELLED" && (
            <Card>
              <CardContent className="p-3">
                <Button variant="destructive" size="sm" className="w-full"
                  onClick={() => {
                    if (confirm("Cancel this invoice?")) cancelMut.mutate();
                  }}>
                  Cancel Invoice
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

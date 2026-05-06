"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuthStore } from "@/stores/auth-store";
import { Activity, BedDouble, UserPlus, Receipt } from "lucide-react";

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">
          Welcome, {user?.full_name || user?.username}
        </h2>
        <p className="text-muted-foreground">
          {user?.hospital?.name} · {new Date().toLocaleDateString("en-IN", {
            weekday: "long", year: "numeric", month: "long", day: "numeric",
          })}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[
          { title: "OPD Today", value: "—", icon: UserPlus, hint: "Phase 1" },
          { title: "IPD Census", value: "—", icon: BedDouble, hint: "Phase 2" },
          { title: "OT Scheduled", value: "—", icon: Activity, hint: "Phase 2" },
          { title: "Today's Revenue", value: "—", icon: Receipt, hint: "Phase 1" },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground">{stat.hint}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Phase 0 — Foundation Ready</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            ✓ Authentication & RBAC (JWT, 18 roles, 70+ permissions, audit logging)
          </p>
          <p>
            ✓ Patient core model with auto-MRN, allergy / chronic condition tracking,
            and full history
          </p>
          <p>
            ✓ All 26 modules scaffolded — Reception, OPD, IPD, Ward, OT, EMR, Nursing,
            Specialist, Blood Bank, Research, Pharmacy, Stock, Bottles, Dietary,
            Laundry, Ambulance, Internal Comms, Staff/HR, Attendance, Crisis,
            Protection, Admin Security, Billing, Accounting, Scheduling, MIS Reports
          </p>
          <p>✓ Hardware hooks: barcode/QR, thermal printer (ESC/POS), biometric ingest</p>
          <p>✓ Migration commands: import_excel, import_mysql</p>
          <p className="pt-3 font-medium">
            Next: Phase 1 — Reception → OPD → Billing → EMR shell
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

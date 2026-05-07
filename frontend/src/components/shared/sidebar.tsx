"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, UserPlus, Stethoscope, BedDouble, Building2, Activity,
  FileText, Heart, Droplet, Pill, Package, Wind, Utensils,
  Shirt, Truck, MessageSquare, Users, CalendarCheck, AlertTriangle,
  Shield, Lock, Receipt, Calculator, Calendar, BarChart3, Microscope,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  perm?: string;
  group: "Clinical" | "Pharmacy" | "Support" | "HR" | "Security" | "Finance" | "Cross";
}

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, group: "Clinical" },
  // Clinical
  { href: "/dashboard/reception", label: "Reception", icon: UserPlus, perm: "reception.view", group: "Clinical" },
  { href: "/dashboard/opd", label: "OPD", icon: Stethoscope, perm: "opd.view", group: "Clinical" },
  { href: "/dashboard/ipd", label: "IPD", icon: BedDouble, perm: "ipd.view", group: "Clinical" },
  { href: "/dashboard/ward", label: "Ward", icon: Building2, perm: "ward.view", group: "Clinical" },
  { href: "/dashboard/ot", label: "OT", icon: Activity, perm: "ot.view", group: "Clinical" },
  { href: "/dashboard/emr", label: "EMR", icon: FileText, perm: "emr.view", group: "Clinical" },
  { href: "/dashboard/nursing", label: "Nursing", icon: Heart, perm: "nursing.view", group: "Clinical" },
  { href: "/dashboard/specialist", label: "Specialists", icon: Stethoscope, perm: "specialist.view", group: "Clinical" },
  { href: "/dashboard/blood-bank", label: "Blood Bank", icon: Droplet, perm: "bloodbank.view", group: "Clinical" },
  { href: "/dashboard/research", label: "Research", icon: Microscope, perm: "research.view", group: "Clinical" },
  // Pharmacy
  { href: "/dashboard/pharmacy", label: "Pharmacy", icon: Pill, perm: "pharmacy.view", group: "Pharmacy" },
  { href: "/dashboard/stock", label: "Stock & Purchase", icon: Package, perm: "stock.view", group: "Pharmacy" },
  { href: "/dashboard/bottles", label: "Bottles (O₂ / IV)", icon: Wind, perm: "bottles.view", group: "Pharmacy" },
  // Support
  { href: "/dashboard/dietary", label: "Dietary", icon: Utensils, perm: "dietary.view", group: "Support" },
  { href: "/dashboard/laundry", label: "Laundry", icon: Shirt, perm: "laundry.view", group: "Support" },
  { href: "/dashboard/ambulance", label: "Ambulance", icon: Truck, perm: "ambulance.view", group: "Support" },
  { href: "/dashboard/comms", label: "Internal Comms", icon: MessageSquare, perm: "comms.view", group: "Support" },
  // HR
  { href: "/dashboard/staff", label: "Staff & HR", icon: Users, perm: "staff.view", group: "HR" },
  { href: "/dashboard/attendance", label: "Leave & Attendance", icon: CalendarCheck, perm: "attendance.view", group: "HR" },
  // Security
  { href: "/dashboard/crisis", label: "Crisis", icon: AlertTriangle, perm: "crisis.view", group: "Security" },
  { href: "/dashboard/protection", label: "Protection", icon: Shield, perm: "protection.view", group: "Security" },
  { href: "/dashboard/admin-security", label: "Access Control", icon: Lock, perm: "adminsec.view", group: "Security" },
  // Finance
  { href: "/dashboard/billing", label: "Billing", icon: Receipt, perm: "billing.view", group: "Finance" },
  { href: "/dashboard/accounting", label: "Accounting", icon: Calculator, perm: "accounting.view", group: "Finance" },
  // Cross-cutting
  { href: "/dashboard/scheduling", label: "Scheduling", icon: Calendar, perm: "scheduling.view", group: "Cross" },
  { href: "/dashboard/reports", label: "MIS Reports", icon: BarChart3, perm: "reports.view", group: "Cross" },
  { href: "/dashboard/settings", label: "Settings", icon: Settings, group: "Cross" },
];

export function Sidebar() {
  const pathname = usePathname();
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const isSuperuser = useAuthStore((s) => s.user?.is_superuser ?? false);

  const visible = NAV.filter((n) => !n.perm || isSuperuser || hasPermission(n.perm));

  // Group by section
  const groups: Record<string, NavItem[]> = {};
  visible.forEach((n) => {
    groups[n.group] = groups[n.group] ?? [];
    groups[n.group].push(n);
  });

  const groupOrder: NavItem["group"][] = [
    "Clinical", "Pharmacy", "Support", "HR", "Security", "Finance", "Cross",
  ];

  return (
    <aside className="flex h-screen w-64 flex-col border-r bg-card">
      <div className="flex h-14 items-center border-b px-4">
        <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-primary text-primary-foreground">
            H
          </div>
          <span>HMS</span>
        </Link>
      </div>
      <nav className="flex-1 overflow-y-auto p-3">
        {groupOrder.map((g) =>
          groups[g] ? (
            <div key={g} className="mb-4">
              <div className="px-2 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {g === "Cross" ? "" : g}
              </div>
              <ul className="space-y-0.5">
                {groups[g].map((item) => {
                  const Icon = item.icon;
                  // Active when exact match, or when pathname starts with the href + "/"
                  // The "/" guard prevents `/dashboard` matching `/dashboard/reception`
                  const active =
                    pathname === item.href ||
                    (item.href !== "/dashboard" && pathname.startsWith(item.href + "/"));
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={cn(
                          "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                          active
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null,
        )}
      </nav>
    </aside>
  );
}
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  // Core
  LayoutDashboard,
  // Clinical - OPD/IPD/EMR
  ClipboardList,
  Stethoscope,
  FileText,
  BedDouble,
  // Reception & Specialist
  UserPlus,
  UserCog,
  // Diagnostics & Pharmacy
  TestTube,
  Pill,
  Syringe,
  // Surgical & Critical
  HeartPulse,
  Droplet,
  // Billing & Finance
  Receipt,
  IndianRupee,
  Shield,
  // Support Services
  Truck,
  UtensilsCrossed,
  Shirt,
  Cylinder,
  // Facilities & Operations
  Boxes,
  Package,
  Sparkles,
  // HR & People
  Users,
  Wallet,
  CalendarClock,
  ShieldAlert,
  // Patient Engagement
  MessageSquareWarning,
  // Insights
  BarChart3,
  FileBarChart,
  // Org
  Building2,
  Bell,
  Globe,
  // UI
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
};

type NavGroup = {
  label: string;
  items: NavItem[];
  defaultOpen?: boolean;
};

// ---------------------------------------------------------------------------
// Navigation Definition — 26 modules across Phases 0-4d
// ---------------------------------------------------------------------------
const NAV: NavGroup[] = [
  {
    label: "Overview",
    defaultOpen: true,
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "Front Office",
    defaultOpen: true,
    items: [
      { label: "Reception", href: "/dashboard/reception", icon: UserPlus },
      { label: "Specialist Mgmt", href: "/dashboard/specialist", icon: UserCog },
      { label: "Departments", href: "/dashboard/department", icon: Building2 },
    ],
  },
  {
    label: "Clinical",
    defaultOpen: true,
    items: [
      { label: "OPD", href: "/dashboard/opd", icon: Stethoscope },
      { label: "IPD", href: "/dashboard/ipd", icon: BedDouble },
      { label: "EMR", href: "/dashboard/emr", icon: FileText },
      { label: "OT", href: "/dashboard/ot", icon: HeartPulse },
    ],
  },
  {
    label: "Diagnostics & Therapy",
    items: [
      { label: "Pharmacy", href: "/dashboard/pharmacy", icon: Pill },
      { label: "Laboratory", href: "/dashboard/lab", icon: TestTube },
      { label: "Blood Bank", href: "/dashboard/blood-bank", icon: Droplet },
      { label: "Vaccination", href: "/dashboard/vaccination", icon: Syringe },
    ],
  },
  {
    label: "Support Services",
    items: [
      { label: "Ambulance", href: "/dashboard/ambulance", icon: Truck },
      { label: "Dietary", href: "/dashboard/dietary", icon: UtensilsCrossed },
      { label: "Laundry", href: "/dashboard/laundry", icon: Shirt },
      { label: "Gas Cylinder", href: "/dashboard/gas-cylinder", icon: Cylinder },
      { label: "Housekeeping", href: "/dashboard/housekeeping", icon: Sparkles },
    ],
  },
  {
    label: "Materials & Assets",
    items: [
      { label: "Inventory", href: "/dashboard/inventory", icon: Boxes },
      { label: "Assets", href: "/dashboard/assets", icon: Package },
    ],
  },
  {
    label: "Finance",
    items: [
      { label: "Billing", href: "/dashboard/billing", icon: Receipt },
      { label: "Insurance / TPA", href: "/dashboard/insurance", icon: Shield },
    ],
  },
  {
    label: "Workforce",
    items: [
      { label: "HR", href: "/dashboard/hr", icon: Users },
      { label: "Payroll", href: "/dashboard/payroll", icon: Wallet },
      { label: "Attendance", href: "/dashboard/attendance", icon: CalendarClock },
      { label: "Security", href: "/dashboard/security", icon: ShieldAlert },
    ],
  },
  {
    label: "Patient Engagement",
    items: [
      { label: "Complaints / NPS", href: "/dashboard/complaints", icon: MessageSquareWarning },
    ],
  },
  {
    label: "Insights",
    items: [
      { label: "Analytics", href: "/dashboard/analytics", icon: BarChart3, badge: "New" },
      { label: "Reports", href: "/dashboard/reports", icon: FileBarChart, badge: "New" },
    ],
  },
  {
    label: "System",
    items: [
      { label: "Notifications", href: "/dashboard/notifications", icon: Bell },
      { label: "Public Site", href: "/", icon: Globe },
    ],
  },
];

// ---------------------------------------------------------------------------
// Sidebar Component
// ---------------------------------------------------------------------------
export function Sidebar() {
  const pathname = usePathname();

  // Track which groups are expanded. Default to whatever each group declares,
  // and additionally auto-open any group containing the active route.
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    NAV.forEach((g) => {
      const containsActive = g.items.some((i) => pathname?.startsWith(i.href));
      initial[g.label] = !!g.defaultOpen || containsActive;
    });
    return initial;
  });

  const toggleGroup = (label: string) =>
    setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }));

  const isActive = (href: string) => {
    if (!pathname) return false;
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname === href || pathname.startsWith(href + "/");
  };

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-slate-200 bg-white">
      {/* Brand */}
      <div className="flex h-16 shrink-0 items-center gap-2 border-b border-slate-200 px-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br from-sky-500 to-indigo-600">
          <HeartPulse className="h-5 w-5 text-white" />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold text-slate-900">RTC HMS</span>
          <span className="text-[10px] uppercase tracking-wider text-slate-500">
            Hospital Management
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {NAV.map((group) => {
          const open = openGroups[group.label];
          return (
            <div key={group.label} className="mb-1">
              <button
                type="button"
                onClick={() => toggleGroup(group.label)}
                className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 hover:bg-slate-100"
              >
                <span>{group.label}</span>
                {open ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
              </button>
              {open && (
                <ul className="mt-1 space-y-0.5">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.href);
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          className={cn(
                            "group flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                            active
                              ? "bg-sky-50 font-medium text-sky-700"
                              : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                          )}
                        >
                          <Icon
                            className={cn(
                              "h-4 w-4 shrink-0",
                              active ? "text-sky-600" : "text-slate-500 group-hover:text-slate-700"
                            )}
                          />
                          <span className="flex-1 truncate">{item.label}</span>
                          {item.badge && (
                            <span className="rounded-sm bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                              {item.badge}
                            </span>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-slate-200 px-3 py-3 text-[11px] text-slate-500">
        <div className="flex items-center justify-between">
          <span>Build</span>
          <span className="font-mono">Phase 4d</span>
        </div>
        <div className="mt-0.5 flex items-center justify-between">
          <span>v</span>
          <span className="font-mono">1.0.0</span>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
"use client";

import { usePathname } from "next/navigation";

import { WorkspaceLink } from "@/components/workspace-link";

const primaryReports = [
  { href: "/financial", label: "Accounting home" },
  { href: "/reports", label: "Report library" },
  { href: "/reports/revenue", label: "Revenue" },
  { href: "/reports/invoices", label: "Invoices" },
  { href: "/reports/ar-aging", label: "AR aging" },
  { href: "/reports/equipment-revenue", label: "Equipment" },
  { href: "/reports/gl-history", label: "GL history" },
  { href: "/reports/reconciliation", label: "Reconciliation" },
];

const secondaryReports = [
  { href: "/reports/branch-revenue", label: "Branch" },
  { href: "/reports/customer-revenue", label: "Customer" },
  { href: "/reports/deal-code-revenue", label: "Deal code" },
];

export function ReportNavigation() {
  const pathname = usePathname();

  return (
    <nav className="panel sticky top-0 z-10 space-y-2 px-3 py-2">
      <div className="flex flex-wrap items-center gap-1">
        {primaryReports.map((item) => (
          <WorkspaceLink
            key={item.href}
            href={item.href}
            className={navClass(pathname, item.href)}
          >
            {item.label}
          </WorkspaceLink>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--line)] pt-2">
        <div className="flex flex-wrap gap-1">
          {secondaryReports.map((item) => (
            <WorkspaceLink
              key={item.href}
              href={item.href}
              className={navClass(pathname, item.href, "compact")}
            >
              {item.label}
            </WorkspaceLink>
          ))}
        </div>
        <div className="flex flex-wrap gap-1">
          <WorkspaceLink href="/financial" className="btn-secondary">
            Exit drilldown
          </WorkspaceLink>
          <WorkspaceLink href="/reports" className="btn-secondary">
            All reports
          </WorkspaceLink>
        </div>
      </div>
    </nav>
  );
}

function navClass(pathname: string, href: string, density: "normal" | "compact" = "normal") {
  const active = pathname === href || pathname.startsWith(`${href}/`);
  const base =
    density === "compact"
      ? "rounded-full px-2 py-1 text-[0.7rem] font-semibold"
      : "rounded-full px-3 py-1.5 text-[0.75rem] font-semibold";
  return active
    ? `${base} bg-slate-900 text-white`
    : `${base} bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900`;
}

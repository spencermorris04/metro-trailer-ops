import { PageHeader } from "@/components/page-header";
import { ExportPlaceholder, ReportKpiGrid } from "@/components/reporting";
import { SectionCard } from "@/components/section-card";
import { WorkspaceLink } from "@/components/workspace-link";
import { formatCompactNumber } from "@/lib/format";
import { getAccountingDashboardView, getReconciliationReportView } from "@/lib/server/platform";

const reportFamilies = [
  {
    title: "Revenue",
    eyebrow: "Commercial",
    description: "Period revenue by month, branch, equipment, customer, lease/order, and deal code.",
    href: "/reports/revenue",
  },
  {
    title: "AR aging",
    eyebrow: "Receivables",
    description: "Open receivables by due-date bucket, customer, document, and remaining balance.",
    href: "/reports/ar-aging",
  },
  {
    title: "Invoice register",
    eyebrow: "Receivables",
    description: "BC/RMI and Metro invoice facts with source, customer, lease, line count, and balance.",
    href: "/reports/invoices",
  },
  {
    title: "Equipment revenue",
    eyebrow: "Fleet",
    description: "Trailer-driven revenue attribution using equipment and service-period facts.",
    href: "/reports/equipment-revenue",
  },
  {
    title: "Customer revenue",
    eyebrow: "Commercial",
    description: "Customer revenue and invoice exposure across selected accounting periods.",
    href: "/reports/customer-revenue",
  },
  {
    title: "Branch revenue",
    eyebrow: "Accounting",
    description: "Service-branch revenue based on trailer/service context.",
    href: "/reports/branch-revenue",
  },
  {
    title: "Deal code revenue",
    eyebrow: "Pricing",
    description: "RMI deal-code revenue patterns for pricing and contract analysis.",
    href: "/reports/deal-code-revenue",
  },
  {
    title: "BC GL history",
    eyebrow: "Ledger",
    description: "Read-only imported Business Central GL entries with partial-import status.",
    href: "/reports/gl-history",
  },
  {
    title: "BC/RMI reconciliation",
    eyebrow: "Admin",
    description: "Import coverage, mapping gaps, stale read models, and unresolved errors.",
    href: "/reports/reconciliation",
  },
];

export default async function ReportsPage() {
  const [financial, reconciliation] = await Promise.all([
    getAccountingDashboardView(),
    getReconciliationReportView(),
  ]);

  return (
    <div className="space-y-2">
      <PageHeader
        eyebrow="Reports"
        title="ERP reports"
        description="Drilldownable accounting, revenue, receivables, GL history, and BC/RMI reconciliation."
        actions={<ExportPlaceholder />}
      />

      <ReportKpiGrid
        metrics={[
          {
            label: "Current-month revenue",
            value: `$${formatCompactNumber(financial.metrics.grossRevenue)}`,
            href: "/reports/revenue",
          },
          {
            label: "Open AR",
            value: `$${formatCompactNumber(financial.metrics.openArBalance)}`,
            href: "/reports/ar-aging",
          },
          {
            label: "Invoice facts",
            value: formatCompactNumber(reconciliation.coverage.rentalInvoiceFacts),
            href: "/reports/invoices",
          },
          {
            label: "BC GL entries",
            value: formatCompactNumber(reconciliation.coverage.bcGlEntries),
            href: "/reports/gl-history",
          },
        ]}
      />

      <div className="grid gap-2 xl:grid-cols-3">
        {reportFamilies.map((report) => (
          <WorkspaceLink key={report.href} href={report.href} className="block">
            <SectionCard
              eyebrow={report.eyebrow}
              title={report.title}
              description={report.description}
              className="h-full transition hover:border-[var(--brand)]"
            >
              <span className="btn-secondary">Open report</span>
            </SectionCard>
          </WorkspaceLink>
        ))}
      </div>
    </div>
  );
}

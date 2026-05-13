import { PageHeader } from "@/components/page-header";
import {
  ExportPlaceholder,
  PeriodSelector,
  ReportKpiGrid,
  SourceCoverageBadge,
  getSingleParam,
} from "@/components/reporting";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import { WorkspaceLink } from "@/components/workspace-link";
import { formatCompactNumber, formatCurrency } from "@/lib/format";
import { getAccountingDashboardView } from "@/lib/server/platform";

type FinancialPageProps = {
  searchParams: Promise<{
    period?: string | string[];
    start?: string | string[];
    end?: string | string[];
  }>;
};

export default async function FinancialPage({ searchParams }: FinancialPageProps) {
  const params = await searchParams;
  const view = await getAccountingDashboardView({
    period: getSingleParam(params.period),
    start: getSingleParam(params.start),
    end: getSingleParam(params.end),
  });
  const periodParam = view.period.key;

  return (
    <div className="space-y-2">
      <PageHeader
        eyebrow="Accounting"
        title="Accounting command center"
        description="Current-period accounting health, receivables, close readiness, and BC/RMI coverage."
        actions={
          <>
            <WorkspaceLink href="/reports/revenue" className="btn-secondary">
              Revenue reports
            </WorkspaceLink>
            <WorkspaceLink href="/reports/ar-aging" className="btn-secondary">
              AR aging
            </WorkspaceLink>
            <ExportPlaceholder />
          </>
        }
      />

      <PeriodSelector basePath="/financial" period={view.period} />

      <ReportKpiGrid
        metrics={[
          {
            label: "Period revenue",
            value: formatCurrency(view.metrics.grossRevenue),
            href: `/reports/revenue?period=${periodParam}`,
            helper:
              view.metrics.revenueDeltaPercent === null
                ? "No prior comparison"
                : `${view.metrics.revenueDeltaPercent.toFixed(1)}% vs prior period`,
          },
          {
            label: "Period invoices",
            value: formatCompactNumber(view.metrics.invoiceCount),
            href: `/reports/invoices?period=${periodParam}`,
            helper: `${formatCompactNumber(view.metrics.lineCount)} billing lines`,
          },
          {
            label: "Equipment billed",
            value: formatCompactNumber(view.metrics.equipmentCount),
            href: `/reports/equipment-revenue?period=${periodParam}`,
            helper: "Trailer/service-period attribution",
          },
          {
            label: "Open AR balance",
            value: formatCurrency(view.metrics.openArBalance),
            href: "/reports/ar-aging",
            helper: `${formatCompactNumber(view.metrics.openArInvoices)} open entries`,
          },
          {
            label: "Overdue AR",
            value: formatCurrency(view.metrics.overdueArBalance),
            href: "/reports/ar-aging?bucket=overdue",
            helper: `${formatCompactNumber(view.metrics.overdueArInvoices)} overdue entries`,
          },
          {
            label: "Unapplied receipts",
            value: formatCurrency(view.metrics.unappliedReceipts),
            href: "/reports/ar-aging?q=payment",
            helper: `${formatCompactNumber(view.metrics.unappliedReceiptCount)} open credits`,
          },
          {
            label: "Tax",
            value: formatCurrency(view.metrics.taxAmount),
            href: `/reports/revenue?period=${periodParam}&groupBy=month`,
            helper: "Current selected period",
          },
          {
            label: "Damage waiver",
            value: formatCurrency(view.metrics.damageWaiverAmount),
            href: `/reports/deal-code-revenue?period=${periodParam}`,
            helper: `${formatCompactNumber(view.metrics.creditMemoCount)} credit memos`,
          },
        ]}
      />

      <div className="grid gap-2 xl:grid-cols-3">
        <SectionCard eyebrow="AR" title="Open receivables aging">
          <div className="divide-y divide-[var(--line)]">
            {view.arAging.map((bucket) => (
              <WorkspaceLink
                key={bucket.bucket}
                href={`/reports/ar-aging?bucket=${encodeURIComponent(bucket.bucket)}`}
                className="flex items-center justify-between py-1.5 hover:text-[var(--brand)]"
              >
                <div>
                  <div className="font-semibold text-slate-900">{bucket.bucket}</div>
                  <div className="text-[0.65rem] text-slate-400">
                    {formatCompactNumber(bucket.entryCount)} ledger entries
                  </div>
                </div>
                <div className="font-semibold text-slate-900">
                  {formatCurrency(bucket.balance)}
                </div>
              </WorkspaceLink>
            ))}
          </div>
        </SectionCard>

        <SectionCard eyebrow="Branch" title="Top service branches this period">
          <div className="divide-y divide-[var(--line)]">
            {view.topBranches.map((branch) => (
              <WorkspaceLink
                key={branch.branchCode}
                href={`/reports/branch-revenue?period=${periodParam}&q=${encodeURIComponent(branch.branchCode)}`}
                className="flex items-center justify-between py-1.5 hover:text-[var(--brand)]"
              >
                <div>
                  <div className="font-semibold text-slate-900">{branch.branchCode}</div>
                  <div className="text-[0.65rem] text-slate-400">
                    {formatCompactNumber(branch.invoiceCount)} invoices /{" "}
                    {formatCompactNumber(branch.lineCount)} lines
                  </div>
                </div>
                <div className="font-semibold text-slate-900">
                  {formatCurrency(branch.grossRevenue)}
                </div>
              </WorkspaceLink>
            ))}
          </div>
        </SectionCard>

        <SectionCard eyebrow="Close" title="Accounting readiness">
          <div className="space-y-2 text-[0.75rem]">
            <div className="flex items-center justify-between">
              <span>AP history</span>
              <StatusPill label="Pending seed" />
            </div>
            <div className="flex items-center justify-between">
              <span>BC GL import</span>
              <StatusPill label={view.glImport.latestRun?.status ?? "Unknown"} />
            </div>
            <div className="flex items-center justify-between">
              <span>Unresolved import errors</span>
              <WorkspaceLink href="/reports/reconciliation" className="font-semibold text-[var(--brand)]">
                {formatCompactNumber(view.metrics.unresolvedImportErrors)}
              </WorkspaceLink>
            </div>
            <div className="flex items-center justify-between">
              <span>Read model</span>
              <StatusPill label={view.refreshState?.status ?? "Missing"} />
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-2 xl:grid-cols-2">
        <SectionCard eyebrow="Imported history" title="BC/RMI coverage">
          <div className="grid grid-cols-2 gap-px border border-[var(--line)] bg-[var(--line)]">
            {[
              ["Billing facts", view.coverage.rentalBillingFacts],
              ["Invoice facts", view.coverage.rentalInvoiceFacts],
              ["AR ledger facts", view.coverage.arLedgerFacts],
              ["BC GL entries", view.coverage.bcGlEntries],
            ].map(([label, value]) => (
              <div key={label} className="bg-white px-3 py-2">
                <p className="workspace-metric-label">{label}</p>
                <p className="text-base font-semibold text-slate-900">
                  {formatCompactNumber(Number(value))}
                </p>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard eyebrow="Source" title="Report freshness and GL state">
          <div className="space-y-2">
            <SourceCoverageBadge
              source="BC/RMI facts + Metro app-native accounting tables"
              refreshState={view.refreshState}
            />
            <div className="rounded-md border border-[var(--line)] px-3 py-2 text-[0.75rem] text-slate-600">
              BC GL rows visible: {formatCompactNumber(view.glImport.rowCount)}. Latest GL run:{" "}
              {view.glImport.latestRun?.recordsSeen
                ? `${formatCompactNumber(view.glImport.latestRun.recordsSeen)} seen`
                : "not found"}
              . Historical GL remains read-only and separate from app-native journal entries.
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

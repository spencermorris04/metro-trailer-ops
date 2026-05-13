import { PageHeader } from "@/components/page-header";
import { ExportPlaceholder, ReportKpiGrid, SourceCoverageBadge } from "@/components/reporting";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import { WorkspaceLink } from "@/components/workspace-link";
import { formatCompactNumber } from "@/lib/format";
import { getReconciliationReportView } from "@/lib/server/platform";

export default async function ReconciliationReportPage() {
  const view = await getReconciliationReportView();

  return (
    <div className="space-y-2">
      <PageHeader
        eyebrow="Reports"
        title="BC/RMI reconciliation"
        description="Import coverage, mapping gaps, read-model freshness, and unresolved source errors."
        actions={<ExportPlaceholder />}
      />
      <ReportKpiGrid
        metrics={[
          ["Billing facts", formatCompactNumber(view.coverage.rentalBillingFacts)],
          ["Invoice facts", formatCompactNumber(view.coverage.rentalInvoiceFacts)],
          ["AR ledger facts", formatCompactNumber(view.coverage.arLedgerFacts)],
          ["BC GL entries", formatCompactNumber(view.coverage.bcGlEntries)],
          ["Unmatched customer invoices", formatCompactNumber(view.unmatched.customerInvoices)],
          ["Unmatched asset lines", formatCompactNumber(view.unmatched.assetLines)],
          ["GL import status", view.glImport.latestRun?.status ?? "Unknown"],
          ["Read model", view.refreshState?.status ?? "Missing"],
        ].map(([label, value]) => ({ label, value }))}
      />
      <SourceCoverageBadge source="BC/RMI raw imports + reporting fact tables" refreshState={view.refreshState} />
      <div className="grid gap-2 xl:grid-cols-2">
        <SectionCard eyebrow="Import" title="GL import progress">
          <div className="space-y-2 text-[0.75rem]">
            <div className="flex items-center justify-between">
              <span>Status</span>
              <StatusPill label={view.glImport.latestRun?.status ?? "Unknown"} />
            </div>
            <div className="flex items-center justify-between">
              <span>Rows visible</span>
              <span className="font-semibold text-slate-900">{formatCompactNumber(view.glImport.rowCount)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Records seen</span>
              <span className="font-semibold text-slate-900">
                {formatCompactNumber(view.glImport.latestRun?.records_seen ?? 0)}
              </span>
            </div>
            <WorkspaceLink href="/integrations/business-central/import-runs" className="btn-secondary">
              View import runs
            </WorkspaceLink>
          </div>
        </SectionCard>

        <SectionCard eyebrow="Errors" title="Unresolved import errors by entity">
          <div className="divide-y divide-[var(--line)]">
            {view.unresolvedErrorsByEntity.length === 0 ? (
              <div className="py-2 text-[0.75rem] text-slate-400">No unresolved import errors.</div>
            ) : (
              view.unresolvedErrorsByEntity.map((row) => (
                <div key={row.entityType} className="flex items-center justify-between py-1.5">
                  <span className="font-semibold text-slate-900">{row.entityType}</span>
                  <span>{formatCompactNumber(row.count)}</span>
                </div>
              ))
            )}
          </div>
          <div className="mt-3">
            <WorkspaceLink href="/integrations/business-central/import-errors" className="btn-secondary">
              View import errors
            </WorkspaceLink>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

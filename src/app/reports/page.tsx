import Link from "next/link";

import { JsonActionButton } from "@/components/json-action-button";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import { formatCurrency } from "@/lib/format";
import {
  getFinancialDashboardView,
  getReconciliationReportsView,
  getReports,
} from "@/lib/server/platform";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const [reports, financial, reconciliation] = await Promise.all([
    getReports(),
    getFinancialDashboardView(),
    getReconciliationReportsView(),
  ]);

  return (
    <div className="space-y-2">
      <PageHeader
        eyebrow="Admin"
        title="Reports"
        description="Operations, commercial, accounting, and BC reconciliation views."
        actions={<JsonActionButton endpoint="/api/reports" method="POST" label="Prepare export" />}
      />

      <div className="grid gap-2 xl:grid-cols-2">
        <SectionCard eyebrow="Operations" title="Fleet and service">
          <div className="grid grid-cols-2 gap-px border border-[var(--line)] bg-[var(--line)]">
            {reports.utilization.slice(0, 4).map((record) => (
              <div key={record.branch} className="bg-white px-3 py-2">
                <p className="workspace-metric-label">{record.branch}</p>
                <p className="text-base font-semibold text-slate-900">
                  {record.utilizationRate}%
                </p>
                <p className="text-[0.65rem] text-slate-400">
                  {record.onRentCount}/{record.fleetCount} on rent
                </p>
              </div>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-px border border-[var(--line)] bg-[var(--line)]">
            {[
              ["Open work orders", reports.maintenanceSummary.openWorkOrders],
              ["Verification queue", reports.maintenanceSummary.verificationQueue],
              ["Failed inspections", reports.inspectionDamageSummary.failed],
              ["Damaged assets", reports.inspectionDamageSummary.damagedAssets],
            ].map(([label, value]) => (
              <div key={label} className="bg-white px-3 py-2">
                <p className="workspace-metric-label">{label}</p>
                <p className="text-base font-semibold text-slate-900">{value}</p>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard eyebrow="Commercial" title="Revenue and receivables">
          <div className="grid grid-cols-2 gap-px border border-[var(--line)] bg-[var(--line)]">
            {reports.revenueSeries.map((point) => (
              <div key={point.label} className="bg-white px-3 py-2">
                <StatusPill label={point.label} />
                <p className="mt-1 text-base font-semibold text-slate-900">
                  {formatCurrency(point.revenue)}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-px border border-[var(--line)] bg-[var(--line)]">
            {[
              ["Uninvoiced events", financial.metrics.uninvoicedCommercialEvents],
              ["Open AR invoices", financial.metrics.openArInvoices],
              ["Unapplied receipts", financial.metrics.unappliedReceipts],
              ["Open AP bills", financial.metrics.openApBills],
            ].map(([label, value]) => (
              <div key={label} className="bg-white px-3 py-2">
                <p className="workspace-metric-label">{label}</p>
                <p className="text-base font-semibold text-slate-900">{value}</p>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-2 xl:grid-cols-2">
        <SectionCard eyebrow="Accounting" title="Ledger posture">
          <div className="grid grid-cols-2 gap-px border border-[var(--line)] bg-[var(--line)]">
            {[
              ["Open AR balance", formatCurrency(financial.metrics.openArBalance)],
              ["Open AP balance", formatCurrency(financial.metrics.openApBalance)],
              [
                "Unapplied receipt amount",
                formatCurrency(financial.metrics.unappliedReceiptAmount),
              ],
              [
                "Trial balance delta",
                formatCurrency(financial.metrics.currentTrialBalanceDelta),
              ],
            ].map(([label, value]) => (
              <div key={label} className="bg-white px-3 py-2">
                <p className="workspace-metric-label">{label}</p>
                <p className="text-base font-semibold text-slate-900">{value}</p>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard eyebrow="BC Reconciliation" title="Seed and linkage health">
          <div className="grid grid-cols-2 gap-px border border-[var(--line)] bg-[var(--line)]">
            {[
              ["Seeded assets", reconciliation.metrics.seededAssetsVisible],
              ["Seeded contracts", reconciliation.metrics.seededContractsVisible],
              ["Seeded invoices", reconciliation.metrics.seededInvoicesVisible],
              ["Source docs", reconciliation.metrics.sourceDocuments],
              ["Linked contracts", reconciliation.metrics.linkedContracts],
              ["Linked invoices", reconciliation.metrics.linkedInvoices],
              ["Import errors", reconciliation.metrics.importErrors],
            ].map(([label, value]) => (
              <div key={label} className="bg-white px-3 py-2">
                <p className="workspace-metric-label">{label}</p>
                <p className="text-base font-semibold text-slate-900">{value}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <Link href="/source-documents" className="btn-secondary">
              Source documents
            </Link>
            <Link href="/integrations/business-central/import-errors" className="btn-secondary">
              Import errors
            </Link>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

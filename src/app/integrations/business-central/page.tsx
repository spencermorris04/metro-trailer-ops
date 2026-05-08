import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import { formatDate } from "@/lib/format";
import { getBusinessCentralOverviewView } from "@/lib/server/platform";


export default async function BusinessCentralPage() {
  const overview = await getBusinessCentralOverviewView();

  return (
    <div className="space-y-2">
      <PageHeader
        eyebrow="Admin"
        title="Business Central"
        description="Import runs, checkpoints, coverage, and reconciliation posture for BC-seeded data."
        actions={
          <>
            <Link href="/integrations/business-central/import-runs" className="btn-secondary">
              Import runs
            </Link>
            <Link href="/integrations/business-central/import-errors" className="btn-secondary">
              Import errors
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-4 gap-px border border-[var(--line)] bg-[var(--line)]">
        {[
          ["Assets", overview.metrics.assets],
          ["Customers", overview.metrics.customers],
          ["Contracts", overview.metrics.contracts],
          ["Invoices", overview.metrics.invoices],
          ["RMI invoice headers", overview.metrics.bcRmiPostedRentalInvoiceHeaders],
          ["RMI rental headers", overview.metrics.bcRmiPostedRentalHeaders],
          ["RMI rental lines", overview.metrics.bcRmiPostedRentalLines],
          ["RMI ledger", overview.metrics.bcRmiRentalLedgerEntries],
          ["BC GL", overview.metrics.bcGlEntries],
          ["BC AR", overview.metrics.bcCustomerLedgerEntries],
          ["BC accounts", overview.metrics.bcGlAccounts],
          ["Dimensions", overview.metrics.bcDimensionSets],
          ["Source docs", overview.metrics.sourceDocuments],
          ["Source lines", overview.metrics.sourceDocumentLines],
        ].map(([label, value]) => (
          <div key={label} className="bg-white px-3 py-2">
            <p className="workspace-metric-label">{label}</p>
            <p className="text-base font-semibold text-slate-900">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-2 xl:grid-cols-2">
        <SectionCard eyebrow="Latest run" title="Import posture">
          {overview.latestRun ? (
            <div className="space-y-2 text-[0.75rem] text-slate-600">
              <div className="flex items-center gap-2">
                <StatusPill label={overview.latestRun.status} />
                <span>{formatDate(overview.latestRun.startedAt)}</span>
              </div>
              <div>Finished: {overview.latestRun.finishedAt ? formatDate(overview.latestRun.finishedAt) : "Running"}</div>
              <div>Seen: {overview.latestRun.recordsSeen}</div>
              <div>Inserted: {overview.latestRun.recordsInserted}</div>
              <div>Updated: {overview.latestRun.recordsUpdated}</div>
              <div>Failed: {overview.latestRun.recordsFailed}</div>
            </div>
          ) : (
            <div className="text-[0.75rem] text-slate-400">No BC import run recorded yet.</div>
          )}
        </SectionCard>

        <SectionCard eyebrow="Checkpoints" title="Resumable import markers">
          <div className="divide-y divide-[var(--line)]">
            {overview.checkpoints.map((checkpoint) => (
              <div key={checkpoint.id} className="py-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-900">{checkpoint.entityType}</span>
                  <span className="text-[0.65rem] text-slate-400">
                    {formatDate(checkpoint.updatedAt)}
                  </span>
                </div>
                <div className="text-[0.65rem] text-slate-500">
                  {checkpoint.cursor ?? "No cursor"} / {checkpoint.status}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <SectionCard eyebrow="Errors" title="Recent import errors">
        <div className="data-table">
          <table>
            <thead>
              <tr>
                <th>Entity</th>
                <th>Error</th>
                <th>Message</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {overview.recentErrors.map((error) => (
                <tr key={error.id}>
                  <td>{error.entityType}</td>
                  <td>{error.errorCode}</td>
                  <td>{error.message}</td>
                  <td>{formatDate(error.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

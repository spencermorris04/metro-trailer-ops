import { Suspense } from "react";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import { WorkspaceLink } from "@/components/workspace-link";
import { DetailPageSkeleton } from "@/components/workspace-skeletons";
import { formatCurrency, formatDate, titleize } from "@/lib/format";
import { getLeaseDetailView } from "@/lib/server/platform";

export const unstable_instant = { prefetch: "static" };

type LeaseDetailPageProps = {
  params: Promise<{
    leaseId: string;
  }>;
};

export default function LeaseDetailPage({ params }: LeaseDetailPageProps) {
  return (
    <Suspense fallback={<DetailPageSkeleton />}>
      <LeaseDetailContent params={params} />
    </Suspense>
  );
}

async function LeaseDetailContent({ params }: LeaseDetailPageProps) {
  const { leaseId } = await params;
  const detail = await getLeaseDetailView(leaseId);

  if (!detail) {
    notFound();
  }

  const { summary } = detail;

  return (
    <div className="space-y-2">
      <PageHeader
        eyebrow="Lease"
        title={summary.leaseKey}
        description="Lease/order detail with imported BC invoices, trailer line history, assets, and app-native linkage."
        actions={
          <>
            <WorkspaceLink href="/leases" className="btn-secondary">
              Back to leases
            </WorkspaceLink>
            <WorkspaceLink href="/ar/invoices" className="btn-secondary">
              Invoices
            </WorkspaceLink>
          </>
        }
      />

      <div className="grid gap-2 xl:grid-cols-3">
        <SectionCard eyebrow="Summary" title="Lease identity" className="xl:col-span-2">
          <div className="grid gap-3 md:grid-cols-4">
            <div>
              <p className="workspace-metric-label">Customer</p>
              <p className="text-sm font-semibold text-slate-900">
                {summary.customerName}
              </p>
              <p className="text-[0.7rem] text-slate-400">
                {summary.customerNumber ?? "No customer number"}
              </p>
            </div>
            <div>
              <p className="workspace-metric-label">Source</p>
              <p className="text-sm font-semibold text-slate-900">
                {titleize(summary.source.replaceAll("_", " "))}
              </p>
              <p className="text-[0.7rem] text-slate-400">{summary.completeness}</p>
            </div>
            <div>
              <p className="workspace-metric-label">First invoice</p>
              <p className="text-sm font-semibold text-slate-900">
                {summary.firstInvoiceDate ? formatDate(summary.firstInvoiceDate) : "Unknown"}
              </p>
            </div>
            <div>
              <p className="workspace-metric-label">Latest invoice</p>
              <p className="text-sm font-semibold text-slate-900">
                {summary.latestInvoiceDate ? formatDate(summary.latestInvoiceDate) : "Unknown"}
              </p>
            </div>
          </div>
        </SectionCard>

        <SectionCard eyebrow="Posture" title="Accounting readiness">
          <div className="space-y-2 text-[0.75rem] text-slate-600">
            <div className="flex items-center justify-between">
              <span>Invoices</span>
              <span className="font-semibold text-slate-900">{summary.invoiceCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>BC open balance</span>
              <StatusPill label="Pending ledger import" />
            </div>
            <div className="flex items-center justify-between">
              <span>Location</span>
              <span className="font-semibold text-slate-900">
                {summary.locationCode ?? "Unknown"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Responsibility center</span>
              <span className="font-semibold text-slate-900">
                {summary.responsibilityCenter ?? "Unknown"}
              </span>
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-2 xl:grid-cols-2">
        <SectionCard
          eyebrow="Invoices"
          title="Posted invoice history"
          description="BC invoices are read-only history until promoted into Metro-native records."
        >
          <div className="divide-y divide-[var(--line)]">
            {detail.invoices.length === 0 ? (
              <div className="py-1.5 text-[0.75rem] text-slate-400">
                No imported invoices are attached to this lease key.
              </div>
            ) : (
              detail.invoices.slice(0, 20).map((invoice) => (
                <div key={invoice.invoiceNumber} className="flex items-center justify-between py-1.5">
                  <div>
                    <WorkspaceLink
                      href={`/ar/invoices/${invoice.invoiceNumber}`}
                      className="font-semibold text-[var(--brand)]"
                    >
                      {invoice.invoiceNumber}
                    </WorkspaceLink>
                    <div className="text-[0.65rem] text-slate-400">
                      {invoice.invoiceDate ? formatDate(invoice.invoiceDate) : "Unknown"} /{" "}
                      {invoice.lineCount} lines
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-slate-900">
                      {formatCurrency(invoice.totalAmount)}
                    </div>
                    <StatusPill label={invoice.status} />
                  </div>
                </div>
              ))
            )}
          </div>
        </SectionCard>

        <SectionCard eyebrow="Assets" title="Trailers and equipment">
          <div className="divide-y divide-[var(--line)]">
            {detail.assets.length === 0 ? (
              <div className="py-1.5 text-[0.75rem] text-slate-400">
                No imported fixed-asset lines are attached yet.
              </div>
            ) : (
              detail.assets.slice(0, 20).map((asset) => (
                <div key={asset.assetId} className="flex items-center justify-between py-1.5">
                  <div>
                    <WorkspaceLink
                      href={`/assets/${asset.assetId}`}
                      className="font-semibold text-[var(--brand)]"
                    >
                      {asset.assetNumber}
                    </WorkspaceLink>
                    <div className="text-[0.65rem] text-slate-400">
                      {titleize(asset.assetType)} / {asset.invoiceCount} invoices
                    </div>
                  </div>
                  <div className="font-semibold text-slate-900">
                    {formatCurrency(asset.grossAmount)}
                  </div>
                </div>
              ))
            )}
          </div>
        </SectionCard>
      </div>

      <SectionCard eyebrow="Lines" title="Imported BC/RMI line detail">
        <div className="data-table">
          <table>
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Asset/item</th>
                <th>Type</th>
                <th>Description</th>
                <th>Period</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {detail.lines.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-slate-400">
                    No imported BC/RMI lines are attached to this lease key yet.
                  </td>
                </tr>
              ) : (
                detail.lines.map((line) => (
                  <tr key={line.id}>
                    <td>
                      <WorkspaceLink
                        href={`/ar/invoices/${line.invoiceNumber}`}
                        className="font-semibold text-[var(--brand)]"
                      >
                        {line.invoiceNumber}
                      </WorkspaceLink>
                      <br />
                      <span className="text-[0.65rem] text-slate-400">
                        Line {line.lineNo}
                      </span>
                    </td>
                    <td>
                      {line.assetId ? (
                        <WorkspaceLink href={`/assets/${line.assetId}`} className="text-[var(--brand)]">
                          {line.assetNumber}
                        </WorkspaceLink>
                      ) : (
                        line.itemNo ?? "-"
                      )}
                    </td>
                    <td>
                      {line.lineType ?? "-"}
                      <br />
                      <span className="text-[0.65rem] text-slate-400">
                        {line.type ?? "-"}
                      </span>
                    </td>
                    <td>{line.description ?? "No description"}</td>
                    <td>
                      {line.invoiceFromDate ? formatDate(line.invoiceFromDate) : "Unknown"}
                      <br />
                      <span className="text-[0.65rem] text-slate-400">
                        {line.invoiceThruDate ? formatDate(line.invoiceThruDate) : "Open"}
                      </span>
                    </td>
                    <td className="font-semibold text-slate-900">
                      {formatCurrency(line.grossAmount)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {detail.canonical ? (
        <SectionCard eyebrow="Metro" title="App-native lease linkage">
          <div className="grid gap-3 md:grid-cols-4">
            <div>
              <p className="workspace-metric-label">Status</p>
              <p className="text-sm font-semibold text-slate-900">
                {titleize(detail.canonical.summary.status)}
              </p>
            </div>
            <div>
              <p className="workspace-metric-label">Commercial stage</p>
              <p className="text-sm font-semibold text-slate-900">
                {titleize(detail.canonical.summary.commercialStage ?? detail.canonical.summary.status)}
              </p>
            </div>
            <div>
              <p className="workspace-metric-label">Outstanding</p>
              <p className="text-sm font-semibold text-slate-900">
                {formatCurrency(detail.canonical.summary.outstandingBalance ?? 0)}
              </p>
            </div>
            <div>
              <p className="workspace-metric-label">Native lines</p>
              <p className="text-sm font-semibold text-slate-900">
                {detail.canonical.lines.length}
              </p>
            </div>
          </div>
        </SectionCard>
      ) : null}
    </div>
  );
}

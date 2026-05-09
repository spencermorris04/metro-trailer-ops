import { Suspense } from "react";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import { WorkspaceLink } from "@/components/workspace-link";
import { DetailPageSkeleton } from "@/components/workspace-skeletons";
import { formatCurrency, formatDate, titleize } from "@/lib/format";
import { getInvoiceDetailView } from "@/lib/server/platform";

export const unstable_instant = { prefetch: "static" };

type InvoiceDetailPageProps = {
  params: Promise<{
    invoiceNo: string;
  }>;
};

export default function InvoiceDetailPage({ params }: InvoiceDetailPageProps) {
  return (
    <Suspense fallback={<DetailPageSkeleton />}>
      <InvoiceDetailContent params={params} />
    </Suspense>
  );
}

async function InvoiceDetailContent({ params }: InvoiceDetailPageProps) {
  const { invoiceNo } = await params;
  const detail = await getInvoiceDetailView(invoiceNo);

  if (!detail) {
    notFound();
  }

  const { summary } = detail;

  return (
    <div className="space-y-2">
      <PageHeader
        eyebrow="Invoice"
        title={summary.invoiceNumber}
        description="Invoice header, RMI lines, trailer attribution, service periods, and source lineage."
        actions={
          <>
            <WorkspaceLink href="/ar/invoices" className="btn-secondary">
              Back to invoices
            </WorkspaceLink>
            {summary.leaseKey ? (
              <WorkspaceLink href={`/leases/${summary.leaseKey}`} className="btn-secondary">
                Lease
              </WorkspaceLink>
            ) : null}
          </>
        }
      />

      <div className="grid gap-2 xl:grid-cols-3">
        <SectionCard eyebrow="Summary" title="Invoice identity" className="xl:col-span-2">
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
              <p className="workspace-metric-label">Lease/order</p>
              <p className="text-sm font-semibold text-slate-900">
                {summary.leaseKey ?? "Unassigned"}
              </p>
              <p className="text-[0.7rem] text-slate-400">
                {summary.previousDocumentType ?? summary.sourceDocumentType ?? "-"}
              </p>
            </div>
            <div>
              <p className="workspace-metric-label">Invoice date</p>
              <p className="text-sm font-semibold text-slate-900">
                {summary.invoiceDate ? formatDate(summary.invoiceDate) : "Unknown"}
              </p>
            </div>
            <div>
              <p className="workspace-metric-label">Due date</p>
              <p className="text-sm font-semibold text-slate-900">
                {summary.dueDate ? formatDate(summary.dueDate) : "Unknown"}
              </p>
            </div>
          </div>
        </SectionCard>

        <SectionCard eyebrow="Amounts" title="Receivable posture">
          <div className="space-y-2 text-[0.75rem] text-slate-600">
            <div className="flex items-center justify-between">
              <span>Status</span>
              <StatusPill label={titleize(summary.status)} />
            </div>
            <div className="flex items-center justify-between">
              <span>Total</span>
              <span className="font-semibold text-slate-900">
                {formatCurrency(summary.totalAmount)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Balance</span>
              {summary.balanceAmount === null ? (
                <StatusPill label="Pending BC ledger" />
              ) : (
                <span className="font-semibold text-slate-900">
                  {formatCurrency(summary.balanceAmount)}
                </span>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span>Amount source</span>
              <span className="font-semibold text-slate-900">
                {summary.amountSource === "rmi_lines"
                  ? "RMI lines"
                  : summary.amountSource === "header_payload"
                    ? "Header payload"
                    : "Metro invoice"}
              </span>
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-2 xl:grid-cols-2">
        <SectionCard eyebrow="Assets" title="Trailer attribution">
          <div className="divide-y divide-[var(--line)]">
            {detail.assets.length === 0 ? (
              <div className="py-1.5 text-[0.75rem] text-slate-400">
                No fixed-asset lines are attached to this invoice yet.
              </div>
            ) : (
              detail.assets.map((asset) => (
                <div key={asset.assetId} className="flex items-center justify-between py-1.5">
                  <div>
                    <WorkspaceLink
                      href={`/assets/${asset.assetId}`}
                      className="font-semibold text-[var(--brand)]"
                    >
                      {asset.assetNumber}
                    </WorkspaceLink>
                    <div className="text-[0.65rem] text-slate-400">
                      {titleize(asset.assetType)} / {asset.lineCount} lines
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-slate-900">
                      {formatCurrency(asset.grossAmount)}
                    </div>
                    <div className="text-[0.65rem] text-slate-400">
                      {asset.firstPeriod ? formatDate(asset.firstPeriod) : "Unknown"}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </SectionCard>

        <SectionCard eyebrow="Source" title="Line import and lineage">
          <div className="space-y-2 text-[0.75rem] text-slate-600">
            <div className="flex items-center justify-between">
              <span>Source</span>
              <span className="font-semibold text-slate-900">
                {detail.source === "business_central" ? "Business Central" : "Metro"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Document type</span>
              <span className="font-semibold text-slate-900">
                {summary.sourceDocumentType ?? "None"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Document no.</span>
              <span className="font-semibold text-slate-900">
                {summary.sourceDocumentNo ?? summary.invoiceNumber}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>BC line import</span>
              <StatusPill label={detail.lineImport.done ? "Complete" : "Running"} />
            </div>
          </div>
        </SectionCard>
      </div>

      <SectionCard eyebrow="Lines" title="Invoice lines">
        <div className="data-table">
          <table>
            <thead>
              <tr>
                <th>Line</th>
                <th>Asset/item</th>
                <th>Type</th>
                <th>Description</th>
                <th>Period</th>
                <th>Qty / price</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {detail.lines.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-slate-400">
                    No invoice lines have been imported for this document yet.
                  </td>
                </tr>
              ) : (
                detail.lines.map((line) => (
                  <tr key={line.id}>
                    <td>{line.lineNo ?? "-"}</td>
                    <td>
                      {line.assetId ? (
                        <WorkspaceLink href={`/assets/${line.assetId}`} className="font-semibold text-[var(--brand)]">
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
                    <td>
                      {line.quantity} x {formatCurrency(line.unitPrice)}
                    </td>
                    <td>
                      <span className="font-semibold text-slate-900">
                        {formatCurrency(line.grossAmount)}
                      </span>
                      {line.taxAmount || line.damageWaiverAmount ? (
                        <div className="text-[0.65rem] text-slate-400">
                          Tax {formatCurrency(line.taxAmount)} / DW{" "}
                          {formatCurrency(line.damageWaiverAmount)}
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard eyebrow="Audit" title="Raw source snapshot">
        <details className="rounded-md border border-[var(--line)] bg-[var(--surface-soft)] p-2">
          <summary className="cursor-pointer font-semibold text-slate-800">
            Source payload
          </summary>
          <pre className="mt-2 max-h-[28rem] overflow-auto text-[0.65rem] text-slate-600">
            {JSON.stringify(summary.rawPayload ?? {}, null, 2)}
          </pre>
        </details>
      </SectionCard>
    </div>
  );
}

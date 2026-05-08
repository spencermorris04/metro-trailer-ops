import { Suspense } from "react";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import { WorkspaceLink } from "@/components/workspace-link";
import { DetailPageSkeleton } from "@/components/workspace-skeletons";
import { formatCurrency, formatDate, titleize } from "@/lib/format";
import { getContractDetailView } from "@/lib/server/platform";

export const unstable_instant = { prefetch: "static" };

type ContractDetailPageProps = {
  params: Promise<{
    contractId: string;
  }>;
};

export default function ContractDetailPage({ params }: ContractDetailPageProps) {
  return (
    <Suspense fallback={<DetailPageSkeleton />}>
      <ContractDetailContent params={params} />
    </Suspense>
  );
}

async function ContractDetailContent({ params }: ContractDetailPageProps) {
  const { contractId } = await params;
  const detail = await getContractDetailView(contractId);

  if (!detail) {
    notFound();
  }

  const { summary } = detail;

  return (
    <div className="space-y-2">
      <PageHeader
        eyebrow="Commercial"
        title={summary.contractNumber}
        description="Contract detail with lines, assets, commercial events, invoices, BC source documents, and audit trail."
        actions={
          <>
            <WorkspaceLink href="/contracts" className="btn-secondary">
              Back to contracts
            </WorkspaceLink>
            <WorkspaceLink href="/source-documents" className="btn-secondary">
              Source documents
            </WorkspaceLink>
          </>
        }
      />

      <div className="grid gap-2 xl:grid-cols-3">
        <SectionCard eyebrow="Summary" title="Contract identity" className="xl:col-span-2">
          <div className="grid gap-3 md:grid-cols-4">
            <div>
              <p className="workspace-metric-label">Customer</p>
              <p className="text-sm font-semibold text-slate-900">{summary.customerName}</p>
            </div>
            <div>
              <p className="workspace-metric-label">Location</p>
              <p className="text-sm font-semibold text-slate-900">{summary.locationName}</p>
            </div>
            <div>
              <p className="workspace-metric-label">Branch</p>
              <p className="text-sm font-semibold text-slate-900">{summary.branch}</p>
            </div>
            <div>
              <p className="workspace-metric-label">Value</p>
              <p className="text-sm font-semibold text-slate-900">
                {formatCurrency(summary.value)}
              </p>
            </div>
          </div>
        </SectionCard>

        <SectionCard eyebrow="State" title="Commercial posture">
          <div className="space-y-2">
            <StatusPill label={titleize(summary.status)} />
            <StatusPill label={titleize(summary.commercialStage ?? summary.status)} />
            <div className="text-[0.75rem] text-slate-600">
              Invoices {summary.invoiceCount ?? 0}
            </div>
            <div className="text-[0.75rem] text-slate-600">
              Outstanding {formatCurrency(summary.outstandingBalance ?? 0)}
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-2 xl:grid-cols-2">
        <SectionCard eyebrow="Source" title="BC document lineage">
          <div className="space-y-2 text-[0.75rem] text-slate-600">
            <div>Provider: {titleize(summary.sourceProvider.replaceAll("_", " "))}</div>
            <div>Document type: {summary.sourceDocumentType ?? "None"}</div>
            <div>Document no.: {summary.sourceDocumentNo ?? "None"}</div>
            <div>Source status: {summary.sourceStatus ?? "None"}</div>
          </div>
        </SectionCard>

        <SectionCard eyebrow="Dates" title="Rental window">
          <div className="space-y-2 text-[0.75rem] text-slate-600">
            <div>Start: {formatDate(summary.startDate)}</div>
            <div>End: {summary.endDate ? formatDate(summary.endDate) : "Open"}</div>
            <div>Assets: {summary.assets.join(", ") || "No asset linkage"}</div>
          </div>
        </SectionCard>
      </div>

      <SectionCard eyebrow="Lines" title="Contract lines and allocations">
        <div className="data-table">
          <table>
            <thead>
              <tr>
                <th>Asset</th>
                <th>Description</th>
                <th>Term</th>
                <th>Pricing</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {detail.lines.map((line) => (
                <tr key={line.id}>
                  <td>{line.assetNumber ?? "Unassigned"}</td>
                  <td>{line.description ?? "No description"}</td>
                  <td>
                    {formatDate(line.startDate)}
                    <br />
                    <span className="text-[0.65rem] text-slate-400">
                      {line.endDate ? formatDate(line.endDate) : "Open"}
                    </span>
                  </td>
                  <td>
                    {formatCurrency(line.unitPrice)} x {line.quantity} {line.unit}
                    <br />
                    <span className="text-[0.65rem] text-slate-400">
                      Del {formatCurrency(line.deliveryFee)} / Pick {formatCurrency(line.pickupFee)}
                    </span>
                  </td>
                  <td className="text-[0.7rem] text-slate-500">
                    Line {line.sourceLineNo ?? "-"}
                    <br />
                    Item {line.sourceItemNo ?? "-"} / UOM {line.sourceUomCode ?? "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <div className="grid gap-2 xl:grid-cols-2">
        <SectionCard eyebrow="Commercial" title="Commercial events">
          <div className="divide-y divide-[var(--line)]">
            {detail.commercialEvents.map((event) => (
              <div key={event.id} className="flex items-center justify-between py-1.5">
                <div>
                  <div className="flex items-center gap-2">
                    <StatusPill label={titleize(event.eventType)} />
                    <span className="text-[0.75rem] text-slate-700">{event.description}</span>
                  </div>
                  <div className="text-[0.65rem] text-slate-400">
                    {formatDate(event.eventDate)}
                  </div>
                </div>
                <div className="font-semibold text-slate-900">
                  {formatCurrency(event.amount)}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard eyebrow="AR" title="Invoices">
          <div className="divide-y divide-[var(--line)]">
            {detail.invoices.map((invoice) => (
              <div key={invoice.id} className="flex items-center justify-between py-1.5">
                <div>
                  <div className="mono text-[0.65rem] text-slate-500">
                    {invoice.invoiceNumber}
                  </div>
                  <div className="text-[0.75rem] text-slate-700">
                    {titleize(invoice.status)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-slate-900">
                    {formatCurrency(invoice.balanceAmount)}
                  </div>
                  <div className="text-[0.65rem] text-slate-400">
                    Due {formatDate(invoice.dueDate)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <SectionCard eyebrow="BC Source" title="Imported source document">
        {detail.sourceDocument ? (
          <div className="space-y-3">
            <div className="grid gap-3 md:grid-cols-4">
              <div>
                <p className="workspace-metric-label">Document</p>
                <p className="text-sm font-semibold text-slate-900">
                  {detail.sourceDocument.documentNo}
                </p>
              </div>
              <div>
                <p className="workspace-metric-label">Type</p>
                <p className="text-sm font-semibold text-slate-900">
                  {detail.sourceDocument.documentType}
                </p>
              </div>
              <div>
                <p className="workspace-metric-label">Date</p>
                <p className="text-sm font-semibold text-slate-900">
                  {detail.sourceDocument.documentDate
                    ? formatDate(detail.sourceDocument.documentDate)
                    : "Unknown"}
                </p>
              </div>
              <div>
                <p className="workspace-metric-label">Customer</p>
                <p className="text-sm font-semibold text-slate-900">
                  {detail.sourceDocument.customerName ?? "Unknown"}
                </p>
              </div>
            </div>
            <div className="data-table">
              <table>
                <thead>
                  <tr>
                    <th>Line</th>
                    <th>Description</th>
                    <th>Qty</th>
                    <th>Unit price</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.sourceDocumentLines.map((line) => (
                    <tr key={line.id}>
                      <td>{line.lineNo}</td>
                      <td>{line.description ?? line.itemNo ?? "No description"}</td>
                      <td>{line.quantity}</td>
                      <td>{formatCurrency(line.unitPrice)}</td>
                      <td>{formatCurrency(line.lineAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="text-[0.75rem] text-slate-400">
            No BC source document is linked to this contract.
          </div>
        )}
      </SectionCard>

      <SectionCard eyebrow="Audit" title="Recent activity">
        <div className="divide-y divide-[var(--line)]">
          {detail.auditTrail.map((row) => (
            <div key={row.id} className="flex items-center justify-between py-1.5">
              <div className="text-[0.75rem] text-slate-700">{row.eventType}</div>
              <div className="text-[0.65rem] text-slate-400">
                {formatDate(row.createdAt)}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

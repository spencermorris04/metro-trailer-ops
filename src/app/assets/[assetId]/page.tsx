import { Suspense } from "react";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import { WorkspaceLink } from "@/components/workspace-link";
import { DetailPageSkeleton } from "@/components/workspace-skeletons";
import { formatCurrency, formatDate, titleize } from "@/lib/format";
import { getAssetDetailView, getAssetRentalDetailView } from "@/lib/server/platform";

export const unstable_instant = { prefetch: "static" };

type AssetDetailPageProps = {
  params: Promise<{
    assetId: string;
  }>;
};

export default function AssetDetailPage({ params }: AssetDetailPageProps) {
  return (
    <Suspense fallback={<DetailPageSkeleton />}>
      <AssetDetailContent params={params} />
    </Suspense>
  );
}

async function AssetDetailContent({ params }: AssetDetailPageProps) {
  const { assetId } = await params;
  const [detail, rentalHistory] = await Promise.all([
    getAssetDetailView(assetId),
    getAssetRentalDetailView(assetId),
  ]);

  if (!detail) {
    notFound();
  }

  const { summary } = detail;

  return (
    <div className="space-y-2">
      <PageHeader
        eyebrow="Operations"
        title={summary.assetNumber}
        description="Asset detail with operational ownership, contract history, inspections, work orders, and BC lineage."
        actions={
          <>
            <WorkspaceLink href="/equipment" className="btn-secondary">
              Back to equipment
            </WorkspaceLink>
            <WorkspaceLink href="/equipment" className="btn-secondary">
              Equipment
            </WorkspaceLink>
            <WorkspaceLink href="/leases" className="btn-secondary">
              Leases
            </WorkspaceLink>
          </>
        }
      />

      <div className="grid gap-2 xl:grid-cols-3">
        <SectionCard eyebrow="Summary" title="Master identity" className="xl:col-span-2">
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <p className="workspace-metric-label">Classification</p>
              <p className="text-sm font-semibold text-slate-900">
                {titleize(summary.type)}
              </p>
              <p className="text-[0.7rem] text-slate-400">
                {(summary.subtype ?? "-") + " / " + (summary.faClassCode ?? "-")}
              </p>
            </div>
            <div>
              <p className="workspace-metric-label">Physical identity</p>
              <p className="text-sm font-semibold text-slate-900">
                {summary.manufacturer ?? "Unknown mfg."}
              </p>
              <p className="text-[0.7rem] text-slate-400">
                SN {summary.serialNumber ?? "-"} / Reg {summary.registrationNumber ?? "-"}
              </p>
            </div>
            <div>
              <p className="workspace-metric-label">Branch / location</p>
              <p className="text-sm font-semibold text-slate-900">{summary.branch}</p>
              <p className="text-[0.7rem] text-slate-400">
                {summary.branchCode} / {summary.bcLocationCode ?? "No BC location"}
              </p>
            </div>
          </div>
        </SectionCard>

        <SectionCard eyebrow="Lifecycle" title="Current state">
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1">
              <StatusPill label={titleize(summary.status)} />
              <StatusPill label={titleize(summary.availability)} />
              <StatusPill label={titleize(summary.maintenanceStatus)} />
            </div>
            <div className="text-[0.75rem] text-slate-600">
              <div>Blocked: {summary.isBlocked ? "Yes" : "No"}</div>
              <div>Inactive: {summary.isInactive ? "Yes" : "No"}</div>
              <div>Disposed: {summary.isDisposed ? "Yes" : "No"}</div>
              <div>On rent: {summary.isOnRent ? "Yes" : "No"}</div>
              <div>In service: {summary.isInService ? "Yes" : "No"}</div>
              <div>Under maintenance: {summary.underMaintenance ? "Yes" : "No"}</div>
            </div>
            <div className="text-[0.75rem] font-semibold text-slate-900">
              Book value {formatCurrency(summary.bookValue ?? 0)}
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-2 xl:grid-cols-2">
        <SectionCard eyebrow="Operational" title="Current placement and ownership">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <p className="workspace-metric-label">Custody location</p>
              <p className="text-sm text-slate-800">{summary.custodyLocation ?? summary.branch}</p>
            </div>
            <div>
              <p className="workspace-metric-label">Blocking reason</p>
              <p className="text-sm text-slate-800">{summary.blockingReason ?? "None"}</p>
            </div>
            <div>
              <p className="workspace-metric-label">Active contract</p>
              <p className="text-sm text-slate-800">{summary.activeContractNumber ?? "None"}</p>
            </div>
            <div>
              <p className="workspace-metric-label">Current customer</p>
              <p className="text-sm text-slate-800">{summary.activeCustomerName ?? "Unassigned"}</p>
            </div>
          </div>
        </SectionCard>

        <SectionCard eyebrow="BC Lineage" title="Imported source context">
          <div className="space-y-2 text-[0.75rem] text-slate-600">
            <div>Source provider: {titleize(summary.sourceProvider.replaceAll("_", " "))}</div>
            <div>External BC id: {summary.externalId ?? "None"}</div>
            <div>Dimension 1: {summary.bcDimension1Code ?? "None"}</div>
            <div>Product / service: {summary.bcProductNo ?? "-"} / {summary.bcServiceItemNo ?? "-"}</div>
            <div>Last source update: {summary.sourceUpdatedAt ? formatDate(summary.sourceUpdatedAt) : "Unknown"}</div>
            <details className="rounded-md border border-[var(--line)] bg-[var(--surface-soft)] p-2">
              <summary className="cursor-pointer font-semibold text-slate-800">
                Raw BC payload
              </summary>
              <pre className="mt-2 overflow-x-auto text-[0.65rem] text-slate-600">
                {JSON.stringify(summary.sourcePayload ?? {}, null, 2)}
              </pre>
            </details>
          </div>
        </SectionCard>
      </div>

      {rentalHistory ? (
        <>
          <div className="grid grid-cols-4 gap-px border border-[var(--line)] bg-[var(--line)]">
            {[
              ["BC invoice lines", rentalHistory.summary.invoiceLineCount],
              ["BC invoices", rentalHistory.summary.invoiceCount],
              ["BC leases", rentalHistory.summary.leaseCount],
              ["BC revenue", formatCurrency(rentalHistory.summary.grossAmount)],
            ].map(([label, value]) => (
              <div key={label} className="bg-white px-3 py-2">
                <p className="workspace-metric-label">{label}</p>
                <p className="text-base font-semibold text-slate-900">
                  {typeof value === "number" ? value : value}
                </p>
              </div>
            ))}
          </div>

          <div className="grid gap-2 xl:grid-cols-2">
            <SectionCard
              eyebrow="BC/RMI"
              title="Imported invoice history"
              description="Posted invoice lines matched by Fixed Asset item number."
            >
              <div className="data-table">
                <table>
                  <thead>
                    <tr>
                      <th>Invoice</th>
                      <th>Lease</th>
                      <th>Customer</th>
                      <th>Period</th>
                      <th>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rentalHistory.recentLines.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-slate-400">
                          No imported BC invoice lines are attached to this asset yet.
                        </td>
                      </tr>
                    ) : (
                      rentalHistory.recentLines.slice(0, 12).map((line) => (
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
                            {line.leaseKey ? (
                              <WorkspaceLink
                                href={`/leases/${line.leaseKey}`}
                                className="text-[var(--brand)]"
                              >
                                {line.leaseKey}
                              </WorkspaceLink>
                            ) : (
                              "Unassigned"
                            )}
                          </td>
                          <td>
                            {line.customerName ?? line.customerNumber ?? "Unknown"}
                          </td>
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

            <SectionCard
              eyebrow="Revenue"
              title="Recent revenue by month"
              description="Summed from imported RMI posted rental lines."
            >
              <div className="divide-y divide-[var(--line)]">
                {rentalHistory.revenueByMonth.slice(0, 12).map((row) => (
                  <div key={row.month} className="flex items-center justify-between py-1.5">
                    <div>
                      <div className="font-semibold text-slate-900">
                        {row.month ? formatDate(row.month) : "Unknown"}
                      </div>
                      <div className="text-[0.65rem] text-slate-400">
                        {row.invoiceCount} invoices / {row.lineCount} lines
                      </div>
                    </div>
                    <div className="font-semibold text-slate-900">
                      {formatCurrency(row.grossAmount)}
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>

          <SectionCard eyebrow="Leases" title="Imported BC/RMI leases for this asset">
            <div className="data-table">
              <table>
                <thead>
                  <tr>
                    <th>Lease</th>
                    <th>Customer</th>
                    <th>Invoices</th>
                    <th>Period</th>
                    <th>Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {rentalHistory.leases.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-slate-400">
                        No imported lease/order history is attached to this asset yet.
                      </td>
                    </tr>
                  ) : (
                    rentalHistory.leases.map((lease) => (
                      <tr key={lease.leaseKey}>
                        <td>
                          <WorkspaceLink
                            href={`/leases/${lease.leaseKey}`}
                            className="font-semibold text-[var(--brand)]"
                          >
                            {lease.leaseKey}
                          </WorkspaceLink>
                        </td>
                        <td>{lease.customerName ?? lease.customerNumber ?? "Unknown"}</td>
                        <td>{lease.invoiceCount}</td>
                        <td>
                          {lease.firstPeriod ? formatDate(lease.firstPeriod) : "Unknown"}
                          <br />
                          <span className="text-[0.65rem] text-slate-400">
                            {lease.lastPeriod ? formatDate(lease.lastPeriod) : "Open"}
                          </span>
                        </td>
                        <td className="font-semibold text-slate-900">
                          {formatCurrency(lease.grossAmount)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </>
      ) : null}

      <SectionCard eyebrow="History" title="Contract history">
        <div className="data-table">
          <table>
            <thead>
              <tr>
                <th>Contract</th>
                <th>Customer</th>
                <th>Status</th>
                <th>Dates</th>
              </tr>
            </thead>
            <tbody>
              {detail.contractHistory.map((contract) => (
                <tr key={contract.contractId}>
                  <td>
                    <WorkspaceLink href={`/leases/${contract.contractId}`} className="font-semibold text-[var(--brand)]">
                      {contract.contractNumber}
                    </WorkspaceLink>
                  </td>
                  <td>{contract.customerName}</td>
                  <td><StatusPill label={titleize(contract.status)} /></td>
                  <td>
                    {contract.startDate ? formatDate(contract.startDate) : "No start date"}
                    <br />
                    <span className="text-[0.65rem] text-slate-400">
                      {contract.endDate ? formatDate(contract.endDate) : "Open"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <div className="grid gap-2 xl:grid-cols-2">
        <SectionCard eyebrow="Inspections" title="Inspection history">
          <div className="divide-y divide-[var(--line)]">
            {detail.inspections.map((inspection) => (
              <div key={inspection.id} className="flex items-center justify-between py-1.5">
                <div>
                  <div className="flex items-center gap-2">
                    <StatusPill label={titleize(inspection.inspectionType)} />
                    <StatusPill label={titleize(inspection.status)} />
                  </div>
                  <div className="text-[0.75rem] text-slate-700">
                    {inspection.resultSummary ?? "No summary"}
                  </div>
                </div>
                <div className="text-right text-[0.65rem] text-slate-400">
                  <div>{inspection.completedAt ? formatDate(inspection.completedAt) : "Not completed"}</div>
                  <div>Damage {inspection.damageScore ?? "-"}</div>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard eyebrow="Maintenance" title="Work orders">
          <div className="divide-y divide-[var(--line)]">
            {detail.workOrders.map((workOrder) => (
              <div key={workOrder.id} className="flex items-center justify-between py-1.5">
                <div>
                  <div className="text-[0.8rem] font-semibold text-slate-900">
                    {workOrder.title}
                  </div>
                  <div className="text-[0.65rem] text-slate-400">
                    {workOrder.priority ? titleize(workOrder.priority) : "No priority"} / {workOrder.billableDisposition ?? "No disposition"}
                  </div>
                </div>
                <div className="text-right">
                  <StatusPill label={titleize(workOrder.status)} />
                  <div className="mt-1 text-[0.65rem] text-slate-400">
                    {workOrder.dueAt ? formatDate(workOrder.dueAt) : "No due date"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

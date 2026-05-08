import { Suspense } from "react";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import { WorkspaceLink } from "@/components/workspace-link";
import { DetailPageSkeleton } from "@/components/workspace-skeletons";
import { formatCurrency, formatDate, titleize } from "@/lib/format";
import { getAssetDetailView } from "@/lib/server/platform";

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
  const detail = await getAssetDetailView(assetId);

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
            <WorkspaceLink href="/assets" className="btn-secondary">
              Back to assets
            </WorkspaceLink>
            <WorkspaceLink href="/contracts" className="btn-secondary">
              Contracts
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
                    <WorkspaceLink href={`/contracts/${contract.contractId}`} className="font-semibold text-[var(--brand)]">
                      {contract.contractNumber}
                    </WorkspaceLink>
                  </td>
                  <td>{contract.customerName}</td>
                  <td><StatusPill label={titleize(contract.status)} /></td>
                  <td>
                    {formatDate(contract.startDate)}
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
                  <div>{formatDate(inspection.completedAt)}</div>
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
                    {titleize(workOrder.priority)} / {workOrder.billableDisposition ?? "No disposition"}
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

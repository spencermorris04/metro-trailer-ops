import { Suspense } from "react";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import { WorkspaceLink } from "@/components/workspace-link";
import { DetailPageSkeleton } from "@/components/workspace-skeletons";
import { formatCurrency, formatDate, titleize } from "@/lib/format";
import {
  getCustomerArLedgerView,
  getCustomerDetailView,
  getCustomerRevenueDetailView,
} from "@/lib/server/platform";

export const unstable_instant = { prefetch: "static" };

type CustomerDetailPageProps = {
  params: Promise<{
    customerId: string;
  }>;
};

export default function CustomerDetailPage({ params }: CustomerDetailPageProps) {
  return (
    <Suspense fallback={<DetailPageSkeleton />}>
      <CustomerDetailContent params={params} />
    </Suspense>
  );
}

async function CustomerDetailContent({ params }: CustomerDetailPageProps) {
  const { customerId } = await params;
  const [detail, revenue, arLedger] = await Promise.all([
    getCustomerDetailView(customerId),
    getCustomerRevenueDetailView(customerId),
    getCustomerArLedgerView(customerId),
  ]);

  if (!detail) {
    notFound();
  }

  const { summary } = detail;

  return (
    <div className="space-y-2">
      <PageHeader
        eyebrow="Operations"
        title={summary.name}
        description="Customer summary with sites, contracts, invoices, receipts, and BC lineage."
        actions={
          <>
            <WorkspaceLink href="/customers" className="btn-secondary">
              Back to customers
            </WorkspaceLink>
            <WorkspaceLink href="/ar/invoices" className="btn-secondary">
              AR invoices
            </WorkspaceLink>
          </>
        }
      />

      <div className="grid gap-2 xl:grid-cols-3">
        <SectionCard eyebrow="Summary" title="Account identity" className="xl:col-span-2">
          <div className="grid gap-3 md:grid-cols-4">
            <div>
              <p className="workspace-metric-label">Customer number</p>
              <p className="text-sm font-semibold text-slate-900">{summary.customerNumber}</p>
            </div>
            <div>
              <p className="workspace-metric-label">Type</p>
              <p className="text-sm font-semibold text-slate-900">
                {titleize(summary.customerType)}
              </p>
            </div>
            <div>
              <p className="workspace-metric-label">Billing city</p>
              <p className="text-sm font-semibold text-slate-900">{summary.billingCity}</p>
            </div>
            <div>
              <p className="workspace-metric-label">Portal</p>
              <StatusPill label={summary.portalEnabled ? "Enabled" : "Disabled"} />
            </div>
          </div>
        </SectionCard>

        <SectionCard eyebrow="Commercial" title="Current exposure">
          <div className="space-y-2">
            <div>
              <p className="workspace-metric-label">Contracts</p>
              <p className="text-lg font-semibold text-slate-900">
                {revenue?.summary.leaseCount ?? summary.contractCount}
              </p>
            </div>
            <div>
              <p className="workspace-metric-label">AR balance</p>
              <p className="text-lg font-semibold text-slate-900">
                {formatCurrency(summary.arBalance)}
              </p>
            </div>
            <div>
              <p className="workspace-metric-label">BC revenue</p>
              <p className="text-lg font-semibold text-slate-900">
                {formatCurrency(revenue?.summary.grossAmount ?? 0)}
              </p>
            </div>
            <div className="text-[0.75rem] text-slate-500">
              Source: {titleize(summary.sourceProvider.replaceAll("_", " "))}
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-2 xl:grid-cols-2">
        <SectionCard eyebrow="Locations" title="Customer locations">
          <div className="divide-y divide-[var(--line)]">
            {summary.locations.map((location) => (
              <div key={location.id} className="py-1.5">
                <div className="text-[0.8rem] font-semibold text-slate-900">{location.name}</div>
                <div className="text-[0.75rem] text-slate-600">{location.address}</div>
                <div className="text-[0.65rem] text-slate-400">
                  {location.contactPerson || "No contact person"}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard eyebrow="Lineage" title="BC source context">
          <div className="space-y-2 text-[0.75rem] text-slate-600">
            <div>Source provider: {titleize(summary.sourceProvider.replaceAll("_", " "))}</div>
            <div>External BC id: {summary.externalId ?? "None"}</div>
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

      <SectionCard eyebrow="Contracts" title="Commercial history">
        <div className="data-table">
          <table>
            <thead>
              <tr>
                <th>Contract</th>
                <th>Branch</th>
                <th>Dates</th>
                <th>Status</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              {detail.contracts.map((contract) => (
                <tr key={contract.id}>
                  <td>
                    <WorkspaceLink href={`/leases/${contract.id}`} className="font-semibold text-[var(--brand)]">
                      {contract.contractNumber}
                    </WorkspaceLink>
                  </td>
                  <td>{contract.branch}</td>
                  <td>
                    {formatDate(contract.startDate)}
                    <br />
                    <span className="text-[0.65rem] text-slate-400">
                      {contract.endDate ? formatDate(contract.endDate) : "Open"}
                    </span>
                  </td>
                  <td><StatusPill label={titleize(contract.status)} /></td>
                  <td>{formatCurrency(contract.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {revenue ? (
        <>
          <div className="grid grid-cols-4 gap-px border border-[var(--line)] bg-[var(--line)]">
            {[
              ["BC invoices", revenue.summary.invoiceCount],
              ["BC leases", revenue.summary.leaseCount],
              ["Equipment", revenue.summary.equipmentCount],
              ["Gross billed", formatCurrency(revenue.summary.grossAmount)],
            ].map(([label, value]) => (
              <div key={label} className="bg-white px-3 py-2">
                <p className="workspace-metric-label">{label}</p>
                <p className="text-base font-semibold text-slate-900">{value}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-2 xl:grid-cols-2">
            <SectionCard eyebrow="Equipment" title="Trailer and equipment history">
              <div className="divide-y divide-[var(--line)]">
                {revenue.equipment.slice(0, 16).map((asset) => (
                  <div key={asset.assetNumber} className="flex items-center justify-between py-1.5">
                    <div>
                      {asset.assetId ? (
                        <WorkspaceLink
                          href={`/equipment/${asset.assetId}`}
                          className="font-semibold text-[var(--brand)]"
                        >
                          {asset.assetNumber}
                        </WorkspaceLink>
                      ) : (
                        <span className="font-semibold text-slate-900">{asset.assetNumber}</span>
                      )}
                      <div className="text-[0.65rem] text-slate-400">
                        {asset.invoiceCount} invoices / {asset.lineCount} lines
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-slate-900">
                        {formatCurrency(asset.grossAmount)}
                      </div>
                      <div className="text-[0.65rem] text-slate-400">
                        {asset.latestInvoiceDate ? formatDate(asset.latestInvoiceDate) : "No date"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>

            <SectionCard eyebrow="Revenue" title="Revenue by branch">
              <div className="divide-y divide-[var(--line)]">
                {revenue.revenueByBranch.map((row) => (
                  <div key={row.branchCode} className="flex items-center justify-between py-1.5">
                    <div>
                      <div className="font-semibold text-slate-900">{row.branchCode}</div>
                      <div className="text-[0.65rem] text-slate-400">
                        {row.lineCount} rental lines
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

          <SectionCard eyebrow="Leases" title="BC/RMI rental orders">
            <div className="data-table">
              <table>
                <thead>
                  <tr>
                    <th>Lease/order</th>
                    <th>Invoices</th>
                    <th>Equipment</th>
                    <th>Dates</th>
                    <th>Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {revenue.leases.slice(0, 30).map((lease) => (
                    <tr key={lease.leaseKey}>
                      <td>
                        <WorkspaceLink
                          href={`/leases/${lease.leaseKey}`}
                          className="font-semibold text-[var(--brand)]"
                        >
                          {lease.leaseKey}
                        </WorkspaceLink>
                      </td>
                      <td>{lease.invoiceCount}</td>
                      <td>{lease.equipmentCount}</td>
                      <td>
                        {lease.firstInvoiceDate ? formatDate(lease.firstInvoiceDate) : "Unknown"}
                        <br />
                        <span className="text-[0.65rem] text-slate-400">
                          {lease.latestInvoiceDate ? formatDate(lease.latestInvoiceDate) : "Open"}
                        </span>
                      </td>
                      <td className="font-semibold text-slate-900">
                        {formatCurrency(lease.grossAmount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </>
      ) : null}

      <div className="grid gap-2 xl:grid-cols-2">
        <SectionCard eyebrow="Invoices" title="AR invoices">
          <div className="divide-y divide-[var(--line)]">
            {detail.invoices.map((invoice) => (
              <div key={invoice.id} className="flex items-center justify-between py-1.5">
                <div>
                  <div className="mono text-[0.65rem] text-slate-500">
                    {invoice.invoiceNumber}
                  </div>
                  <div className="text-[0.75rem] text-slate-700">
                    {invoice.contractNumber}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-slate-900">
                    {formatCurrency(invoice.balanceAmount)}
                  </div>
                  <div className="text-[0.65rem] text-slate-400">
                    {titleize(invoice.status)} / {formatDate(invoice.dueDate)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard eyebrow="AR Ledger" title="Customer ledger activity">
          <div className="divide-y divide-[var(--line)]">
            {arLedger.slice(0, 20).map((entry) => (
              <div key={entry.id} className="flex items-center justify-between py-1.5">
                <div>
                  <div className="mono text-[0.65rem] text-slate-500">
                    {entry.documentNo ?? entry.entryNo}
                  </div>
                  <div className="text-[0.75rem] text-slate-700">
                    {entry.description ?? entry.documentType ?? "Customer ledger entry"}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-slate-900">
                    {formatCurrency(entry.amount)}
                  </div>
                  <div className="text-[0.65rem] text-slate-400">
                    Remaining {formatCurrency(entry.remainingAmount)}
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

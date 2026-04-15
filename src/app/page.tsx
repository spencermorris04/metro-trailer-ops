import { headers } from "next/headers";
import Link from "next/link";

import { StatusPill } from "@/components/status-pill";
import { WorkspacePanels } from "@/components/workspace-panels";
import { formatCompactNumber, formatCurrency, formatDate, titleize } from "@/lib/format";
import {
  getDashboardSummary,
  getFinancialOverview,
  getInventoryOverview,
  listCustomers,
} from "@/lib/server/platform";
import { getWorkspaceLayout } from "@/lib/server/workspace-layouts";

export const dynamic = "force-dynamic";

const defaultLayout = {
  left: 312,
  right: 352,
};

export default async function HomePage() {
  const requestHeaders = new Headers(await headers());
  const [workspace, summary, inventory, financial, customers] = await Promise.all([
    getWorkspaceLayout(requestHeaders, "home", defaultLayout),
    getDashboardSummary(),
    getInventoryOverview(),
    getFinancialOverview(),
    listCustomers(),
  ]);

  const topCustomers = [...customers]
    .sort((left, right) => {
      if (right.locations.length !== left.locations.length) {
        return right.locations.length - left.locations.length;
      }
      if (right.branchCoverage.length !== left.branchCoverage.length) {
        return right.branchCoverage.length - left.branchCoverage.length;
      }
      return left.name.localeCompare(right.name);
    })
    .slice(0, 8);

  const portalPending = customers.filter((customer) => !customer.portalEnabled).length;
  const multiBranchCustomers = customers.filter(
    (customer) => customer.branchCoverage.length > 1,
  ).length;

  const summaryCards = [
    { label: "Assets", value: summary.assets, note: "Tracked fleet units" },
    { label: "Customers", value: summary.customers, note: "Billing accounts" },
    { label: "Active contracts", value: summary.activeContracts, note: "Revenue-bearing rentals" },
    { label: "Overdue invoices", value: summary.overdueInvoices, note: "Collections pressure" },
  ];

  return (
    <WorkspacePanels
      pageKey="home"
      initialLayout={workspace.layout as typeof defaultLayout}
      left={
        <div className="space-y-4">
          <section className="panel overflow-hidden">
            <div className="border-b border-[var(--line)] px-5 py-4">
              <p className="workspace-section-label">System load</p>
              <h1 className="mt-1 text-xl font-semibold text-slate-950">
                Operations desktop
              </h1>
            </div>
            <div className="grid gap-px bg-[var(--line)]">
              {summaryCards.map((card) => (
                <div key={card.label} className="bg-white px-5 py-4">
                  <p className="workspace-metric-label">{card.label}</p>
                  <p className="mt-2 text-3xl font-semibold text-slate-950">
                    {formatCompactNumber(card.value)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">{card.note}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="panel overflow-hidden">
            <div className="border-b border-[var(--line)] px-5 py-4">
              <p className="workspace-section-label">Execution queues</p>
            </div>
            <div className="divide-y divide-[var(--line)]">
              <div className="workspace-list-row">
                <span>Dispatch open</span>
                <strong>{formatCompactNumber(inventory.activityCounts.dispatchOpen)}</strong>
              </div>
              <div className="workspace-list-row">
                <span>Inspection open</span>
                <strong>{formatCompactNumber(inventory.activityCounts.inspectionOpen)}</strong>
              </div>
              <div className="workspace-list-row">
                <span>Maintenance open</span>
                <strong>{formatCompactNumber(inventory.activityCounts.maintenanceOpen)}</strong>
              </div>
              <div className="workspace-list-row">
                <span>Telematics blind</span>
                <strong>{formatCompactNumber(inventory.activityCounts.telematicsBlind)}</strong>
              </div>
            </div>
          </section>

          <section className="panel overflow-hidden">
            <div className="border-b border-[var(--line)] px-5 py-4">
              <p className="workspace-section-label">Branch pressure</p>
            </div>
            <div className="divide-y divide-[var(--line)]">
              {inventory.branchPressure.slice(0, 6).map((branch) => (
                <div key={branch.branch} className="px-5 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{branch.branch}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Ready {branch.available} / Blocked {branch.blocked}
                      </p>
                    </div>
                    <StatusPill label={`${Math.round(branch.readyRate * 100)}% ready`} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      }
      center={
        <div className="space-y-4">
          <section className="panel overflow-hidden">
            <div className="border-b border-[var(--line)] px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="workspace-section-label">Live workboard</p>
                  <h2 className="mt-1 text-2xl font-semibold text-slate-950">
                    Fleet, finance, and customer pressure
                  </h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link href="/assets" className="btn-secondary">
                    Inventory
                  </Link>
                  <Link href="/dispatch" className="btn-secondary">
                    Dispatch
                  </Link>
                  <Link href="/financial" className="btn-secondary">
                    Financials
                  </Link>
                </div>
              </div>
            </div>
            <div className="grid gap-px bg-[var(--line)] lg:grid-cols-4">
              <div className="bg-white px-5 py-4">
                <p className="workspace-metric-label">Rent ready</p>
                <p className="mt-2 text-3xl font-semibold text-slate-950">
                  {formatCompactNumber(inventory.summary.rentReadyCount)}
                </p>
              </div>
              <div className="bg-white px-5 py-4">
                <p className="workspace-metric-label">Branch blocked</p>
                <p className="mt-2 text-3xl font-semibold text-slate-950">
                  {formatCompactNumber(inventory.summary.branchBlockedCount)}
                </p>
              </div>
              <div className="bg-white px-5 py-4">
                <p className="workspace-metric-label">Outstanding balance</p>
                <p className="mt-2 text-3xl font-semibold text-slate-950">
                  {formatCurrency(financial.metrics.outstandingBalance)}
                </p>
              </div>
              <div className="bg-white px-5 py-4">
                <p className="workspace-metric-label">Uninvoiced rent</p>
                <p className="mt-2 text-3xl font-semibold text-slate-950">
                  {formatCurrency(financial.metrics.uninvoicedEventAmount)}
                </p>
              </div>
            </div>
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            {inventory.actionLanes.slice(0, 4).map((lane) => (
              <div key={lane.key} className="panel overflow-hidden">
                <div className="border-b border-[var(--line)] px-5 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="workspace-section-label">{lane.title}</p>
                      <p className="mt-1 text-2xl font-semibold text-slate-950">
                        {formatCompactNumber(lane.count)}
                      </p>
                    </div>
                    <Link href={lane.href} className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--brand)]">
                      Open
                    </Link>
                  </div>
                </div>
                <div className="divide-y divide-[var(--line)]">
                  {lane.assets.length === 0 ? (
                    <div className="px-5 py-6 text-sm text-slate-500">Queue clear.</div>
                  ) : (
                    lane.assets.slice(0, 6).map((asset) => (
                      <div key={asset.id} className="px-5 py-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="mono text-sm font-semibold text-slate-950">
                              {asset.assetNumber}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {asset.branch} / {titleize(asset.type)}
                            </p>
                          </div>
                          <StatusPill label={titleize(asset.status)} />
                        </div>
                        <p className="mt-2 text-sm text-slate-600">
                          {asset.blockingReason ?? asset.custodyLocation ?? "Operator review"}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </section>

          <section className="panel overflow-hidden">
            <div className="border-b border-[var(--line)] px-5 py-4">
              <p className="workspace-section-label">Finance queues</p>
            </div>
            <div className="grid gap-px bg-[var(--line)] xl:grid-cols-2">
              <div className="bg-white">
                <div className="border-b border-[var(--line)] px-5 py-3">
                  <p className="text-sm font-medium text-slate-900">Awaiting signature</p>
                </div>
                <div className="divide-y divide-[var(--line)]">
                  {financial.queues.awaitingSignature.slice(0, 5).map((contract) => (
                    <div key={contract.id} className="px-5 py-3">
                      <p className="mono text-xs text-slate-500">{contract.contractNumber}</p>
                      <p className="mt-1 text-sm font-medium text-slate-900">{contract.customerName}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-white">
                <div className="border-b border-[var(--line)] px-5 py-3">
                  <p className="text-sm font-medium text-slate-900">Open receivables</p>
                </div>
                <div className="divide-y divide-[var(--line)]">
                  {financial.queues.openReceivables.slice(0, 5).map((contract) => (
                    <div key={contract.id} className="px-5 py-3">
                      <p className="mono text-xs text-slate-500">{contract.contractNumber}</p>
                      <p className="mt-1 text-sm font-medium text-slate-900">{contract.customerName}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Balance {formatCurrency(contract.outstandingBalance ?? 0)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>
      }
      right={
        <div className="space-y-4">
          <section className="panel overflow-hidden">
            <div className="border-b border-[var(--line)] px-5 py-4">
              <p className="workspace-section-label">Customer footprint</p>
            </div>
            <div className="grid gap-px bg-[var(--line)]">
              <div className="bg-white px-5 py-4">
                <p className="workspace-metric-label">Multi-branch accounts</p>
                <p className="mt-2 text-3xl font-semibold text-slate-950">
                  {formatCompactNumber(multiBranchCustomers)}
                </p>
              </div>
              <div className="bg-white px-5 py-4">
                <p className="workspace-metric-label">Portal pending</p>
                <p className="mt-2 text-3xl font-semibold text-slate-950">
                  {formatCompactNumber(portalPending)}
                </p>
              </div>
            </div>
          </section>

          <section className="panel overflow-hidden">
            <div className="border-b border-[var(--line)] px-5 py-4">
              <p className="workspace-section-label">Largest customer footprints</p>
            </div>
            <div className="divide-y divide-[var(--line)]">
              {topCustomers.map((customer) => (
                <div key={customer.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="mono text-xs text-slate-500">{customer.customerNumber}</p>
                      <p className="mt-1 text-sm font-medium text-slate-900">{customer.name}</p>
                    </div>
                    <StatusPill label={titleize(customer.customerType)} />
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    {customer.locations.length} sites / {customer.branchCoverage.length} branches
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="panel overflow-hidden">
            <div className="border-b border-[var(--line)] px-5 py-4">
              <p className="workspace-section-label">Recent invoice pressure</p>
            </div>
            <div className="divide-y divide-[var(--line)]">
              {financial.invoices.slice(0, 6).map((invoice) => (
                <div key={invoice.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="mono text-xs text-slate-500">{invoice.invoiceNumber}</p>
                      <p className="mt-1 text-sm font-medium text-slate-900">
                        {invoice.customerName}
                      </p>
                    </div>
                    <StatusPill label={titleize(invoice.status)} />
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    Due {formatDate(invoice.dueDate)} / Balance {formatCurrency(invoice.balanceAmount)}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>
      }
    />
  );
}

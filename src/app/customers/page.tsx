import { headers } from "next/headers";
import Link from "next/link";

import { StatusPill } from "@/components/status-pill";
import { WorkspacePanels } from "@/components/workspace-panels";
import { formatCompactNumber, titleize } from "@/lib/format";
import { listCustomers } from "@/lib/server/platform";
import { getWorkspaceLayout } from "@/lib/server/workspace-layouts";

export const dynamic = "force-dynamic";

const defaultLayout = {
  left: 292,
  right: 344,
};

type CustomersPageProps = {
  searchParams: Promise<{
    q?: string | string[];
    customerType?: string | string[];
    portalEnabled?: string | string[];
    page?: string | string[];
  }>;
};

function getParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function buildCustomerHref(
  current: Record<string, string | undefined>,
  overrides: Record<string, string | undefined>,
) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...current, ...overrides })) {
    if (value) {
      params.set(key, value);
    }
  }
  const query = params.toString();
  return query ? `/customers?${query}` : "/customers";
}

export default async function CustomersPage({ searchParams }: CustomersPageProps) {
  const requestHeaders = new Headers(await headers());
  const resolved = await searchParams;
  const filters = {
    q: getParam(resolved.q),
    customerType: getParam(resolved.customerType),
    portalEnabled: getParam(resolved.portalEnabled),
  };
  const page = Math.max(1, Number(getParam(resolved.page) ?? "1"));
  const pageSize = 30;

  const [workspace, customers] = await Promise.all([
    getWorkspaceLayout(requestHeaders, "customers", defaultLayout),
    listCustomers(filters),
  ]);

  const totalPages = Math.max(1, Math.ceil(customers.length / pageSize));
  const pageCustomers = customers.slice((page - 1) * pageSize, page * pageSize);
  const portalEnabledCount = customers.filter((customer) => customer.portalEnabled).length;
  const multiSiteCount = customers.filter((customer) => customer.locations.length > 1).length;
  const multiBranchCount = customers.filter((customer) => customer.branchCoverage.length > 1).length;
  const commercialCount = customers.filter((customer) => customer.customerType === "commercial").length;
  const filtersActive = Object.values(filters).some(Boolean);

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

  const branchSpread = Array.from(
    customers.reduce<Map<string, number>>((acc, customer) => {
      customer.branchCoverage.forEach((branch) => {
        acc.set(branch, (acc.get(branch) ?? 0) + 1);
      });
      return acc;
    }, new Map()).entries(),
  )
    .map(([branch, count]) => ({ branch, count }))
    .sort((left, right) => right.count - left.count)
    .slice(0, 8);

  return (
    <WorkspacePanels
      pageKey="customers"
      initialLayout={workspace.layout as typeof defaultLayout}
      left={
        <div className="space-y-4">
          <section className="panel overflow-hidden">
            <div className="border-b border-[var(--line)] px-5 py-4">
              <p className="workspace-section-label">Customer scope</p>
              <h1 className="mt-1 text-xl font-semibold text-slate-950">Customer workspace</h1>
            </div>
            <div className="px-5 py-4">
              <form className="grid gap-3" action="/customers">
                <input
                  type="text"
                  name="q"
                  defaultValue={filters.q ?? ""}
                  placeholder="Customer, number, city, location"
                  className="workspace-input"
                />
                <select
                  name="customerType"
                  defaultValue={filters.customerType ?? ""}
                  className="workspace-input"
                >
                  <option value="">All customer types</option>
                  <option value="commercial">Commercial</option>
                  <option value="internal">Internal</option>
                </select>
                <select
                  name="portalEnabled"
                  defaultValue={filters.portalEnabled ?? ""}
                  className="workspace-input"
                >
                  <option value="">All portal states</option>
                  <option value="true">Portal enabled</option>
                  <option value="false">Portal pending</option>
                </select>
                <div className="flex gap-2">
                  <button type="submit" className="btn-primary flex-1 justify-center">
                    Apply
                  </button>
                  <Link href="/customers" className="btn-secondary justify-center">
                    Reset
                  </Link>
                </div>
              </form>
            </div>
          </section>

          <section className="panel overflow-hidden">
            <div className="border-b border-[var(--line)] px-5 py-4">
              <p className="workspace-section-label">Coverage</p>
            </div>
            <div className="grid gap-px bg-[var(--line)]">
              <div className="bg-white px-5 py-4">
                <p className="workspace-metric-label">Accounts in scope</p>
                <p className="mt-2 text-3xl font-semibold text-slate-950">
                  {formatCompactNumber(customers.length)}
                </p>
              </div>
              <div className="bg-white px-5 py-4">
                <p className="workspace-metric-label">Portal enabled</p>
                <p className="mt-2 text-3xl font-semibold text-slate-950">
                  {formatCompactNumber(portalEnabledCount)}
                </p>
              </div>
              <div className="bg-white px-5 py-4">
                <p className="workspace-metric-label">Multi-site</p>
                <p className="mt-2 text-3xl font-semibold text-slate-950">
                  {formatCompactNumber(multiSiteCount)}
                </p>
              </div>
              <div className="bg-white px-5 py-4">
                <p className="workspace-metric-label">Multi-branch</p>
                <p className="mt-2 text-3xl font-semibold text-slate-950">
                  {formatCompactNumber(multiBranchCount)}
                </p>
              </div>
            </div>
          </section>

          <section className="panel overflow-hidden">
            <div className="border-b border-[var(--line)] px-5 py-4">
              <p className="workspace-section-label">Branch spread</p>
            </div>
            <div className="divide-y divide-[var(--line)]">
              {branchSpread.map((entry) => (
                <div key={entry.branch} className="workspace-list-row">
                  <span>{entry.branch}</span>
                  <strong>{formatCompactNumber(entry.count)}</strong>
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
                  <p className="workspace-section-label">Account board</p>
                  <h2 className="mt-1 text-2xl font-semibold text-slate-950">
                    Billing identity and delivery footprint
                  </h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  <StatusPill label={`${formatCompactNumber(commercialCount)} commercial`} />
                  <StatusPill
                    label={`${formatCompactNumber(customers.length - commercialCount)} internal`}
                  />
                </div>
              </div>
            </div>
            <div className="border-t border-[var(--line)] bg-[var(--surface-soft)] px-5 py-3 text-sm text-slate-500">
              {filtersActive ? "Filtered customer workspace." : "All customer accounts."}
            </div>
          </section>

          <section className="panel overflow-hidden">
            <div className="border-b border-[var(--line)] px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="workspace-section-label">Accounts</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, customers.length)} of{" "}
                    {formatCompactNumber(customers.length)}
                  </p>
                </div>
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-slate-500">
                  Page {page} of {totalPages}
                </p>
              </div>
            </div>

            <div className="divide-y divide-[var(--line)]">
              {pageCustomers.length === 0 ? (
                <div className="px-5 py-8 text-sm text-slate-500">No customers match the current scope.</div>
              ) : (
                pageCustomers.map((customer) => (
                  <div
                    key={customer.id}
                    className="grid gap-4 px-5 py-4 xl:grid-cols-[minmax(0,1.15fr)_180px_220px_220px]"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="mono text-sm font-semibold text-slate-950">
                          {customer.customerNumber}
                        </p>
                        <StatusPill label={titleize(customer.customerType)} />
                        <StatusPill
                          label={customer.portalEnabled ? "Portal enabled" : "Portal pending"}
                          tone={customer.portalEnabled ? "emerald" : "amber"}
                        />
                      </div>
                      <p className="mt-2 text-sm font-medium text-slate-900">{customer.name}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Billing city {customer.billingCity}
                      </p>
                    </div>

                    <div>
                      <p className="workspace-metric-label">Coverage</p>
                      <p className="mt-2 text-sm font-medium text-slate-900">
                        {customer.branchCoverage.length} branches
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {customer.branchCoverage.join(", ") || "Unassigned"}
                      </p>
                    </div>

                    <div>
                      <p className="workspace-metric-label">Sites</p>
                      <p className="mt-2 text-sm font-medium text-slate-900">
                        {customer.locations.length} locations
                      </p>
                      <div className="mt-1 space-y-1">
                        {customer.locations.slice(0, 3).map((location) => (
                          <p key={location.id} className="text-xs text-slate-500">
                            {location.name}
                          </p>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="workspace-metric-label">Primary contact</p>
                      <p className="mt-2 text-sm font-medium text-slate-900">
                        {customer.locations[0]?.contactPerson ?? "Unassigned"}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {customer.locations[0]?.address ?? "No site address"}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="border-t border-[var(--line)] px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-slate-500">
                  {filtersActive ? "Filtered account board." : "Full account board."}
                </p>
                <div className="flex gap-2">
                  <Link
                    href={buildCustomerHref(filters, {
                      page: page > 1 ? String(page - 1) : undefined,
                    })}
                    className="btn-secondary"
                  >
                    Previous
                  </Link>
                  <Link
                    href={buildCustomerHref(filters, {
                      page: page < totalPages ? String(page + 1) : String(totalPages),
                    })}
                    className="btn-secondary"
                  >
                    Next
                  </Link>
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
              <p className="workspace-section-label">Largest footprints</p>
            </div>
            <div className="divide-y divide-[var(--line)]">
              {topCustomers.map((customer) => (
                <div key={customer.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="mono text-xs text-slate-500">{customer.customerNumber}</p>
                      <p className="mt-1 text-sm font-medium text-slate-900">{customer.name}</p>
                    </div>
                    <StatusPill label={`${customer.locations.length} sites`} />
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    {customer.branchCoverage.join(", ") || "No branch coverage"}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="panel overflow-hidden">
            <div className="border-b border-[var(--line)] px-5 py-4">
              <p className="workspace-section-label">Portal rollout gaps</p>
            </div>
            <div className="divide-y divide-[var(--line)]">
              {[...customers]
                .filter((customer) => !customer.portalEnabled)
                .slice(0, 8)
                .map((customer) => (
                  <div key={customer.id} className="px-5 py-4">
                    <p className="mono text-xs text-slate-500">{customer.customerNumber}</p>
                    <p className="mt-1 text-sm font-medium text-slate-900">{customer.name}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {customer.locations.length} sites / {customer.branchCoverage.length} branches
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

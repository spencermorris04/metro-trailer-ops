import { Suspense } from "react";

import { InstantForm } from "@/components/instant-form";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { WorkspaceLink } from "@/components/workspace-link";
import { ListPageSkeleton } from "@/components/workspace-skeletons";
import { formatCompactNumber, formatCurrency, formatDate, titleize } from "@/lib/format";
import { getCustomerListView } from "@/lib/server/platform";

export const unstable_instant = { prefetch: "static" };

type CustomersPageProps = {
  searchParams: Promise<{
    q?: string | string[];
    customerType?: string | string[];
    portalEnabled?: string | string[];
    sourceProvider?: string | string[];
    page?: string | string[];
  }>;
};

function getParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatWholeNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatDecimal(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 1,
    minimumFractionDigits: value > 0 && value < 10 ? 1 : 0,
  }).format(value);
}

function buildHref(
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

export default function CustomersPage({ searchParams }: CustomersPageProps) {
  return (
    <Suspense fallback={<ListPageSkeleton filters={4} columns={6} />}>
      <CustomersContent searchParams={searchParams} />
    </Suspense>
  );
}

async function CustomersContent({ searchParams }: CustomersPageProps) {
  const resolved = await searchParams;
  const filters = {
    q: getParam(resolved.q),
    customerType: getParam(resolved.customerType),
    portalEnabled: getParam(resolved.portalEnabled),
    sourceProvider: getParam(resolved.sourceProvider),
  };
  const page = Math.max(1, Number(getParam(resolved.page) ?? "1"));
  const pageSize = 30;

  const view = await getCustomerListView({ ...filters, page, pageSize });
  const totalPages = Math.max(1, Math.ceil(view.total / view.pageSize));
  const filtersActive = Object.values(filters).some(Boolean);
  const maxCohortCount = Math.max(
    1,
    ...view.metrics.cohorts.map((cohort) => cohort.customerCount),
  );
  const latestActivityYear =
    view.metrics.yearlyActivity[view.metrics.yearlyActivity.length - 1];

  return (
    <div className="space-y-2">
      <PageHeader
        eyebrow="Operations"
        title="Customer master"
        description="Accounts, locations, BC lineage, contract counts, and AR exposure."
        actions={
          <>
            <WorkspaceLink href="/leases" className="btn-secondary">
              Leases
            </WorkspaceLink>
            <WorkspaceLink href="/ar/invoices" className="btn-secondary">
              AR invoices
            </WorkspaceLink>
          </>
        }
      />

      <div className="grid grid-cols-4 gap-px border border-[var(--line)] bg-[var(--line)]">
        {[
          {
            label: "All-time customers",
            value: formatWholeNumber(view.metrics.totalCustomers),
            detail: `${formatWholeNumber(view.metrics.rentingCustomers)} with rental history`,
          },
          {
            label: "Active customers now",
            value: formatWholeNumber(view.metrics.activeCustomersNow),
            detail: "Customers with trailers on rent",
          },
          {
            label: "Trailers on rent now",
            value: formatWholeNumber(view.metrics.activeTrailersNow),
            detail: `${formatDecimal(view.metrics.averageTrailersPerActiveCustomer)} per active customer`,
          },
          {
            label: "Avg trailers rented",
            value: formatDecimal(view.metrics.averageTrailersPerRentingCustomer),
            detail: "Distinct historical trailers per renting customer",
          },
        ].map((metric) => (
          <div key={metric.label} className="bg-white px-3 py-2">
            <p className="workspace-metric-label">{metric.label}</p>
            <p className="text-lg font-semibold text-slate-900">{metric.value}</p>
            <p className="text-[0.65rem] text-slate-400">{metric.detail}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-2 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
        <section className="panel overflow-hidden">
          <div className="flex items-baseline justify-between gap-3 border-b border-[var(--line)] px-3 py-2">
            <div className="flex items-baseline gap-3">
              <span className="eyebrow">Annual</span>
              <h2 className="text-[0.85rem] font-semibold text-slate-900">
                Active rental customers by year
              </h2>
            </div>
            <p className="hidden text-[0.75rem] text-slate-400 lg:block">
              Service-period years from imported rental billing facts
            </p>
          </div>
          <div className="data-table border-0">
            <table>
              <thead>
                <tr>
                  <th>Year</th>
                  <th>Customers</th>
                  <th>Rental orders</th>
                  <th>Trailers</th>
                </tr>
              </thead>
              <tbody>
                {view.metrics.yearlyActivity.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-slate-400">
                      No imported rental activity is available yet.
                    </td>
                  </tr>
                ) : (
                  view.metrics.yearlyActivity.map((year) => (
                    <tr key={year.year}>
                      <td className="font-semibold text-slate-900">{year.year}</td>
                      <td>{formatWholeNumber(year.activeCustomers)}</td>
                      <td>{formatWholeNumber(year.rentalOrders)}</td>
                      <td>{formatWholeNumber(year.trailers)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel overflow-hidden">
          <div className="flex items-baseline justify-between gap-3 border-b border-[var(--line)] px-3 py-2">
            <div className="flex items-baseline gap-3">
              <span className="eyebrow">Cohorts</span>
              <h2 className="text-[0.85rem] font-semibold text-slate-900">
                Customer base by trailer count
              </h2>
            </div>
            <p className="hidden text-[0.75rem] text-slate-400 lg:block">
              Based on distinct trailers in rental history
            </p>
          </div>
          <div className="space-y-3 p-3">
            <div className="grid grid-cols-3 gap-px border border-[var(--line)] bg-[var(--line)]">
              {[
                {
                  label: "Renting customers",
                  value: formatWholeNumber(view.metrics.rentingCustomers),
                },
                {
                  label: "No rental history",
                  value: formatWholeNumber(view.metrics.noRentalHistoryCustomers),
                },
                {
                  label: latestActivityYear ? `${latestActivityYear.year} active` : "Latest year",
                  value: latestActivityYear
                    ? formatWholeNumber(latestActivityYear.activeCustomers)
                    : "n/a",
                },
              ].map((metric) => (
                <div key={metric.label} className="bg-white px-3 py-2">
                  <p className="workspace-metric-label">{metric.label}</p>
                  <p className="text-base font-semibold text-slate-900">{metric.value}</p>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              {view.metrics.cohorts.map((cohort) => (
                <div key={cohort.key} className="space-y-1">
                  <div className="flex items-center justify-between gap-3 text-[0.75rem]">
                    <div>
                      <span className="font-semibold text-slate-900">{cohort.label}</span>
                      <span className="ml-2 text-slate-400">{cohort.rangeLabel}</span>
                    </div>
                    <span className="font-semibold text-slate-900">
                      {formatWholeNumber(cohort.customerCount)}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-sm bg-slate-100">
                    <div
                      className="h-full bg-[var(--brand)]"
                      style={{
                        width: `${Math.max(4, (cohort.customerCount / maxCohortCount) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      <div className="panel px-3 py-2">
        <InstantForm className="flex flex-wrap items-end gap-2" action="/customers">
          <input
            type="text"
            name="q"
            defaultValue={filters.q ?? ""}
            placeholder="Customer, number, city, site..."
            className="workspace-input w-48"
          />
          <select
            name="customerType"
            defaultValue={filters.customerType ?? ""}
            className="workspace-input w-36"
          >
            <option value="">All types</option>
            <option value="commercial">Commercial</option>
            <option value="internal">Internal</option>
          </select>
          <select
            name="portalEnabled"
            defaultValue={filters.portalEnabled ?? ""}
            className="workspace-input w-36"
          >
            <option value="">Portal any</option>
            <option value="true">Portal enabled</option>
            <option value="false">Portal disabled</option>
          </select>
          <select
            name="sourceProvider"
            defaultValue={filters.sourceProvider ?? ""}
            className="workspace-input w-36"
          >
            <option value="">Any source</option>
            <option value="business_central">Business Central</option>
            <option value="internal">Internal</option>
          </select>
          <button type="submit" className="btn-primary">
            Apply
          </button>
          <WorkspaceLink href="/customers" className="btn-secondary">
            Reset
          </WorkspaceLink>
        </InstantForm>
      </div>

      <div className="grid grid-cols-4 gap-px border border-[var(--line)] bg-[var(--line)]">
        {[
          { label: "In scope", value: formatCompactNumber(view.total) },
          {
            label: "BC seeded",
            value: formatCompactNumber(
              view.data.filter((customer) => customer.sourceProvider === "business_central")
                .length,
            ),
          },
          {
            label: "Portal enabled",
            value: formatCompactNumber(
              view.data.filter((customer) => customer.portalEnabled).length,
            ),
          },
          {
            label: "Multi-site",
            value: formatCompactNumber(
              view.data.filter((customer) => customer.locations.length > 1).length,
            ),
          },
          {
            label: "Open AR",
            value: formatCurrency(
              view.data.reduce((sum, customer) => sum + customer.arBalance, 0),
            ),
          },
          {
            label: "Contracts",
            value: formatCompactNumber(
              view.data.reduce((sum, customer) => sum + customer.contractCount, 0),
            ),
          },
          {
            label: "Commercial",
            value: formatCompactNumber(
              view.data.filter((customer) => customer.customerType === "commercial").length,
            ),
          },
          {
            label: "Payload saved",
            value: formatCompactNumber(
              view.data.filter((customer) => customer.sourcePayloadAvailable).length,
            ),
          },
        ].map((metric) => (
          <div key={metric.label} className="bg-white px-3 py-2">
            <p className="workspace-metric-label">{metric.label}</p>
            <p className="text-base font-semibold text-slate-900">{metric.value}</p>
          </div>
        ))}
      </div>

      <div className="panel overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--line)] px-3 py-1.5">
          <span className="text-[0.75rem] text-slate-500">
            {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, view.total)} of{" "}
            {formatCompactNumber(view.total)}
            {filtersActive ? " (filtered)" : ""}
          </span>
          <span className="text-[0.65rem] font-semibold uppercase tracking-[0.06em] text-slate-400">
            Page {page}/{totalPages}
          </span>
        </div>
        <div className="data-table border-0">
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Type / Source</th>
                <th>Coverage</th>
                <th>Sites</th>
                <th>Leases / trailers</th>
                <th>Latest activity</th>
                <th>AR</th>
              </tr>
            </thead>
            <tbody>
              {view.data.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-slate-400">
                    No customers match the current scope.
                  </td>
                </tr>
              ) : (
                view.data.map((customer) => (
                  <tr key={customer.id}>
                    <td>
                      <WorkspaceLink
                        href={`/customers/${customer.id}`}
                        className="font-semibold text-[var(--brand)]"
                      >
                        {customer.name}
                      </WorkspaceLink>
                      <br />
                      <span className="mono text-[0.65rem] text-slate-400">
                        {customer.customerNumber}
                      </span>
                      <br />
                      <span className="text-[0.65rem] text-slate-400">
                        {customer.billingCity}
                      </span>
                    </td>
                    <td>
                      <StatusPill label={titleize(customer.customerType)} />
                      <div className="mt-1">
                        <StatusPill
                          label={titleize(customer.sourceProvider.replaceAll("_", " "))}
                        />
                      </div>
                      <div className="mt-1 text-[0.65rem] text-slate-400">
                        {customer.portalEnabled ? "Portal enabled" : "Portal disabled"}
                      </div>
                    </td>
                    <td>
                      <span className="text-slate-700">
                        {customer.branchCoverage.length} branches
                      </span>
                      <br />
                      <span className="text-[0.65rem] text-slate-400">
                        {customer.branchCoverage.join(", ") || "Unassigned"}
                      </span>
                    </td>
                    <td>
                      <span className="text-slate-700">
                        {customer.locations.length} locations
                      </span>
                      <br />
                      <span className="text-[0.65rem] text-slate-400">
                        {customer.locations
                          .slice(0, 2)
                          .map((location) => location.name)
                          .join(", ") || "No site data"}
                      </span>
                    </td>
                    <td>
                      <span className="text-slate-700">
                        {customer.bcLeaseCount || customer.contractCount} leases
                      </span>
                      <br />
                      <span className="text-[0.65rem] text-slate-400">
                        {customer.bcEquipmentCount} trailers / {customer.bcInvoiceCount} invoices
                      </span>
                    </td>
                    <td>
                      {customer.latestActivityDate
                        ? formatDate(customer.latestActivityDate)
                        : "No BC activity"}
                      <br />
                      <span className="text-[0.65rem] text-slate-400">
                        {formatCurrency(customer.bcRevenue ?? 0)} billed
                      </span>
                    </td>
                    <td className="font-semibold text-slate-900">
                      {formatCurrency(customer.arBalance)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-[var(--line)] px-3 py-1.5">
          <span className="text-[0.7rem] text-slate-400">
            {filtersActive ? "Filtered account list" : "All account records"}
          </span>
          <div className="flex gap-1.5">
            <WorkspaceLink
              href={buildHref(filters, {
                page: page > 1 ? String(page - 1) : undefined,
              })}
              className="btn-secondary"
            >
              Prev
            </WorkspaceLink>
            <WorkspaceLink
              href={buildHref(filters, {
                page: page < totalPages ? String(page + 1) : String(totalPages),
              })}
              className="btn-secondary"
            >
              Next
            </WorkspaceLink>
          </div>
        </div>
      </div>
    </div>
  );
}

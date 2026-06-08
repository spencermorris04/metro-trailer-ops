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
    cohortMode?: string | string[];
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

function normalizeCohortMode(value: string | undefined) {
  return value === "all" ? "all" : "active";
}

function chartX(value: number, maxValue: number) {
  if (maxValue <= 1) {
    return 0;
  }
  return (Math.log10(Math.max(1, value)) / Math.log10(maxValue)) * 100;
}

function chartY(value: number, maxValue: number) {
  return maxValue > 0 ? 54 - (value / maxValue) * 48 : 54;
}

function buildDistributionPath(
  points: { trailerCount: number; customerCount: number }[],
  maxTrailerCount: number,
  maxCustomerCount: number,
) {
  return points
    .map((point, index) => {
      const x = chartX(point.trailerCount, maxTrailerCount).toFixed(2);
      const y = chartY(point.customerCount, maxCustomerCount).toFixed(2);
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
}

function buildDistributionArea(
  points: { trailerCount: number; customerCount: number }[],
  maxTrailerCount: number,
  maxCustomerCount: number,
) {
  const line = buildDistributionPath(points, maxTrailerCount, maxCustomerCount);
  return line ? `M 0 54 ${line.replace(/^M/, "L")} L 100 54 Z` : "";
}

function uniqueTicks(values: number[]) {
  return Array.from(new Set(values.filter((value) => Number.isFinite(value) && value > 0)));
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
  const cohortMode = normalizeCohortMode(getParam(resolved.cohortMode));
  const currentParams = { ...filters, cohortMode };
  const page = Math.max(1, Number(getParam(resolved.page) ?? "1"));
  const pageSize = 30;

  const view = await getCustomerListView({ ...filters, cohortMode, page, pageSize });
  const totalPages = Math.max(1, Math.ceil(view.total / view.pageSize));
  const filtersActive = Object.values(filters).some(Boolean);
  const selectedDistribution = view.metrics.trailerCountDistribution;
  const distributionPoints = selectedDistribution.points;
  const maxDistributionCustomerCount = Math.max(
    1,
    ...distributionPoints.map((point) => point.customerCount),
  );
  const maxDistributionTrailerCount = Math.max(
    1,
    selectedDistribution.maxTrailerCount,
    ...distributionPoints.map((point) => point.trailerCount),
  );
  const distributionPath = buildDistributionPath(
    distributionPoints,
    maxDistributionTrailerCount,
    maxDistributionCustomerCount,
  );
  const distributionArea = buildDistributionArea(
    distributionPoints,
    maxDistributionTrailerCount,
    maxDistributionCustomerCount,
  );
  const distributionTicks = uniqueTicks([
    1,
    10,
    100,
    1000,
    10000,
    maxDistributionTrailerCount,
  ]).filter((value) => value <= maxDistributionTrailerCount);
  const peakPoint = distributionPoints.reduce(
    (peak, point) => (point.customerCount > peak.customerCount ? point : peak),
    { trailerCount: 0, customerCount: 0 },
  );
  const selectedDistributionLabel =
    cohortMode === "active" ? "Current active rental orders" : "All rental orders";
  const selectedDistributionUnit =
    cohortMode === "active" ? "active trailers" : "order/trailer assignments";

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
              Service-period years from 2014 onward
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
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] px-3 py-2">
            <div className="flex items-baseline gap-3">
              <span className="eyebrow">Cohorts</span>
              <h2 className="text-[0.85rem] font-semibold text-slate-900">
                Customer trailer-count distribution
              </h2>
            </div>
            <div className="flex border border-[var(--line)] bg-white">
              {[
                { key: "active", label: "Active" },
                { key: "all", label: "All orders" },
              ].map((mode) => (
                <WorkspaceLink
                  key={mode.key}
                  href={buildHref(currentParams, {
                    cohortMode: mode.key,
                    page: undefined,
                  })}
                  className={`px-2 py-1 text-[0.7rem] font-semibold ${
                    cohortMode === mode.key
                      ? "bg-[var(--brand)] text-white"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {mode.label}
                </WorkspaceLink>
              ))}
            </div>
          </div>
          <div className="space-y-3 p-3">
            <div className="grid grid-cols-3 gap-px border border-[var(--line)] bg-[var(--line)]">
              {[
                {
                  label: cohortMode === "active" ? "Active customers" : "Renting customers",
                  value: formatWholeNumber(selectedDistribution.rentingCustomers),
                },
                {
                  label: "Avg count",
                  value: formatDecimal(selectedDistribution.averageTrailerCount),
                },
                {
                  label: "Total counted",
                  value: formatWholeNumber(selectedDistribution.totalTrailerAssignments),
                },
              ].map((metric) => (
                <div key={metric.label} className="bg-white px-3 py-2">
                  <p className="workspace-metric-label">{metric.label}</p>
                  <p className="text-base font-semibold text-slate-900">{metric.value}</p>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3 text-[0.72rem] text-slate-500">
                <span>{selectedDistributionLabel}</span>
                <span>
                  Peak: {formatWholeNumber(peakPoint.customerCount)} customers at{" "}
                  {formatWholeNumber(peakPoint.trailerCount)} {selectedDistributionUnit}
                </span>
              </div>
              <div className="h-64 border border-[var(--line)] bg-white px-2 py-2">
                {distributionPoints.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-[0.75rem] text-slate-400">
                    No trailer-count distribution is available.
                  </div>
                ) : (
                  <svg
                    viewBox="0 0 100 64"
                    preserveAspectRatio="none"
                    className="h-full w-full overflow-visible"
                    aria-label={`${selectedDistributionLabel} trailer-count distribution`}
                  >
                    <line x1="0" y1="54" x2="100" y2="54" stroke="#cbd5e1" strokeWidth="0.35" />
                    {distributionTicks.map((tick) => {
                      const x = chartX(tick, maxDistributionTrailerCount);
                      return (
                        <g key={tick}>
                          <line
                            x1={x}
                            y1="6"
                            x2={x}
                            y2="54"
                            stroke="#e2e8f0"
                            strokeWidth="0.18"
                          />
                          <text
                            x={x}
                            y="61"
                            textAnchor={x > 92 ? "end" : x < 8 ? "start" : "middle"}
                            className="fill-slate-400 text-[3px] font-semibold"
                          >
                            {formatCompactNumber(tick)}
                          </text>
                        </g>
                      );
                    })}
                    <path d={distributionArea} fill="rgba(37, 99, 235, 0.12)" />
                    <path
                      d={distributionPath}
                      fill="none"
                      stroke="var(--brand)"
                      strokeWidth="0.9"
                      vectorEffect="non-scaling-stroke"
                    />
                    {distributionPoints.map((point) => {
                      const x = chartX(point.trailerCount, maxDistributionTrailerCount);
                      const y = chartY(point.customerCount, maxDistributionCustomerCount);
                      return (
                        <circle
                          key={`${point.trailerCount}:${point.customerCount}`}
                          cx={x}
                          cy={y}
                          r="0.7"
                          fill="var(--brand)"
                          opacity="0.58"
                        />
                      );
                    })}
                  </svg>
                )}
              </div>
              <div className="flex items-center justify-between gap-3 text-[0.68rem] text-slate-400">
                <span>Trailer count, log scale</span>
                <span>
                  {cohortMode === "active"
                    ? "Distinct open trailers per customer"
                    : "Distinct rental order/trailer pairs per customer"}
                </span>
              </div>
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
              href={buildHref(currentParams, {
                page: page > 1 ? String(page - 1) : undefined,
              })}
              className="btn-secondary"
            >
              Prev
            </WorkspaceLink>
            <WorkspaceLink
              href={buildHref(currentParams, {
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

import { Suspense } from "react";

import { InstantForm } from "@/components/instant-form";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { WorkspaceLink } from "@/components/workspace-link";
import { ListPageSkeleton } from "@/components/workspace-skeletons";
import { formatCompactNumber, formatCurrency, titleize } from "@/lib/format";
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
                <th>Contracts</th>
                <th>AR</th>
              </tr>
            </thead>
            <tbody>
              {view.data.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-slate-400">
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
                      <span className="text-slate-700">{customer.contractCount} contracts</span>
                      <br />
                      <span className="text-[0.65rem] text-slate-400">
                        {customer.sourcePayloadAvailable
                          ? "Legacy payload saved"
                          : "No raw payload"}
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

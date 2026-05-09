import { Suspense } from "react";

import { InstantForm } from "@/components/instant-form";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { WorkspaceLink } from "@/components/workspace-link";
import { ListPageSkeleton } from "@/components/workspace-skeletons";
import { formatCompactNumber, formatCurrency, formatDate, titleize } from "@/lib/format";
import { getLeaseRegisterView, type RentalSourceFilter } from "@/lib/server/platform";

export const unstable_instant = { prefetch: "static" };

type LeasesPageProps = {
  searchParams: Promise<{
    q?: string | string[];
    source?: string | string[];
    page?: string | string[];
  }>;
};

function getParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getSource(value: string | undefined): RentalSourceFilter {
  return value === "app" || value === "business_central" ? value : "all";
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
  return query ? `/leases?${query}` : "/leases";
}

export default function LeasesPage({ searchParams }: LeasesPageProps) {
  return (
    <Suspense fallback={<ListPageSkeleton filters={2} metrics={4} columns={7} />}>
      <LeasesContent searchParams={searchParams} />
    </Suspense>
  );
}

async function LeasesContent({ searchParams }: LeasesPageProps) {
  const resolved = await searchParams;
  const filters = {
    q: getParam(resolved.q),
    source: getSource(getParam(resolved.source)),
  };
  const page = Math.max(1, Number(getParam(resolved.page) ?? "1"));
  const view = await getLeaseRegisterView({ ...filters, page, pageSize: 50 });
  const totalPages = Math.max(1, Math.ceil(view.total / view.pageSize));

  return (
    <div className="space-y-2">
      <PageHeader
        eyebrow="Commercial"
        title="Leases"
        description="App-native leases plus BC/RMI rental order history grouped by original order number."
        actions={
          <>
            <WorkspaceLink href="/assets" className="btn-secondary">
              Assets overview
            </WorkspaceLink>
            <WorkspaceLink href="/ar/invoices" className="btn-secondary">
              Invoices
            </WorkspaceLink>
          </>
        }
      />

      <div className="panel px-3 py-2">
        <InstantForm className="flex flex-wrap items-end gap-2" action="/leases">
          <input
            type="text"
            name="q"
            defaultValue={filters.q ?? ""}
            placeholder="Lease, order, customer, asset..."
            className="workspace-input w-64"
          />
          <select name="source" defaultValue={filters.source} className="workspace-input w-44">
            <option value="all">All sources</option>
            <option value="business_central">Business Central</option>
            <option value="app">Metro native</option>
          </select>
          <button type="submit" className="btn-primary">
            Apply
          </button>
          <WorkspaceLink href="/leases" className="btn-secondary">
            Reset
          </WorkspaceLink>
        </InstantForm>
      </div>

      <div className="grid grid-cols-4 gap-px border border-[var(--line)] bg-[var(--line)]">
        {[
          ["Leases", formatCompactNumber(view.total)],
          ["BC order groups", formatCompactNumber(view.data.filter((row) => row.source === "business_central").length)],
          ["Metro native", formatCompactNumber(view.data.filter((row) => row.source === "app").length)],
          ["Line import", view.lineImport.done ? "Complete" : "Running"],
        ].map(([label, value]) => (
          <div key={label} className="bg-white px-3 py-2">
            <p className="workspace-metric-label">{label}</p>
            <p className="text-base font-semibold text-slate-900">{value}</p>
          </div>
        ))}
      </div>

      <div className="panel overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--line)] px-3 py-1.5">
          <span className="text-[0.75rem] text-slate-500">
            {(page - 1) * view.pageSize + 1}-{Math.min(page * view.pageSize, view.total)} of{" "}
            {formatCompactNumber(view.total)}
          </span>
          <span className="text-[0.65rem] font-semibold uppercase tracking-[0.06em] text-slate-400">
            Page {page}/{totalPages}
          </span>
        </div>
        <div className="data-table border-0">
          <table>
            <thead>
              <tr>
                <th>Lease</th>
                <th>Customer</th>
                <th>Dates</th>
                <th>Source</th>
                <th>Invoices</th>
                <th>Assets / lines</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {view.data.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-slate-400">
                    No leases match the current scope.
                  </td>
                </tr>
              ) : (
                view.data.map((lease) => (
                  <tr key={`${lease.source}:${lease.id}`}>
                    <td>
                      <WorkspaceLink
                        href={`/leases/${lease.leaseKey}`}
                        className="font-semibold text-[var(--brand)]"
                      >
                        {lease.leaseKey}
                      </WorkspaceLink>
                      <br />
                      <span className="text-[0.65rem] text-slate-400">
                        {lease.source === "business_central" ? "BC order" : "Metro lease"}
                      </span>
                    </td>
                    <td>
                      {lease.customerName}
                      <br />
                      <span className="text-[0.65rem] text-slate-400">
                        {lease.customerNumber ?? "No customer number"}
                      </span>
                    </td>
                    <td>
                      {lease.firstInvoiceDate ? formatDate(lease.firstInvoiceDate) : "Unknown"}
                      <br />
                      <span className="text-[0.65rem] text-slate-400">
                        {lease.latestInvoiceDate ? formatDate(lease.latestInvoiceDate) : "Open"}
                      </span>
                    </td>
                    <td>
                      <StatusPill label={titleize(lease.source.replaceAll("_", " "))} />
                      <div className="mt-1 text-[0.65rem] text-slate-400">
                        {lease.sourceDocumentType ?? lease.completeness}
                      </div>
                    </td>
                    <td>{lease.invoiceCount}</td>
                    <td>
                      {lease.assetCount} assets
                      <br />
                      <span className="text-[0.65rem] text-slate-400">
                        {lease.lineCount} lines
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
        <div className="flex items-center justify-between border-t border-[var(--line)] px-3 py-1.5">
          <span className="text-[0.7rem] text-slate-400">
            BC balances stay pending until customer ledger import is available.
          </span>
          <div className="flex gap-1.5">
            <WorkspaceLink
              href={buildHref(filters, { page: page > 1 ? String(page - 1) : undefined })}
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

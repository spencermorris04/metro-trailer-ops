import { Suspense } from "react";

import { InstantForm } from "@/components/instant-form";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { WorkspaceLink } from "@/components/workspace-link";
import { ListPageSkeleton } from "@/components/workspace-skeletons";
import { formatCompactNumber, formatCurrency, formatDate, titleize } from "@/lib/format";
import { getInvoiceRegisterView, type RentalSourceFilter } from "@/lib/server/platform";

export const unstable_instant = { prefetch: "static" };

type ArInvoicesPageProps = {
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
  return query ? `/ar/invoices?${query}` : "/ar/invoices";
}

export default function ArInvoicesPage({ searchParams }: ArInvoicesPageProps) {
  return (
    <Suspense fallback={<ListPageSkeleton filters={2} metrics={4} columns={8} />}>
      <ArInvoicesContent searchParams={searchParams} />
    </Suspense>
  );
}

async function ArInvoicesContent({ searchParams }: ArInvoicesPageProps) {
  const resolved = await searchParams;
  const filters = {
    q: getParam(resolved.q),
    source: getSource(getParam(resolved.source)),
  };
  const page = Math.max(1, Number(getParam(resolved.page) ?? "1"));
  const view = await getInvoiceRegisterView({ ...filters, page, pageSize: 50 });
  const totalPages = Math.max(1, Math.ceil(view.total / view.pageSize));

  return (
    <div className="space-y-2">
      <PageHeader
        eyebrow="Accounts Receivable"
        title="Invoices"
        description="Metro-native AR invoices plus raw BC/RMI posted rental invoice history."
        actions={
          <>
            <WorkspaceLink href="/equipment" className="btn-secondary">
              Equipment
            </WorkspaceLink>
            <WorkspaceLink href="/leases" className="btn-secondary">
              Leases
            </WorkspaceLink>
          </>
        }
      />

      <div className="panel px-3 py-2">
        <InstantForm className="flex flex-wrap items-end gap-2" action="/ar/invoices">
          <input
            type="text"
            name="q"
            defaultValue={filters.q ?? ""}
            placeholder="Invoice, order, customer, asset..."
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
          <WorkspaceLink href="/ar/invoices" className="btn-secondary">
            Reset
          </WorkspaceLink>
        </InstantForm>
      </div>

      <div className="grid grid-cols-4 gap-px border border-[var(--line)] bg-[var(--line)]">
        {[
          ["Invoices", formatCompactNumber(view.total)],
          ["Visible BC", formatCompactNumber(view.data.filter((row) => row.source === "business_central").length)],
          ["Visible Metro", formatCompactNumber(view.data.filter((row) => row.source === "app").length)],
          ["BC ledger balances", view.openBalanceAvailable ? "Available" : "Pending"],
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
                <th>Invoice</th>
                <th>Customer</th>
                <th>Lease/order</th>
                <th>Status</th>
                <th>Dates</th>
                <th>Lines</th>
                <th>Balance</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {view.data.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-slate-400">
                    No invoices match the current scope.
                  </td>
                </tr>
              ) : (
                view.data.map((invoice) => (
                  <tr key={`${invoice.source}:${invoice.id}`}>
                    <td>
                      <WorkspaceLink
                        href={`/ar/invoices/${invoice.invoiceNumber}`}
                        className="font-semibold text-[var(--brand)]"
                      >
                        {invoice.invoiceNumber}
                      </WorkspaceLink>
                      <br />
                      <span className="text-[0.65rem] text-slate-400">
                        {invoice.source === "business_central" ? "Business Central" : "Metro"}
                      </span>
                    </td>
                    <td>
                      {invoice.customerName}
                      <br />
                      <span className="text-[0.65rem] text-slate-400">
                        {invoice.customerNumber ?? "No customer number"}
                      </span>
                    </td>
                    <td>
                      {invoice.leaseKey ? (
                        <WorkspaceLink href={`/leases/${invoice.leaseKey}`} className="text-[var(--brand)]">
                          {invoice.leaseKey}
                        </WorkspaceLink>
                      ) : (
                        "Unassigned"
                      )}
                      <br />
                      <span className="text-[0.65rem] text-slate-400">
                        {invoice.previousDocumentType ?? invoice.sourceDocumentType ?? "-"}
                      </span>
                    </td>
                    <td><StatusPill label={titleize(invoice.status)} /></td>
                    <td>
                      {invoice.invoiceDate ? formatDate(invoice.invoiceDate) : "Unknown"}
                      <br />
                      <span className="text-[0.65rem] text-slate-400">
                        Due {invoice.dueDate ? formatDate(invoice.dueDate) : "n/a"}
                      </span>
                    </td>
                    <td>
                      {invoice.lineCount}
                      <br />
                      <span className="text-[0.65rem] text-slate-400">
                        {invoice.fixedAssetLineCount} assets
                      </span>
                    </td>
                    <td>
                      {invoice.balanceAmount === null ? (
                        <StatusPill label="No ledger balance" />
                      ) : (
                        formatCurrency(invoice.balanceAmount)
                      )}
                    </td>
                    <td>
                      <span className="font-semibold text-slate-900">
                        {formatCurrency(invoice.totalAmount)}
                      </span>
                      <br />
                      <span className="text-[0.65rem] text-slate-400">
                        {invoice.amountSource === "rmi_lines"
                          ? "RMI lines"
                          : invoice.amountSource === "header_payload"
                            ? "Header payload"
                            : "Metro invoice"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-[var(--line)] px-3 py-1.5">
          <span className="text-[0.7rem] text-slate-400">
            BC open AR is derived from customer ledger entries, not invoice headers.
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

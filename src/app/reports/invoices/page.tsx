import { PageHeader } from "@/components/page-header";
import {
  ExportPlaceholder,
  PaginationControls,
  PeriodSelector,
  ReportFilterBar,
  ReportKpiGrid,
  SourceCoverageBadge,
  getSingleParam,
  numberParam,
} from "@/components/reporting";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import { WorkspaceLink } from "@/components/workspace-link";
import { formatCompactNumber, formatCurrency, formatDate, titleize } from "@/lib/format";
import { getInvoiceReportView } from "@/lib/server/platform";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function InvoiceReportPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const q = getSingleParam(params.q);
  const status = getSingleParam(params.status);
  const view = await getInvoiceReportView({
    period: getSingleParam(params.period),
    start: getSingleParam(params.start),
    end: getSingleParam(params.end),
    q,
    status,
    customerNumber: getSingleParam(params.customerNumber),
    leaseKey: getSingleParam(params.leaseKey),
    source: getSingleParam(params.source),
    page: numberParam(params.page),
  });

  return (
    <div className="space-y-2">
      <PageHeader
        eyebrow="Reports"
        title="Invoice register"
        description="Period-scoped invoice facts with drilldown to AR invoice detail."
        actions={<ExportPlaceholder />}
      />
      <PeriodSelector basePath="/reports/invoices" period={view.period} extraParams={{ q, status }} />
      <ReportFilterBar action="/reports/invoices">
        <input type="hidden" name="period" value={view.period.key} />
        <input name="q" defaultValue={q ?? ""} placeholder="Invoice, customer, lease..." className="workspace-input w-72" />
        <select name="status" defaultValue={status ?? ""} className="workspace-input w-40">
          <option value="">All statuses</option>
          <option value="open">Open</option>
          <option value="closed">Closed</option>
        </select>
      </ReportFilterBar>
      <ReportKpiGrid
        metrics={[
          ["Invoices", formatCompactNumber(view.summary.invoiceCount)],
          ["Invoice total", formatCurrency(view.summary.totalAmount)],
          ["Open balance", formatCurrency(view.summary.openBalance)],
          ["Matching rows", formatCompactNumber(view.total)],
        ].map(([label, value]) => ({ label, value }))}
      />
      <SourceCoverageBadge source="rental_invoice_facts" refreshState={view.refreshState} />
      <SectionCard eyebrow="Invoices" title="Invoice drilldown">
        <div className="panel overflow-hidden">
          <PaginationControls
            basePath="/reports/invoices"
            page={view.page}
            pageSize={view.pageSize}
            total={view.total}
            params={{ period: view.period.key, q, status }}
          />
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
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {view.data.map((invoice) => (
                  <tr key={invoice.id}>
                    <td>
                      <WorkspaceLink href={`/ar/invoices/${invoice.invoiceNumber}`} className="font-semibold text-[var(--brand)]">
                        {invoice.invoiceNumber}
                      </WorkspaceLink>
                      <br />
                      <span className="text-[0.65rem] text-slate-400">{invoice.sourceProvider}</span>
                    </td>
                    <td>
                      {invoice.customerName ?? invoice.customerNumber ?? "-"}
                      <br />
                      <span className="text-[0.65rem] text-slate-400">{invoice.customerNumber ?? "No customer"}</span>
                    </td>
                    <td>
                      {invoice.leaseKey ? (
                        <WorkspaceLink href={`/leases/${invoice.leaseKey}`} className="text-[var(--brand)]">
                          {invoice.leaseKey}
                        </WorkspaceLink>
                      ) : "-"}
                    </td>
                    <td><StatusPill label={titleize(invoice.status)} /></td>
                    <td>
                      {formatDate(invoice.postingDate)}
                      <br />
                      <span className="text-[0.65rem] text-slate-400">Due {formatDate(invoice.dueDate)}</span>
                    </td>
                    <td>
                      {formatCompactNumber(invoice.lineCount)}
                      <br />
                      <span className="text-[0.65rem] text-slate-400">{formatCompactNumber(invoice.fixedAssetLineCount)} asset lines</span>
                    </td>
                    <td>{invoice.arBalance == null ? "n/a" : formatCurrency(invoice.arBalance)}</td>
                    <td className="font-semibold text-slate-900">{formatCurrency(invoice.totalAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

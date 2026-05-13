import { PageHeader } from "@/components/page-header";
import {
  ExportPlaceholder,
  PaginationControls,
  ReportFilterBar,
  ReportKpiGrid,
  SourceCoverageBadge,
  getSingleParam,
  numberParam,
} from "@/components/reporting";
import { SectionCard } from "@/components/section-card";
import { WorkspaceLink } from "@/components/workspace-link";
import { formatCompactNumber, formatCurrency, formatDate } from "@/lib/format";
import { getArAgingReportView } from "@/lib/server/platform";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ArAgingReportPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const bucket = getSingleParam(params.bucket);
  const q = getSingleParam(params.q);
  const view = await getArAgingReportView({
    bucket,
    customerNumber: getSingleParam(params.customerNumber),
    q,
    page: numberParam(params.page),
  });

  return (
    <div className="space-y-2">
      <PageHeader
        eyebrow="Reports"
        title="AR aging"
        description="Open receivables by due-date bucket from AR ledger facts."
        actions={<ExportPlaceholder />}
      />
      <ReportFilterBar action="/reports/ar-aging">
        <select name="bucket" defaultValue={bucket ?? ""} className="workspace-input w-40">
          <option value="">All buckets</option>
          <option value="overdue">All overdue</option>
          <option value="Current">Current</option>
          <option value="1-30">1-30</option>
          <option value="31-60">31-60</option>
          <option value="61-90">61-90</option>
          <option value="90+">90+</option>
        </select>
        <input name="q" defaultValue={q ?? ""} placeholder="Customer, invoice, document..." className="workspace-input w-72" />
      </ReportFilterBar>
      <ReportKpiGrid
        metrics={[
          ["Open balance", formatCurrency(view.summary.balance)],
          ["Open entries", formatCompactNumber(view.summary.entryCount)],
          ["Visible rows", formatCompactNumber(view.total)],
          ["Source", "AR ledger facts"],
        ].map(([label, value]) => ({ label, value }))}
      />
      <SourceCoverageBadge source="ar_ledger_facts" />
      <div className="grid gap-2 xl:grid-cols-4">
        {view.buckets.map((row) => (
          <WorkspaceLink
            key={row.bucket}
            href={`/reports/ar-aging?bucket=${encodeURIComponent(row.bucket)}`}
            className="panel px-3 py-2 hover:text-[var(--brand)]"
          >
            <p className="workspace-metric-label">{row.bucket}</p>
            <p className="text-base font-semibold text-slate-900">{formatCurrency(row.balance)}</p>
            <p className="text-[0.65rem] text-slate-400">{formatCompactNumber(row.entryCount)} entries</p>
          </WorkspaceLink>
        ))}
      </div>
      <SectionCard eyebrow="AR" title="Open receivables">
        <div className="panel overflow-hidden">
          <PaginationControls
            basePath="/reports/ar-aging"
            page={view.page}
            pageSize={view.pageSize}
            total={view.total}
            params={{ bucket, q }}
          />
          <div className="data-table border-0">
            <table>
              <thead>
                <tr>
                  <th>Bucket</th>
                  <th>Customer</th>
                  <th>Document</th>
                  <th>Dates</th>
                  <th>Original amount</th>
                  <th>Remaining</th>
                </tr>
              </thead>
              <tbody>
                {view.data.map((row) => (
                  <tr key={row.id}>
                    <td>{row.bucket}</td>
                    <td>
                      {row.customerName ?? row.customerNumber ?? "-"}
                      <br />
                      <span className="text-[0.65rem] text-slate-400">{row.customerNumber ?? "No customer"}</span>
                    </td>
                    <td>
                      {row.documentNo ? (
                        <WorkspaceLink href={`/ar/invoices/${row.documentNo}`} className="font-semibold text-[var(--brand)]">
                          {row.documentNo}
                        </WorkspaceLink>
                      ) : "-"}
                      <br />
                      <span className="text-[0.65rem] text-slate-400">{row.documentType ?? "-"}</span>
                    </td>
                    <td>
                      Posted {formatDate(row.postingDate)}
                      <br />
                      <span className="text-[0.65rem] text-slate-400">Due {formatDate(row.dueDate)}</span>
                    </td>
                    <td>{formatCurrency(row.amount)}</td>
                    <td className="font-semibold text-slate-900">{formatCurrency(row.remainingAmount)}</td>
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

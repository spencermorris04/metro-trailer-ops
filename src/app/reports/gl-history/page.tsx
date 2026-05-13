import { PageHeader } from "@/components/page-header";
import {
  ExportPlaceholder,
  PaginationControls,
  PeriodSelector,
  ReportFilterBar,
  ReportKpiGrid,
  getSingleParam,
  numberParam,
} from "@/components/reporting";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import { formatCompactNumber, formatCurrency, formatDate } from "@/lib/format";
import { getGlHistoryReportView } from "@/lib/server/platform";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function GlHistoryReportPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const q = getSingleParam(params.q);
  const accountNo = getSingleParam(params.accountNo);
  const documentNo = getSingleParam(params.documentNo);
  const view = await getGlHistoryReportView({
    period: getSingleParam(params.period),
    start: getSingleParam(params.start),
    end: getSingleParam(params.end),
    q,
    accountNo,
    documentNo,
    page: numberParam(params.page),
  });

  return (
    <div className="space-y-2">
      <PageHeader
        eyebrow="Reports"
        title="BC GL history"
        description="Read-only imported Business Central general ledger history. This is not app-native journal posting."
        actions={<ExportPlaceholder />}
      />
      <PeriodSelector basePath="/reports/gl-history" period={view.period} extraParams={{ q, accountNo, documentNo }} />
      <ReportFilterBar action="/reports/gl-history">
        <input type="hidden" name="period" value={view.period.key} />
        <input name="q" defaultValue={q ?? ""} placeholder="Search account, document, description..." className="workspace-input w-80" />
        <input name="accountNo" defaultValue={accountNo ?? ""} placeholder="Account no." className="workspace-input w-40" />
        <input name="documentNo" defaultValue={documentNo ?? ""} placeholder="Document no." className="workspace-input w-40" />
      </ReportFilterBar>
      <ReportKpiGrid
        metrics={[
          ["Debit", formatCurrency(view.summary.debitAmount)],
          ["Credit", formatCurrency(view.summary.creditAmount)],
          ["Net", formatCurrency(view.summary.netAmount)],
          ["Rows", formatCompactNumber(view.total)],
        ].map(([label, value]) => ({ label, value }))}
      />
      <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[0.75rem] text-amber-900">
        GL import status: <StatusPill label={view.glImport.latestRun?.status ?? "Unknown"} />{" "}
        {formatCompactNumber(view.glImport.rowCount)} rows currently visible. If the import is still
        running, this report is partial by design.
      </div>
      <SectionCard eyebrow="GL" title="Historical entries">
        <div className="panel overflow-hidden">
          <PaginationControls
            basePath="/reports/gl-history"
            page={view.page}
            pageSize={view.pageSize}
            total={view.total}
            params={{ period: view.period.key, q, accountNo, documentNo }}
          />
          <div className="data-table border-0">
            <table>
              <thead>
                <tr>
                  <th>Entry</th>
                  <th>Date</th>
                  <th>Account</th>
                  <th>Document</th>
                  <th>Description</th>
                  <th>Debit</th>
                  <th>Credit</th>
                  <th>Net</th>
                </tr>
              </thead>
              <tbody>
                {view.data.map((row) => (
                  <tr key={row.id}>
                    <td>{row.externalEntryNo}</td>
                    <td>{formatDate(row.postingDate)}</td>
                    <td>{row.accountNo ?? "-"}</td>
                    <td>{row.documentNo ?? "-"}</td>
                    <td>{row.description ?? "-"}</td>
                    <td>{formatCurrency(row.debitAmount)}</td>
                    <td>{formatCurrency(row.creditAmount)}</td>
                    <td className="font-semibold text-slate-900">{formatCurrency(row.amount)}</td>
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

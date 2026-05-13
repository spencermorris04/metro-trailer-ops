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
import { WorkspaceLink } from "@/components/workspace-link";
import { formatCompactNumber, formatCurrency } from "@/lib/format";
import type {
  getBranchRevenueReportView,
  getCustomerRevenueReportView,
  getDealCodeRevenueReportView,
  getEquipmentRevenueReportView,
} from "@/lib/server/platform";

type GroupedRevenueView = Awaited<
  ReturnType<
    | typeof getEquipmentRevenueReportView
    | typeof getCustomerRevenueReportView
    | typeof getBranchRevenueReportView
    | typeof getDealCodeRevenueReportView
  >
>;

type SearchParams = Record<string, string | string[] | undefined>;

export function parseGroupedRevenueParams(params: SearchParams) {
  return {
    period: getSingleParam(params.period),
    start: getSingleParam(params.start),
    end: getSingleParam(params.end),
    q: getSingleParam(params.q),
    page: numberParam(params.page),
  };
}

export function GroupedRevenueReport({
  basePath,
  title,
  description,
  source,
  labelColumn,
  secondaryLabel,
  q,
  view,
  buildRowHref,
}: {
  basePath: string;
  title: string;
  description: string;
  source: string;
  labelColumn: string;
  secondaryLabel: string;
  q?: string;
  view: GroupedRevenueView;
  buildRowHref?: (key: string) => string;
}) {
  return (
    <div className="space-y-2">
      <PageHeader
        eyebrow="Reports"
        title={title}
        description={description}
        actions={<ExportPlaceholder />}
      />
      <PeriodSelector basePath={basePath} period={view.period} extraParams={{ q }} />
      <ReportFilterBar action={basePath}>
        <input type="hidden" name="period" value={view.period.key} />
        <input name="q" defaultValue={q ?? ""} placeholder={`Search ${labelColumn.toLowerCase()}...`} className="workspace-input w-72" />
      </ReportFilterBar>
      <ReportKpiGrid
        metrics={[
          ["Revenue", formatCurrency(view.summary.grossRevenue)],
          ["Invoices", formatCompactNumber(view.summary.invoiceCount)],
          ["Groups", formatCompactNumber(view.total)],
          ["Source", source],
        ].map(([label, value]) => ({ label, value }))}
      />
      <SourceCoverageBadge source={source} refreshState={view.refreshState} />
      <SectionCard eyebrow="Drilldown" title={title}>
        <div className="panel overflow-hidden">
          <PaginationControls
            basePath={basePath}
            page={view.page}
            pageSize={view.pageSize}
            total={view.total}
            params={{ period: view.period.key, q }}
          />
          <div className="data-table border-0">
            <table>
              <thead>
                <tr>
                  <th>{labelColumn}</th>
                  <th>Revenue</th>
                  <th>Invoices</th>
                  <th>Lines / count</th>
                  <th>{secondaryLabel}</th>
                </tr>
              </thead>
              <tbody>
                {view.data.map((row) => (
                  <tr key={row.groupKey}>
                    <td>
                      {buildRowHref ? (
                        <WorkspaceLink href={buildRowHref(row.groupKey)} className="font-semibold text-[var(--brand)]">
                          {row.label}
                        </WorkspaceLink>
                      ) : (
                        <span className="font-semibold text-slate-900">{row.label}</span>
                      )}
                    </td>
                    <td className="font-semibold text-slate-900">{formatCurrency(row.grossRevenue)}</td>
                    <td>{formatCompactNumber(row.invoiceCount)}</td>
                    <td>{formatCompactNumber(row.lineCount)}</td>
                    <td>{formatCompactNumber(row.secondaryCount)}</td>
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

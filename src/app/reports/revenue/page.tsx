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
import { formatCompactNumber, formatCurrency, titleize } from "@/lib/format";
import { getRevenueReportView } from "@/lib/server/platform";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function RevenueReportPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const groupBy = getSingleParam(params.groupBy) ?? "month";
  const q = getSingleParam(params.q);
  const view = await getRevenueReportView({
    period: getSingleParam(params.period),
    start: getSingleParam(params.start),
    end: getSingleParam(params.end),
    groupBy,
    q,
    page: numberParam(params.page),
  });

  return (
    <div className="space-y-2">
      <PageHeader
        eyebrow="Reports"
        title="Revenue drilldown"
        description="Period-scoped trailer revenue from line-level rental billing facts."
        actions={<ExportPlaceholder />}
      />
      <PeriodSelector basePath="/reports/revenue" period={view.period} extraParams={{ groupBy, q }} />
      <ReportFilterBar action="/reports/revenue">
        <input type="hidden" name="period" value={view.period.key} />
        <select name="groupBy" defaultValue={view.groupBy} className="workspace-input w-44">
          <option value="month">By month</option>
          <option value="branch">By branch</option>
          <option value="equipment">By equipment</option>
          <option value="customer">By customer</option>
          <option value="lease">By lease/order</option>
          <option value="deal_code">By deal code</option>
        </select>
        <input name="q" defaultValue={q ?? ""} placeholder="Search invoice, customer, trailer..." className="workspace-input w-72" />
      </ReportFilterBar>
      <ReportKpiGrid
        metrics={[
          ["Revenue", formatCurrency(view.summary.grossRevenue)],
          ["Invoices", formatCompactNumber(view.summary.invoiceCount)],
          ["Lines", formatCompactNumber(view.summary.lineCount)],
          ["Groups", formatCompactNumber(view.total)],
        ].map(([label, value]) => ({ label, value }))}
      />
      <SourceCoverageBadge source="rental_billing_facts" refreshState={view.refreshState} />
      <SectionCard eyebrow="Drilldown" title={`Revenue ${titleize(view.groupBy)}`}>
        <div className="panel overflow-hidden">
          <PaginationControls
            basePath="/reports/revenue"
            page={view.page}
            pageSize={view.pageSize}
            total={view.total}
            params={{ period: view.period.key, groupBy: view.groupBy, q }}
          />
          <div className="data-table border-0">
            <table>
              <thead>
                <tr>
                  <th>Group</th>
                  <th>Revenue</th>
                  <th>Tax</th>
                  <th>Damage waiver</th>
                  <th>Invoices</th>
                  <th>Equipment</th>
                  <th>Lines</th>
                </tr>
              </thead>
              <tbody>
                {view.data.map((row) => (
                  <tr key={row.groupKey}>
                    <td>
                      <DrilldownLink hrefType={row.hrefType} groupKey={row.groupKey} label={row.label} />
                    </td>
                    <td className="font-semibold text-slate-900">{formatCurrency(row.grossRevenue)}</td>
                    <td>{formatCurrency(row.taxAmount)}</td>
                    <td>{formatCurrency(row.damageWaiverAmount)}</td>
                    <td>{formatCompactNumber(row.invoiceCount)}</td>
                    <td>{formatCompactNumber(row.equipmentCount)}</td>
                    <td>{formatCompactNumber(row.lineCount)}</td>
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

function DrilldownLink({
  hrefType,
  groupKey,
  label,
}: {
  hrefType: string;
  groupKey: string;
  label: string;
}) {
  if (hrefType === "equipment") {
    return <WorkspaceLink href={`/equipment/${encodeURIComponent(groupKey)}`} className="font-semibold text-[var(--brand)]">{label}</WorkspaceLink>;
  }
  if (hrefType === "customer") {
    return <WorkspaceLink href={`/reports/customer-revenue?q=${encodeURIComponent(groupKey)}`} className="font-semibold text-[var(--brand)]">{label}</WorkspaceLink>;
  }
  if (hrefType === "lease") {
    return <WorkspaceLink href={`/leases/${encodeURIComponent(groupKey)}`} className="font-semibold text-[var(--brand)]">{label}</WorkspaceLink>;
  }
  if (hrefType === "branch") {
    return <WorkspaceLink href={`/reports/branch-revenue?q=${encodeURIComponent(groupKey)}`} className="font-semibold text-[var(--brand)]">{label}</WorkspaceLink>;
  }
  return <span className="font-semibold text-slate-900">{label}</span>;
}

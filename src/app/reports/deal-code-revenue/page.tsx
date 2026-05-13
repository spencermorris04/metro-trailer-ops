import {
  GroupedRevenueReport,
  parseGroupedRevenueParams,
} from "@/app/reports/_components/grouped-revenue-report";
import { getDealCodeRevenueReportView } from "@/lib/server/platform";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DealCodeRevenueReportPage({ searchParams }: PageProps) {
  const filters = parseGroupedRevenueParams(await searchParams);
  const view = await getDealCodeRevenueReportView(filters);
  return (
    <GroupedRevenueReport
      basePath="/reports/deal-code-revenue"
      title="Deal code revenue"
      description="Revenue patterns by RMI deal code for pricing and contract analysis."
      source="deal_code_revenue_rollup_monthly"
      labelColumn="Deal code"
      secondaryLabel="Invoices"
      q={filters.q}
      view={view}
      buildRowHref={(key) => `/reports/revenue?groupBy=deal_code&q=${encodeURIComponent(key)}`}
    />
  );
}

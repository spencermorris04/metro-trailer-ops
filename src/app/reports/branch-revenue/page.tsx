import {
  GroupedRevenueReport,
  parseGroupedRevenueParams,
} from "@/app/reports/_components/grouped-revenue-report";
import { getBranchRevenueReportView } from "@/lib/server/platform";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function BranchRevenueReportPage({ searchParams }: PageProps) {
  const filters = parseGroupedRevenueParams(await searchParams);
  const view = await getBranchRevenueReportView(filters);
  return (
    <GroupedRevenueReport
      basePath="/reports/branch-revenue"
      title="Branch revenue"
      description="Service-branch revenue using trailer/service context, not customer billing geography."
      source="branch_revenue_rollup_monthly"
      labelColumn="Branch"
      secondaryLabel="Invoices"
      q={filters.q}
      view={view}
      buildRowHref={(key) => `/reports/revenue?groupBy=branch&q=${encodeURIComponent(key)}`}
    />
  );
}

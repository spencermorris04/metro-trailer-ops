import {
  GroupedRevenueReport,
  parseGroupedRevenueParams,
} from "@/app/reports/_components/grouped-revenue-report";
import { getCustomerRevenueReportView } from "@/lib/server/platform";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CustomerRevenueReportPage({ searchParams }: PageProps) {
  const filters = parseGroupedRevenueParams(await searchParams);
  const view = await getCustomerRevenueReportView(filters);
  return (
    <GroupedRevenueReport
      basePath="/reports/customer-revenue"
      title="Customer revenue"
      description="Customer revenue, invoice count, and equipment exposure by period."
      source="customer_revenue_rollup_monthly"
      labelColumn="Customer"
      secondaryLabel="Equipment"
      q={filters.q}
      view={view}
      buildRowHref={(key) => `/customers/${encodeURIComponent(key)}`}
    />
  );
}

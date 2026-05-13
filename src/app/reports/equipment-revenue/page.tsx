import {
  GroupedRevenueReport,
  parseGroupedRevenueParams,
} from "@/app/reports/_components/grouped-revenue-report";
import { getEquipmentRevenueReportView } from "@/lib/server/platform";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function EquipmentRevenueReportPage({ searchParams }: PageProps) {
  const filters = parseGroupedRevenueParams(await searchParams);
  const view = await getEquipmentRevenueReportView(filters);
  return (
    <GroupedRevenueReport
      basePath="/reports/equipment-revenue"
      title="Equipment revenue"
      description="Trailer/equipment revenue by service period from rental billing facts."
      source="equipment_revenue_rollup_monthly"
      labelColumn="Equipment"
      secondaryLabel="Secondary count"
      q={filters.q}
      view={view}
      buildRowHref={(key) => `/reports/revenue?groupBy=equipment&q=${encodeURIComponent(key)}`}
    />
  );
}

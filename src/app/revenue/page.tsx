import { PageHeader } from "@/components/page-header";
import {
  PeriodSelector,
  ReportKpiGrid,
  getSingleParam,
} from "@/components/reporting";
import { SectionCard } from "@/components/section-card";
import { WorkspaceLink } from "@/components/workspace-link";
import { formatCompactNumber, formatCurrency, formatDate, titleize } from "@/lib/format";
import { getRevenueDashboardView } from "@/lib/server/platform";

type RevenueDashboardPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function RevenueDashboardPage({ searchParams }: RevenueDashboardPageProps) {
  const params = await searchParams;
  const view = await getRevenueDashboardView({
    period: getSingleParam(params.period),
    start: getSingleParam(params.start),
    end: getSingleParam(params.end),
  });
  const periodParam = view.period.key;
  const delta = view.metrics.revenueDeltaPercent;

  return (
    <div className="space-y-2">
      <PageHeader
        eyebrow="Revenue"
        title="Trailer revenue dashboard"
        description="Revenue by trailer, equipment type, location, customer, lease, deal code, and month."
        actions={
          <>
            <WorkspaceLink href="/reports/revenue" className="btn-secondary">
              Drilldown
            </WorkspaceLink>
            <WorkspaceLink href="/equipment" className="btn-secondary">
              Equipment
            </WorkspaceLink>
          </>
        }
      />

      <PeriodSelector basePath="/revenue" period={view.period} />

      <ReportKpiGrid
        metrics={[
          {
            label: "Gross revenue",
            value: formatCurrency(view.metrics.grossRevenue),
            helper:
              delta === null
                ? "No comparison period"
                : `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}% vs prior period`,
          },
          {
            label: "Average monthly",
            value: formatCurrency(view.metrics.averageMonthlyRevenue),
            helper: `${formatCompactNumber(view.revenueByMonth.length)} months in view`,
          },
          {
            label: "Trailer/equipment revenue",
            value: formatCurrency(view.metrics.fixedAssetRevenue),
            helper: `${formatCompactNumber(view.metrics.equipmentCount)} billed assets`,
          },
          {
            label: "Non-equipment charges",
            value: formatCurrency(view.metrics.nonEquipmentRevenue),
            helper: "Fees, services, taxes, credits, and other lines",
          },
          {
            label: "Invoices",
            value: formatCompactNumber(view.metrics.invoiceCount),
            href: `/ar/invoices?period=${periodParam}`,
            helper: `${formatCompactNumber(view.metrics.lineCount)} billing lines`,
          },
          {
            label: "Tax",
            value: formatCurrency(view.metrics.taxAmount),
            helper: "From billing-line tax amounts",
          },
          {
            label: "Damage waiver",
            value: formatCurrency(view.metrics.damageWaiverAmount),
            helper: "Damage-waiver line attribution",
          },
          {
            label: "Comparison revenue",
            value: formatCurrency(view.metrics.comparisonGrossRevenue),
            helper: "Prior matching period",
          },
        ]}
      />

      <div className="grid gap-2 xl:grid-cols-[1.35fr_0.65fr]">
        <SectionCard
          eyebrow="Trend"
          title="12-month revenue breakdown"
          description="Monthly gross revenue with invoice and equipment counts"
        >
          <BarList
            rows={view.revenueByMonth.map((row) => ({
              key: row.month ?? "unknown-month",
              label: monthLabel(row.month),
              value: row.grossRevenue,
              helper: `${formatCompactNumber(row.invoiceCount)} invoices / ${formatCompactNumber(
                row.equipmentCount,
              )} assets`,
              href: `/reports/revenue?period=${periodParam}&groupBy=month`,
            }))}
            emptyLabel="No monthly revenue rows are available for this period."
          />
        </SectionCard>

        <SectionCard
          eyebrow="Mix"
          title="Line-level revenue mix"
          description="What the billed revenue is made of"
        >
          <RankedRows
            rows={view.lineMix.map((row) => ({
              key: row.lineKind,
              label: titleize(row.lineKind),
              value: formatCurrency(row.totalAmount),
              helper: `${formatCompactNumber(row.lineCount)} lines / gross ${formatCurrency(
                row.grossRevenue,
              )}`,
            }))}
            emptyLabel="No line-mix rows are available for this period."
          />
        </SectionCard>
      </div>

      <div className="grid gap-2 xl:grid-cols-2">
        <SectionCard
          eyebrow="Equipment"
          title="Revenue by trailer type"
          description="Which equipment classes are producing revenue"
        >
          <BarList
            rows={view.revenueByEquipmentType.map((row) => ({
              key: row.assetType,
              label: titleize(row.assetType),
              value: row.grossRevenue,
              helper: `${formatCompactNumber(row.equipmentCount)} assets / ${formatCompactNumber(
                row.invoiceCount,
              )} invoices`,
              href: `/reports/revenue?period=${periodParam}&groupBy=equipment&q=${encodeURIComponent(row.assetType)}`,
            }))}
            emptyLabel="No equipment-type revenue exists for this period."
          />
        </SectionCard>

        <SectionCard
          eyebrow="Location"
          title="Revenue by service location"
          description="Service branch/location attribution from billing lines"
        >
          <BarList
            rows={view.revenueByLocation.map((row) => ({
              key: row.locationCode,
              label: row.locationCode,
              value: row.grossRevenue,
              helper: `${formatCompactNumber(row.invoiceCount)} invoices / ${formatCompactNumber(
                row.lineCount,
              )} lines`,
              href: `/reports/branch-revenue?period=${periodParam}&q=${encodeURIComponent(row.locationCode)}`,
            }))}
            emptyLabel="No location revenue exists for this period."
          />
        </SectionCard>
      </div>

      <div className="grid gap-2 xl:grid-cols-3">
        <SectionCard eyebrow="Trailers" title="Top equipment by revenue">
          <RankedRows
            rows={view.topEquipment.map((row) => ({
              key: row.assetNumber,
              label: row.assetNumber,
              value: formatCurrency(row.grossRevenue),
              helper: `${titleize(row.assetType ?? "unclassified")} / ${formatCompactNumber(
                row.invoiceCount,
              )} invoices`,
              href: `/equipment/${encodeURIComponent(row.assetId ?? row.assetNumber)}`,
            }))}
            emptyLabel="No top-equipment rows are available."
          />
        </SectionCard>

        <SectionCard eyebrow="Customers" title="Top customers by revenue">
          <RankedRows
            rows={view.topCustomers.map((row) => ({
              key: row.customerNumber,
              label: row.customerName || row.customerNumber,
              value: formatCurrency(row.grossRevenue),
              helper: `${row.customerNumber} / ${formatCompactNumber(row.equipmentCount)} assets`,
              href: `/customers/${encodeURIComponent(row.customerNumber)}`,
            }))}
            emptyLabel="No top-customer rows are available."
          />
        </SectionCard>

        <SectionCard eyebrow="Leases" title="Top rental orders by revenue">
          <RankedRows
            rows={view.topLeases.map((row) => ({
              key: row.leaseKey,
              label: row.leaseKey,
              value: formatCurrency(row.grossRevenue),
              helper: `${row.customerName || row.customerNumber || "No customer"} / ${formatCompactNumber(
                row.equipmentCount,
              )} assets`,
              href: `/leases/${encodeURIComponent(row.leaseKey)}`,
            }))}
            emptyLabel="No top-lease rows are available."
          />
        </SectionCard>
      </div>

      <div className="grid gap-2 xl:grid-cols-[0.65fr_0.35fr]">
        <SectionCard
          eyebrow="Deal codes"
          title="Revenue by deal code"
          description="Pricing/program mix behind the revenue"
        >
          <BarList
            rows={view.revenueByDealCode.map((row) => ({
              key: row.dealCode,
              label: row.dealCode,
              value: row.grossRevenue,
              helper: `${formatCompactNumber(row.invoiceCount)} invoices / ${formatCompactNumber(
                row.lineCount,
              )} lines`,
              href: `/reports/deal-code-revenue?period=${periodParam}&q=${encodeURIComponent(row.dealCode)}`,
            }))}
            emptyLabel="No deal-code revenue exists for this period."
          />
        </SectionCard>

        <SectionCard
          eyebrow="Attribution"
          title="Revenue exceptions"
          description="Rows that need better trailer/customer/location attribution"
        >
          <div className="grid gap-px overflow-hidden border border-[var(--line)] bg-[var(--line)]">
            {[
              ["Unmatched asset lines", view.exceptions.unmatchedAssetLines],
              ["Unmatched customer lines", view.exceptions.unmatchedCustomerLines],
              ["Missing location lines", view.exceptions.missingLocationLines],
            ].map(([label, value]) => (
              <div key={String(label)} className="flex items-center justify-between bg-white px-3 py-2">
                <span className="text-[0.75rem] text-slate-500">{label}</span>
                <span className="mono text-sm font-semibold text-slate-900">
                  {formatCompactNumber(Number(value))}
                </span>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

function BarList({
  rows,
  emptyLabel,
}: {
  rows: Array<{
    key: string;
    label: string;
    value: number;
    helper?: string;
    href?: string;
  }>;
  emptyLabel: string;
}) {
  const max = Math.max(0, ...rows.map((row) => row.value));

  if (rows.length === 0) {
    return <p className="text-[0.75rem] text-slate-500">{emptyLabel}</p>;
  }

  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <div key={row.key} className="space-y-1">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              {row.href ? (
                <WorkspaceLink
                  href={row.href}
                  className="truncate text-[0.78rem] font-semibold text-[var(--brand)]"
                >
                  {row.label}
                </WorkspaceLink>
              ) : (
                <p className="truncate text-[0.78rem] font-semibold text-slate-900">{row.label}</p>
              )}
              {row.helper ? <p className="text-[0.65rem] text-slate-400">{row.helper}</p> : null}
            </div>
            <span className="mono shrink-0 text-[0.78rem] font-semibold text-slate-900">
              {formatCurrency(row.value)}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-slate-900"
              style={{ width: `${barWidth(row.value, max)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function RankedRows({
  rows,
  emptyLabel,
}: {
  rows: Array<{
    key: string;
    label: string;
    value: string;
    helper?: string;
    href?: string;
  }>;
  emptyLabel: string;
}) {
  if (rows.length === 0) {
    return <p className="text-[0.75rem] text-slate-500">{emptyLabel}</p>;
  }

  return (
    <div className="divide-y divide-[var(--line)]">
      {rows.map((row, index) => (
        <div key={row.key} className="flex items-start justify-between gap-3 py-2 first:pt-0 last:pb-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="mono text-[0.65rem] text-slate-400">#{index + 1}</span>
              {row.href ? (
                <WorkspaceLink
                  href={row.href}
                  className="truncate text-[0.78rem] font-semibold text-[var(--brand)]"
                >
                  {row.label}
                </WorkspaceLink>
              ) : (
                <p className="truncate text-[0.78rem] font-semibold text-slate-900">{row.label}</p>
              )}
            </div>
            {row.helper ? <p className="mt-0.5 text-[0.65rem] text-slate-400">{row.helper}</p> : null}
          </div>
          <span className="mono shrink-0 text-[0.78rem] font-semibold text-slate-900">{row.value}</span>
        </div>
      ))}
    </div>
  );
}

function barWidth(value: number, max: number) {
  if (max <= 0 || value <= 0) {
    return 0;
  }
  return Math.max(3, Math.round((value / max) * 100));
}

function monthLabel(value: string | null) {
  return value ? formatDate(value).replace(/\s\d{1,2},/, "") : "n/a";
}

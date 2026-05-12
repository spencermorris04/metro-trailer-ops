import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import {
  formatCompactNumber,
  formatCurrency,
  formatDate,
  titleize,
} from "@/lib/format";
import {
  getTrailerRevenueDashboardView,
} from "@/lib/server/platform";

export default async function FinancialPage() {
  const trailerRevenue = await getTrailerRevenueDashboardView();

  return (
    <div className="space-y-2">
      <PageHeader
        eyebrow="Accounting"
        title="Trailer revenue and accounting"
        description="Trailer-based rental revenue from BC/RMI posted rental lines, AR from customer ledger entries, and app-native accounting readiness."
        actions={
          <>
            <Link href="/ar/invoices" className="btn-secondary">
              AR invoices
            </Link>
            <Link href="/equipment" className="btn-secondary">
              Equipment
            </Link>
            <Link href="/integrations/business-central" className="btn-secondary">
              BC admin
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-4 gap-px border border-[var(--line)] bg-[var(--line)]">
        {[
          ["Rental revenue", formatCurrency(trailerRevenue.metrics.grossRevenue)],
          ["Rental invoices", formatCompactNumber(trailerRevenue.metrics.invoiceCount)],
          ["Equipment billed", formatCompactNumber(trailerRevenue.metrics.equipmentCount)],
          ["Leases/orders", formatCompactNumber(trailerRevenue.metrics.leaseCount)],
          ["Open AR", formatCurrency(trailerRevenue.arAging.reduce((sum, row) => sum + (row.bucket === "Closed" ? 0 : row.balance), 0))],
          ["Credit memos", formatCompactNumber(trailerRevenue.metrics.creditMemoCount)],
          ["Tax", formatCurrency(trailerRevenue.metrics.taxAmount)],
          ["Damage waiver", formatCurrency(trailerRevenue.metrics.damageWaiverAmount)],
        ].map(([label, value]) => (
          <div key={label} className="bg-white px-3 py-2">
            <p className="workspace-metric-label">{label}</p>
            <p className="text-base font-semibold text-slate-900">{value}</p>
          </div>
        ))}
      </div>

      {trailerRevenue.degraded ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[0.75rem] text-amber-900">
          Some BC/RMI accounting aggregates timed out, so this page is showing a safe
          degraded dashboard instead of failing the request.
        </div>
      ) : null}

      <div className="grid gap-2 xl:grid-cols-2">
        <SectionCard
          eyebrow="Revenue"
          title="Trailer revenue by month"
          description="Primary historical revenue view. Source is BC/RMI posted rental lines, not customer billing geography."
        >
          <div className="divide-y divide-[var(--line)]">
            {trailerRevenue.revenueByMonth.map((row) => (
              <div key={row.month} className="flex items-center justify-between py-1.5">
                <div>
                  <div className="font-semibold text-slate-900">
                    {row.month ? formatDate(row.month) : "Unknown month"}
                  </div>
                  <div className="text-[0.65rem] text-slate-400">
                    {formatCompactNumber(row.invoiceCount)} invoices /{" "}
                    {formatCompactNumber(row.equipmentCount)} equipment
                  </div>
                </div>
                <div className="font-semibold text-slate-900">
                  {formatCurrency(row.grossRevenue)}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          eyebrow="Equipment"
          title="Revenue by equipment type"
          description="Use this to validate whether trailer/container classes are carrying revenue correctly."
        >
          <div className="divide-y divide-[var(--line)]">
            {trailerRevenue.revenueByEquipmentType.map((row) => (
              <div key={row.equipmentType} className="flex items-center justify-between py-1.5">
                <div>
                  <div className="font-semibold text-slate-900">
                    {titleize(row.equipmentType)}
                  </div>
                  <div className="text-[0.65rem] text-slate-400">
                    {formatCompactNumber(row.equipmentCount)} equipment /{" "}
                    {formatCompactNumber(row.lineCount)} lines
                  </div>
                </div>
                <div className="font-semibold text-slate-900">
                  {formatCurrency(row.grossRevenue)}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-2 xl:grid-cols-3">
        <SectionCard eyebrow="Branch" title="Revenue by service branch">
          <div className="divide-y divide-[var(--line)]">
            {trailerRevenue.revenueByBranch.map((row) => (
              <div key={row.branchCode} className="flex items-center justify-between py-1.5">
                <div>
                  <div className="font-semibold text-slate-900">{row.branchCode}</div>
                  <div className="text-[0.65rem] text-slate-400">
                    {formatCompactNumber(row.lineCount)} lines
                  </div>
                </div>
                <div className="font-semibold text-slate-900">
                  {formatCurrency(row.grossRevenue)}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard eyebrow="Customer" title="Top revenue customers">
          <div className="divide-y divide-[var(--line)]">
            {trailerRevenue.revenueByCustomer.map((row) => (
              <div key={row.customerNumber} className="flex items-center justify-between gap-3 py-1.5">
                <div className="min-w-0">
                  <Link
                    href={`/customers/${row.customerNumber}`}
                    className="font-semibold text-[var(--brand)]"
                  >
                    {row.customerName ?? row.customerNumber}
                  </Link>
                  <div className="mono text-[0.65rem] text-slate-400">
                    {row.customerNumber} / {formatCompactNumber(row.invoiceCount)} invoices
                  </div>
                </div>
                <div className="font-semibold text-slate-900">
                  {formatCurrency(row.grossRevenue)}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard eyebrow="Deal Code" title="Revenue by deal code">
          <div className="divide-y divide-[var(--line)]">
            {trailerRevenue.revenueByDealCode.map((row) => (
              <div key={row.dealCode} className="flex items-center justify-between py-1.5">
                <div>
                  <div className="font-semibold text-slate-900">{row.dealCode}</div>
                  <div className="text-[0.65rem] text-slate-400">
                    {formatCompactNumber(row.lineCount)} lines
                  </div>
                </div>
                <div className="font-semibold text-slate-900">
                  {formatCurrency(row.grossRevenue)}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-2 xl:grid-cols-2">
        <SectionCard eyebrow="Lease / Order" title="Top rental orders by billed revenue">
          <div className="data-table">
            <table>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Invoices</th>
                  <th>Equipment</th>
                  <th>Revenue</th>
                </tr>
              </thead>
              <tbody>
                {trailerRevenue.revenueByLease.map((row) => (
                  <tr key={row.leaseKey}>
                    <td>
                      <Link href={`/leases/${row.leaseKey}`} className="font-semibold text-[var(--brand)]">
                        {row.leaseKey}
                      </Link>
                    </td>
                    <td>{row.customerName ?? row.customerNumber ?? "-"}</td>
                    <td>{formatCompactNumber(row.invoiceCount)}</td>
                    <td>{formatCompactNumber(row.equipmentCount)}</td>
                    <td className="font-semibold text-slate-900">
                      {formatCurrency(row.grossRevenue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard eyebrow="AR" title="Customer ledger aging">
          <div className="divide-y divide-[var(--line)]">
            {trailerRevenue.arAging.map((row) => (
              <div key={row.bucket} className="flex items-center justify-between py-1.5">
                <div>
                  <div className="font-semibold text-slate-900">{row.bucket}</div>
                  <div className="text-[0.65rem] text-slate-400">
                    {formatCompactNumber(row.entryCount)} ledger rows
                  </div>
                </div>
                <div className="font-semibold text-slate-900">
                  {formatCurrency(row.balance)}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-2 xl:grid-cols-2">
        <SectionCard eyebrow="Rental Ledger" title="Recent rental activity">
          <div className="data-table">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Invoice</th>
                  <th>Order</th>
                  <th>Equipment</th>
                  <th>Deal</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {trailerRevenue.recentRentalActivity.map((entry) => (
                  <tr key={entry.entryNo}>
                    <td>{entry.postingDate ? formatDate(entry.postingDate) : "Unknown"}</td>
                    <td>
                      {entry.documentNo ? (
                        <Link href={`/ar/invoices/${entry.documentNo}`} className="text-[var(--brand)]">
                          {entry.documentNo}
                        </Link>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td>
                      {entry.orderNo ? (
                        <Link href={`/leases/${entry.orderNo}`} className="text-[var(--brand)]">
                          {entry.orderNo}
                        </Link>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td>
                      {entry.equipmentNo ? (
                        <Link href={`/equipment/${entry.equipmentNo}`} className="text-[var(--brand)]">
                          {entry.equipmentNo}
                        </Link>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td>{entry.dealCode ?? "-"}</td>
                    <td className="font-semibold text-slate-900">
                      {formatCurrency(entry.grossAmount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard
          eyebrow="Exceptions"
          title="Migration and attribution checks"
          description="These counts identify where BC/RMI history does not yet resolve cleanly into app-native business objects."
        >
          <div className="grid grid-cols-2 gap-px border border-[var(--line)] bg-[var(--line)]">
            {[
              ["Invoice lines without asset", trailerRevenue.exceptions.unmatchedAssetLines],
              ["Invoices without customer", trailerRevenue.exceptions.unmatchedCustomerInvoices],
              ["Lines missing dimensions", trailerRevenue.exceptions.missingDimensionLines],
              ["BC import errors", 0],
            ].map(([label, value]) => (
              <div key={label} className="bg-white px-3 py-2">
                <p className="workspace-metric-label">{label}</p>
                <p className="text-base font-semibold text-slate-900">
                  {formatCompactNumber(Number(value))}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-2 rounded-md border border-[var(--line)] bg-[var(--surface-soft)] px-3 py-2 text-[0.75rem] text-slate-600">
            App-native commercial events and GL journals remain separate from imported BC
            history. Historical revenue is read from BC/RMI lines until a deliberate migration
            maps it into app-native ledgers.
          </div>
        </SectionCard>
      </div>

      <SectionCard eyebrow="App-Native Accounting" title="Current-system posting readiness">
        <div className="grid grid-cols-4 gap-px border border-[var(--line)] bg-[var(--line)]">
          {[
            ["Uninvoiced events", 0],
            ["Open app AR", 0],
            ["Open app AP", 0],
            ["Posted app journals", 0],
          ].map(([label, value]) => (
            <div key={label} className="bg-white px-3 py-2">
              <p className="workspace-metric-label">{label}</p>
              <p className="text-base font-semibold text-slate-900">
                {formatCompactNumber(Number(value))}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <Link href="/ar/invoices" className="btn-secondary">
            AR register
          </Link>
          <Link href="/ap/bills" className="btn-secondary">
            AP / Vendors
          </Link>
          <Link href="/gl/accounts" className="btn-secondary">
            GL accounts
          </Link>
          <Link href="/gl/journal" className="btn-secondary">
            GL journal
          </Link>
        </div>
      </SectionCard>
    </div>
  );
}

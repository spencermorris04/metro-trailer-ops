import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import { formatCurrency, formatDate, titleize } from "@/lib/format";
import {
  getAssetsOverviewView,
  getFinancialDashboardView,
  getInvoiceRegisterView,
} from "@/lib/server/platform";


export default async function FinancialPage() {
  const [dashboard, rentalOverview, bcInvoices] = await Promise.all([
    getFinancialDashboardView(),
    getAssetsOverviewView(),
    getInvoiceRegisterView({ source: "business_central", page: 1, pageSize: 12 }),
  ]);

  return (
    <div className="space-y-2">
      <PageHeader
        eyebrow="Accounting"
        title="Finance overview"
        description="Commercial events, subledger balances, general ledger posture, and BC reconciliation exceptions."
        actions={
          <>
            <Link href="/ar/invoices" className="btn-secondary">
              AR
            </Link>
            <Link href="/gl/journal" className="btn-secondary">
              GL journal
            </Link>
            <Link href="/integrations/business-central" className="btn-secondary">
              BC admin
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-4 gap-px border border-[var(--line)] bg-[var(--line)]">
        {[
          {
            label: "Uninvoiced events",
            value: dashboard.metrics.uninvoicedCommercialEvents,
            sub: formatCurrency(dashboard.metrics.uninvoicedCommercialAmount),
          },
          {
            label: "App open AR",
            value: dashboard.metrics.openArInvoices,
            sub: formatCurrency(dashboard.metrics.openArBalance),
          },
          {
            label: "BC posted invoices",
            value: rentalOverview.metrics.bcInvoiceHeaders,
            sub: "Historical, read-only",
          },
          {
            label: "BC AR ledger",
            value: rentalOverview.metrics.bcCustomerLedgerEntries,
            sub: "Required for historical open AR",
          },
          {
            label: "Unapplied receipts",
            value: dashboard.metrics.unappliedReceipts,
            sub: formatCurrency(dashboard.metrics.unappliedReceiptAmount),
          },
          {
            label: "Open AP",
            value: dashboard.metrics.openApBills,
            sub: formatCurrency(dashboard.metrics.openApBalance),
          },
          {
            label: "Posted journals",
            value: dashboard.metrics.postedJournals,
            sub: formatCurrency(dashboard.metrics.currentTrialBalanceDelta),
          },
          {
            label: "BC import errors",
            value: dashboard.metrics.bcImportErrors,
            sub: dashboard.bcOverview.latestRun?.status ?? "No run",
          },
        ].map((metric) => (
          <div key={metric.label} className="bg-white px-3 py-2">
            <p className="workspace-metric-label">{metric.label}</p>
            <p className="text-lg font-semibold text-slate-900">{metric.value}</p>
            <p className="text-[0.65rem] text-slate-400">{metric.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-2 xl:grid-cols-2">
        <SectionCard
          eyebrow="Commercial"
          title="Operational billing events"
          description="Commercial events stay operational; they do not represent posted accounting on their own."
        >
          <div className="divide-y divide-[var(--line)]">
            {dashboard.commercialEvents.map((event) => (
              <div key={event.id} className="flex items-center justify-between gap-3 py-1.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="mono text-[0.65rem] text-slate-500">
                      {event.contractNumber}
                    </span>
                    <StatusPill label={titleize(event.eventType)} />
                  </div>
                  <div className="text-[0.75rem] text-slate-700">{event.description}</div>
                  <div className="text-[0.65rem] text-slate-400">
                    {formatDate(event.eventDate)} / {event.sourceDocumentType ?? "No source doc"}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-slate-900">
                    {formatCurrency(event.amount)}
                  </div>
                  <div className="text-[0.65rem] text-slate-400">
                    {event.invoiceNumber ?? "Uninvoiced"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          eyebrow="Subledger"
          title="AR and AP posture"
          description="App-native invoices, receipts, and bills. BC history stays separate."
        >
          <div className="grid gap-3">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="workspace-section-label">BC posted invoices</span>
                <Link href="/ar/invoices" className="text-[var(--brand)]">
                  Open
                </Link>
              </div>
              <div className="divide-y divide-[var(--line)]">
                {bcInvoices.data.map((invoice) => (
                  <div key={invoice.id} className="flex items-center justify-between py-1.5">
                    <div>
                      <div className="mono text-[0.65rem] text-slate-500">
                        <Link href={`/ar/invoices/${invoice.invoiceNumber}`} className="text-[var(--brand)]">
                          {invoice.invoiceNumber}
                        </Link>
                      </div>
                      <div className="text-[0.75rem] text-slate-700">
                        {invoice.customerName}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-slate-900">
                        {formatCurrency(invoice.totalAmount)}
                      </div>
                      <div className="text-[0.65rem] text-slate-400">
                        {titleize(invoice.status)} / Balance pending
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="workspace-section-label">AP bills</span>
                <Link href="/ap/bills" className="text-[var(--brand)]">
                  Open
                </Link>
              </div>
              <div className="divide-y divide-[var(--line)]">
                {dashboard.apBills.map((bill) => (
                  <div key={bill.id} className="flex items-center justify-between py-1.5">
                    <div>
                      <div className="mono text-[0.65rem] text-slate-500">
                        {bill.billNumber}
                      </div>
                      <div className="text-[0.75rem] text-slate-700">{bill.vendorName}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-slate-900">
                        {formatCurrency(bill.balanceAmount)}
                      </div>
                      <div className="text-[0.65rem] text-slate-400">
                        {titleize(bill.status)} / {bill.dueDate ? formatDate(bill.dueDate) : "No due date"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-2 xl:grid-cols-2">
        <SectionCard
          eyebrow="General Ledger"
          title="Recent journal entries"
          description="Posted accounting is shown here, not in the commercial event stream."
        >
          <div className="divide-y divide-[var(--line)]">
            {dashboard.journals.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between gap-3 py-1.5">
                <div>
                  <div className="mono text-[0.65rem] text-slate-500">
                    {entry.entryNumber}
                  </div>
                  <div className="text-[0.75rem] text-slate-700">{entry.description}</div>
                  <div className="text-[0.65rem] text-slate-400">
                    {entry.entryDate ? formatDate(entry.entryDate) : "No entry date"} / {entry.sourceType ?? "manual"}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-slate-900">
                    {formatCurrency(entry.debitTotal)} / {formatCurrency(entry.creditTotal)}
                  </div>
                  <StatusPill label={titleize(entry.status)} />
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          eyebrow="BC Reconciliation"
          title="Imported history and exceptions"
          description="Business Central remains history and fallback while app-native records become the source of truth."
        >
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-px border border-[var(--line)] bg-[var(--line)]">
              {[
                ["Assets", dashboard.bcOverview.metrics.assets],
                ["Customers", dashboard.bcOverview.metrics.customers],
                ["Contracts", dashboard.bcOverview.metrics.contracts],
                ["Invoices", dashboard.bcOverview.metrics.invoices],
                ["Source docs", dashboard.bcOverview.metrics.sourceDocuments],
                ["BC GL rows", dashboard.bcOverview.metrics.bcGlEntries],
              ].map(([label, value]) => (
                <div key={label} className="bg-white px-3 py-2">
                  <p className="workspace-metric-label">{label}</p>
                  <p className="text-base font-semibold text-slate-900">{value}</p>
                </div>
              ))}
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="workspace-section-label">Recent import errors</span>
                <Link
                  href="/integrations/business-central/import-errors"
                  className="text-[var(--brand)]"
                >
                  Open
                </Link>
              </div>
              <div className="divide-y divide-[var(--line)]">
                {dashboard.bcOverview.recentErrors.slice(0, 6).map((error) => (
                  <div key={error.id} className="py-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="mono text-[0.65rem] text-slate-500">
                        {error.entityType}
                      </span>
                      <StatusPill label={error.errorCode} />
                    </div>
                    <div className="text-[0.75rem] text-slate-700">{error.message}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

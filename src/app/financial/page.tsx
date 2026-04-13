import { JsonActionButton } from "@/components/json-action-button";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  listFinancialEvents,
  listInvoices,
} from "@/lib/server/platform-service";

export const dynamic = "force-dynamic";

export default function FinancialPage() {
  const events = listFinancialEvents();
  const invoices = listInvoices();

  return (
    <>
      <PageHeader
        eyebrow="Phase 2 and Phase 6"
        title="Pricing, invoices, payments, and reconciliation flows"
        description="Financial events become invoices, QuickBooks sync jobs, Stripe payment intents, and collections context without forcing operations to work inside the accounting system."
      />

      <SectionCard
        eyebrow="Event Ledger"
        title="Financial events"
        description="Operational facts like rent, delivery, pickup, credits, and damage stay visible before and after invoicing."
      >
        <div className="grid gap-4 xl:grid-cols-4">
          {events.map((event) => (
            <div key={event.id} className="soft-panel p-5">
              <StatusPill label={event.eventType} />
              <p className="mt-4 text-lg font-semibold text-slate-900">
                {event.contractNumber}
              </p>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                {event.description}
              </p>
              <p className="mt-3 text-sm font-semibold text-slate-900">
                {formatCurrency(event.amount)}
              </p>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Invoices"
        title="Invoice lifecycle"
        description="Invoices can be generated from contract activity, sent for accounting sync, converted to PDF, and updated as payments land."
      >
        <div className="grid gap-4 xl:grid-cols-2">
          {invoices.map((invoice) => (
            <div key={invoice.id} className="soft-panel p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="mono text-xs uppercase tracking-[0.18em] text-slate-500">
                    {invoice.invoiceNumber}
                  </p>
                  <h3 className="mt-2 text-lg font-semibold text-slate-900">
                    {invoice.customerName}
                  </h3>
                </div>
                <StatusPill label={invoice.status} />
              </div>
              <div className="mt-4 space-y-2 text-sm text-slate-600">
                <p>Contract: {invoice.contractNumber}</p>
                <p>Invoice date: {formatDate(invoice.invoiceDate)}</p>
                <p>Due date: {formatDate(invoice.dueDate)}</p>
                <p>Balance: {formatCurrency(invoice.balanceAmount)}</p>
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                <JsonActionButton
                  endpoint={`/api/invoices/${invoice.id}/send`}
                  label="Send invoice"
                  body={{}}
                />
                <a
                  href={`/api/invoices/${invoice.id}/pdf`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-[rgba(19,35,45,0.12)] bg-white px-4 py-2 text-sm font-semibold text-slate-800"
                >
                  View PDF
                </a>
                {invoice.balanceAmount > 0 ? (
                  <JsonActionButton
                    endpoint={`/api/invoices/${invoice.id}/pay`}
                    label="Record payment"
                    body={{ amount: Math.min(invoice.balanceAmount, 500) }}
                    variant="light"
                  />
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </>
  );
}

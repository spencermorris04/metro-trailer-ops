import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import { formatCurrency, formatDate, titleize } from "@/lib/format";
import { getFinancialOverview } from "@/lib/server/platform";

export const dynamic = "force-dynamic";

export default async function FinancialPage() {
  const overview = await getFinancialOverview();

  return (
    <>
      <PageHeader
        eyebrow="Unified Commercial State"
        title="Finance, inventory, invoicing, and e-sign now move on one contract spine"
        description="Commercial health is derived per contract so the team can see what is blocking execution, what is ready to bill, what is sitting in receivables, and what can be closed without cross-checking four systems by hand."
      />

      <SectionCard
        eyebrow="Commercial Posture"
        title="Contract-centric metrics"
        description="These counts come from the same derived contract-commercial state used by the service layer."
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <MetricCard
            label="Awaiting signature"
            value={String(overview.metrics.awaitingSignature)}
            detail="Contracts with an active e-sign packet still blocking execution."
          />
          <MetricCard
            label="Ready to invoice"
            value={String(overview.metrics.readyToInvoice)}
            detail={`${formatCurrency(overview.metrics.uninvoicedEventAmount)} of posted activity is still uninvoiced.`}
          />
          <MetricCard
            label="Open receivables"
            value={String(overview.metrics.openReceivables)}
            detail={`${formatCurrency(overview.metrics.outstandingBalance)} remains outstanding across open contracts.`}
          />
          <MetricCard
            label="Ready to close"
            value={String(overview.metrics.readyToClose)}
            detail="Completed contracts with clean billing and no remaining contract-controlled holds."
          />
          <MetricCard
            label="Contracts tracked"
            value={String(overview.metrics.contractCount)}
            detail="Every contract carries its own signature, billing, and closeout posture."
          />
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Exception Queues"
        title="Where commercial work is stuck"
        description="Each queue is derived from contract state rather than separate invoice or signature lists."
      >
        <div className="grid gap-4 xl:grid-cols-2">
          <QueueCard
            title="Awaiting Signature"
            emptyMessage="No contracts are waiting on signer action."
            contracts={overview.queues.awaitingSignature}
          />
          <QueueCard
            title="Ready To Invoice"
            emptyMessage="No posted contract activity is waiting for invoicing."
            contracts={overview.queues.readyToInvoice}
          />
          <QueueCard
            title="Open Receivables"
            emptyMessage="No contract currently has outstanding receivables."
            contracts={overview.queues.openReceivables}
          />
          <QueueCard
            title="Ready To Close"
            emptyMessage="No completed contract is fully reconciled yet."
            contracts={overview.queues.readyToClose}
          />
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Latest Contracts"
        title="Unified commercial ledger"
        description="This table shows the combined signature, invoice, inventory-closeout, and receivables posture for each agreement."
      >
        <div className="data-table">
          <table>
            <thead>
              <tr>
                <th>Contract</th>
                <th>Status</th>
                <th>Signature</th>
                <th>Commercial stage</th>
                <th>Invoices</th>
                <th>Outstanding</th>
                <th>Next action</th>
              </tr>
            </thead>
            <tbody>
              {overview.contracts.map((contract) => (
                <tr key={contract.id}>
                  <td>
                    <p className="font-semibold text-slate-900">
                      {contract.contractNumber}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {contract.customerName} at {contract.locationName}
                    </p>
                  </td>
                  <td>
                    <StatusPill label={titleize(contract.status)} />
                  </td>
                  <td className="text-sm text-slate-700">
                    {titleize(contract.signatureStatus ?? "not_requested")}
                  </td>
                  <td className="text-sm text-slate-700">
                    {titleize(contract.commercialStage ?? "quote_draft")}
                  </td>
                  <td className="text-sm text-slate-700">
                    <p>{contract.invoiceCount ?? 0} total</p>
                    <p className="mt-1 text-slate-500">
                      {(contract.uninvoicedEventCount ?? 0) > 0
                        ? `${contract.uninvoicedEventCount} posted events pending invoice`
                        : `${contract.openInvoiceCount ?? 0} open invoices`}
                    </p>
                  </td>
                  <td className="text-sm font-semibold text-slate-900">
                    {formatCurrency(contract.outstandingBalance ?? 0)}
                  </td>
                  <td className="text-sm text-slate-600">
                    {contract.nextAction ?? "No immediate commercial action."}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard
          eyebrow="Recent Invoices"
          title="Invoice stream"
          description="The invoice list now reads in the context of the contract-commercial state above."
        >
          <div className="space-y-3">
            {overview.invoices.map((invoice) => (
              <div key={invoice.id} className="soft-panel p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="mono text-[0.68rem] uppercase tracking-[0.12em] text-slate-500">
                      {invoice.invoiceNumber}
                    </p>
                    <h3 className="mt-2 text-base font-semibold text-slate-900">
                      {invoice.customerName}
                    </h3>
                  </div>
                  <StatusPill label={titleize(invoice.status)} />
                </div>
                <div className="mt-3 text-sm leading-6 text-slate-600">
                  <p>Contract: {invoice.contractNumber}</p>
                  <p>Invoice date: {formatDate(invoice.invoiceDate)}</p>
                  <p>Due date: {formatDate(invoice.dueDate)}</p>
                  <p>Balance: {formatCurrency(invoice.balanceAmount)}</p>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          eyebrow="Recent Events"
          title="Posted financial activity"
          description="Operations and accounting still reconcile through the event ledger, but now the contract surface shows the resulting billing posture directly."
        >
          <div className="space-y-3">
            {overview.recentEvents.map((event) => (
              <div key={event.id} className="soft-panel p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {event.contractNumber}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">{event.description}</p>
                  </div>
                  <StatusPill label={titleize(event.eventType)} />
                </div>
                <div className="mt-3 text-sm text-slate-600">
                  <p>Date: {formatDate(event.eventDate)}</p>
                  <p>Amount: {formatCurrency(event.amount)}</p>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </>
  );
}

function MetricCard(props: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="soft-panel p-5">
      <p className="mono text-[0.68rem] uppercase tracking-[0.12em] text-slate-500">
        {props.label}
      </p>
      <p className="mt-4 text-3xl font-semibold text-slate-900">{props.value}</p>
      <p className="mt-3 text-sm leading-6 text-slate-600">{props.detail}</p>
    </div>
  );
}

function QueueCard(props: {
  title: string;
  emptyMessage: string;
  contracts: Awaited<ReturnType<typeof getFinancialOverview>>["queues"]["awaitingSignature"];
}) {
  return (
    <div className="soft-panel p-5">
      <p className="text-sm font-semibold text-slate-900">{props.title}</p>
      <div className="mt-4 space-y-3">
        {props.contracts.length === 0 ? (
          <p className="text-sm text-slate-500">{props.emptyMessage}</p>
        ) : (
          props.contracts.map((contract) => (
            <div key={contract.id} className="rounded-xl border border-[var(--line)] bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-900">{contract.contractNumber}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {contract.customerName}
                  </p>
                </div>
                <StatusPill label={titleize(contract.commercialStage ?? contract.status)} />
              </div>
              <p className="mt-3 text-sm text-slate-600">
                {contract.nextAction ?? "No immediate action."}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

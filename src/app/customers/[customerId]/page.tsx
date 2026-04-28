import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import { formatCurrency, formatDate, titleize } from "@/lib/format";
import { getCustomerDetailView } from "@/lib/server/platform";

export const dynamic = "force-dynamic";

type CustomerDetailPageProps = {
  params: Promise<{
    customerId: string;
  }>;
};

export default async function CustomerDetailPage({ params }: CustomerDetailPageProps) {
  const { customerId } = await params;
  const detail = await getCustomerDetailView(customerId);

  if (!detail) {
    notFound();
  }

  const { summary } = detail;

  return (
    <div className="space-y-2">
      <PageHeader
        eyebrow="Operations"
        title={summary.name}
        description="Customer summary with sites, contracts, invoices, receipts, and BC lineage."
        actions={
          <>
            <Link href="/customers" className="btn-secondary">
              Back to customers
            </Link>
            <Link href="/ar/invoices" className="btn-secondary">
              AR invoices
            </Link>
          </>
        }
      />

      <div className="grid gap-2 xl:grid-cols-3">
        <SectionCard eyebrow="Summary" title="Account identity" className="xl:col-span-2">
          <div className="grid gap-3 md:grid-cols-4">
            <div>
              <p className="workspace-metric-label">Customer number</p>
              <p className="text-sm font-semibold text-slate-900">{summary.customerNumber}</p>
            </div>
            <div>
              <p className="workspace-metric-label">Type</p>
              <p className="text-sm font-semibold text-slate-900">
                {titleize(summary.customerType)}
              </p>
            </div>
            <div>
              <p className="workspace-metric-label">Billing city</p>
              <p className="text-sm font-semibold text-slate-900">{summary.billingCity}</p>
            </div>
            <div>
              <p className="workspace-metric-label">Portal</p>
              <StatusPill label={summary.portalEnabled ? "Enabled" : "Disabled"} />
            </div>
          </div>
        </SectionCard>

        <SectionCard eyebrow="Commercial" title="Current exposure">
          <div className="space-y-2">
            <div>
              <p className="workspace-metric-label">Contracts</p>
              <p className="text-lg font-semibold text-slate-900">{summary.contractCount}</p>
            </div>
            <div>
              <p className="workspace-metric-label">AR balance</p>
              <p className="text-lg font-semibold text-slate-900">
                {formatCurrency(summary.arBalance)}
              </p>
            </div>
            <div className="text-[0.75rem] text-slate-500">
              Source: {titleize(summary.sourceProvider.replaceAll("_", " "))}
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-2 xl:grid-cols-2">
        <SectionCard eyebrow="Locations" title="Customer locations">
          <div className="divide-y divide-[var(--line)]">
            {summary.locations.map((location) => (
              <div key={location.id} className="py-1.5">
                <div className="text-[0.8rem] font-semibold text-slate-900">{location.name}</div>
                <div className="text-[0.75rem] text-slate-600">{location.address}</div>
                <div className="text-[0.65rem] text-slate-400">
                  {location.contactPerson || "No contact person"}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard eyebrow="Lineage" title="BC source context">
          <div className="space-y-2 text-[0.75rem] text-slate-600">
            <div>Source provider: {titleize(summary.sourceProvider.replaceAll("_", " "))}</div>
            <div>External BC id: {summary.externalId ?? "None"}</div>
            <details className="rounded-md border border-[var(--line)] bg-[var(--surface-soft)] p-2">
              <summary className="cursor-pointer font-semibold text-slate-800">
                Raw BC payload
              </summary>
              <pre className="mt-2 overflow-x-auto text-[0.65rem] text-slate-600">
                {JSON.stringify(summary.sourcePayload ?? {}, null, 2)}
              </pre>
            </details>
          </div>
        </SectionCard>
      </div>

      <SectionCard eyebrow="Contracts" title="Commercial history">
        <div className="data-table">
          <table>
            <thead>
              <tr>
                <th>Contract</th>
                <th>Branch</th>
                <th>Dates</th>
                <th>Status</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              {detail.contracts.map((contract) => (
                <tr key={contract.id}>
                  <td>
                    <Link href={`/contracts/${contract.id}`} className="font-semibold text-[var(--brand)]">
                      {contract.contractNumber}
                    </Link>
                  </td>
                  <td>{contract.branch}</td>
                  <td>
                    {formatDate(contract.startDate)}
                    <br />
                    <span className="text-[0.65rem] text-slate-400">
                      {contract.endDate ? formatDate(contract.endDate) : "Open"}
                    </span>
                  </td>
                  <td><StatusPill label={titleize(contract.status)} /></td>
                  <td>{formatCurrency(contract.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <div className="grid gap-2 xl:grid-cols-2">
        <SectionCard eyebrow="Invoices" title="AR invoices">
          <div className="divide-y divide-[var(--line)]">
            {detail.invoices.map((invoice) => (
              <div key={invoice.id} className="flex items-center justify-between py-1.5">
                <div>
                  <div className="mono text-[0.65rem] text-slate-500">
                    {invoice.invoiceNumber}
                  </div>
                  <div className="text-[0.75rem] text-slate-700">
                    {invoice.contractNumber}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-slate-900">
                    {formatCurrency(invoice.balanceAmount)}
                  </div>
                  <div className="text-[0.65rem] text-slate-400">
                    {titleize(invoice.status)} / {formatDate(invoice.dueDate)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard eyebrow="Receipts" title="Cash applications">
          <div className="divide-y divide-[var(--line)]">
            {detail.receipts.map((receipt) => (
              <div key={receipt.id} className="flex items-center justify-between py-1.5">
                <div>
                  <div className="mono text-[0.65rem] text-slate-500">
                    {receipt.receiptNumber}
                  </div>
                  <div className="text-[0.75rem] text-slate-700">
                    {formatDate(receipt.receiptDate)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-slate-900">
                    {formatCurrency(receipt.amount)}
                  </div>
                  <div className="text-[0.65rem] text-slate-400">
                    Unapplied {formatCurrency(receipt.unappliedAmount)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

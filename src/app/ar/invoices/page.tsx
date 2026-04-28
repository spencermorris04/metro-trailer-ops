import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import { formatCurrency, formatDate, titleize } from "@/lib/format";
import { getArInvoicesView } from "@/lib/server/platform";

export const dynamic = "force-dynamic";

export default async function ArInvoicesPage() {
  const invoices = await getArInvoicesView();

  return (
    <div className="space-y-2">
      <PageHeader
        eyebrow="Accounting"
        title="AR invoices"
        description="App-native receivables invoices with source-aware BC lineage."
      />
      <SectionCard eyebrow="Accounts Receivable" title="Invoice register">
        <div className="data-table">
          <table>
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Customer</th>
                <th>Contract</th>
                <th>Status</th>
                <th>Dates</th>
                <th>Source</th>
                <th>Balance</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice.id}>
                  <td>{invoice.invoiceNumber}</td>
                  <td>{invoice.customerName}</td>
                  <td>{invoice.contractNumber}</td>
                  <td><StatusPill label={titleize(invoice.status)} /></td>
                  <td>
                    {formatDate(invoice.invoiceDate)}
                    <br />
                    <span className="text-[0.65rem] text-slate-400">
                      Due {formatDate(invoice.dueDate)}
                    </span>
                  </td>
                  <td className="text-[0.7rem] text-slate-500">
                    {invoice.sourceProvider}
                    <br />
                    {invoice.sourceDocumentType ?? "-"} / {invoice.sourceDocumentNo ?? "-"}
                  </td>
                  <td className="font-semibold text-slate-900">
                    {formatCurrency(invoice.balanceAmount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

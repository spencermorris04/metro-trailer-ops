import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import { formatCurrency, formatDate, titleize } from "@/lib/format";
import { getArReceiptsView } from "@/lib/server/platform";

export const dynamic = "force-dynamic";

export default async function ArReceiptsPage() {
  const receipts = await getArReceiptsView();

  return (
    <div className="space-y-2">
      <PageHeader
        eyebrow="Accounting"
        title="AR receipts"
        description="Receipts, unapplied cash, and cash-account linkage."
      />
      <SectionCard eyebrow="Cash application" title="Receipt register">
        <div className="data-table">
          <table>
            <thead>
              <tr>
                <th>Receipt</th>
                <th>Customer</th>
                <th>Cash account</th>
                <th>Date</th>
                <th>Status</th>
                <th>Source</th>
                <th>Amounts</th>
              </tr>
            </thead>
            <tbody>
              {receipts.map((receipt) => (
                <tr key={receipt.id}>
                  <td>{receipt.receiptNumber}</td>
                  <td>{receipt.customerName}</td>
                  <td>{receipt.cashAccountName ?? "Unassigned"}</td>
                  <td>{formatDate(receipt.receiptDate)}</td>
                  <td><StatusPill label={titleize(receipt.status)} /></td>
                  <td className="text-[0.7rem] text-slate-500">
                    {receipt.sourceProvider ?? "internal"}
                    <br />
                    {receipt.sourceDocumentNo ?? "-"}
                  </td>
                  <td>
                    {formatCurrency(receipt.amount)}
                    <br />
                    <span className="text-[0.65rem] text-slate-400">
                      Unapplied {formatCurrency(receipt.unappliedAmount)}
                    </span>
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

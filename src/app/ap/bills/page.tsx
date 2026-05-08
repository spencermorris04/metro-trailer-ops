import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import { formatCurrency, formatDate, titleize } from "@/lib/format";
import { getApBillsView } from "@/lib/server/platform";


export default async function ApBillsPage() {
  const bills = await getApBillsView();

  return (
    <div className="space-y-2">
      <PageHeader
        eyebrow="Accounting"
        title="AP bills"
        description="Vendor bills, due dates, balances, and source lineage."
      />
      <SectionCard eyebrow="Accounts Payable" title="Bill register">
        <div className="data-table">
          <table>
            <thead>
              <tr>
                <th>Bill</th>
                <th>Vendor</th>
                <th>Dates</th>
                <th>Status</th>
                <th>Source</th>
                <th>Amounts</th>
              </tr>
            </thead>
            <tbody>
              {bills.map((bill) => (
                <tr key={bill.id}>
                  <td>{bill.billNumber}</td>
                  <td>{bill.vendorName}</td>
                  <td>
                    {formatDate(bill.billDate)}
                    <br />
                    <span className="text-[0.65rem] text-slate-400">
                      Due {formatDate(bill.dueDate)}
                    </span>
                  </td>
                  <td><StatusPill label={titleize(bill.status)} /></td>
                  <td className="text-[0.7rem] text-slate-500">
                    {bill.sourceProvider ?? "internal"}
                    <br />
                    {bill.sourceDocumentNo ?? "-"}
                  </td>
                  <td>
                    {formatCurrency(bill.totalAmount)}
                    <br />
                    <span className="text-[0.65rem] text-slate-400">
                      Balance {formatCurrency(bill.balanceAmount)}
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

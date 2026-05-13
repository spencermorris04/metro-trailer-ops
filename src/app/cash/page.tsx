import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { formatCurrency, formatDate, titleize } from "@/lib/format";
import { getCashView } from "@/lib/server/platform";


export default async function CashPage() {
  const cash = await getCashView();

  return (
    <div className="space-y-2">
      <PageHeader
        eyebrow="Accounting"
        title="Cash"
        description="Cash accounts and recent transactions linked to AR receipts and AP payments."
      />

      <SectionCard eyebrow="Accounts" title="Cash accounts">
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          {cash.accounts.map((account) => (
            <div key={account.id} className="soft-panel p-3">
              <div className="mono text-[0.65rem] text-slate-500">{account.accountNumber}</div>
              <div className="text-[0.85rem] font-semibold text-slate-900">{account.name}</div>
              <div className="text-[0.7rem] text-slate-400">
                {account.active ? "Active" : "Inactive"} / USD
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard eyebrow="Transactions" title="Recent cash activity">
        <div className="data-table">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Account</th>
                <th>Type</th>
                <th>Description</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {cash.transactions.map((transaction) => (
                <tr key={transaction.id}>
                  <td>{formatDate(transaction.transactionDate)}</td>
                  <td>{transaction.accountName}</td>
                  <td>{titleize(transaction.transactionType)}</td>
                  <td>{transaction.description ?? "-"}</td>
                  <td className="font-semibold text-slate-900">
                    {formatCurrency(transaction.amount)}
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

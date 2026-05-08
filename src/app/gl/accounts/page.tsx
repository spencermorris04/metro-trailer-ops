import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import { titleize } from "@/lib/format";
import { getGlAccountsView } from "@/lib/server/platform";


export default async function GlAccountsPage() {
  const accounts = await getGlAccountsView();

  return (
    <div className="space-y-2">
      <PageHeader
        eyebrow="Accounting"
        title="GL accounts"
        description="General-ledger account master with internal and BC-origin accounts."
      />
      <SectionCard eyebrow="General Ledger" title="Account master">
        <div className="data-table">
          <table>
            <thead>
              <tr>
                <th>Account</th>
                <th>Name</th>
                <th>Type</th>
                <th>Category</th>
                <th>Status</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => (
                <tr key={account.id}>
                  <td>{account.accountNumber}</td>
                  <td>{account.name}</td>
                  <td>{titleize(account.normalSide)}</td>
                  <td>{titleize(account.category)}</td>
                  <td><StatusPill label={account.active ? "Active" : "Inactive"} /></td>
                  <td>{account.sourceProvider}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

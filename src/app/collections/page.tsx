import { JsonActionButton } from "@/components/json-action-button";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import { formatCurrency } from "@/lib/format";
import { listCollectionCases } from "@/lib/server/platform";


export default async function CollectionsPage() {
  const collectionCases = await listCollectionCases();

  return (
    <div className="space-y-2">
      <PageHeader
        eyebrow="Collections"
        title="Reminders, promises, and recovery context"
        description="Connected to contract, invoice, and telematics data for full operational context."
      />

      <SectionCard eyebrow="Queue" title="Open collection cases">
        <div className="data-table">
          <table>
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Customer</th>
                <th>Owner</th>
                <th>Balance</th>
                <th>Promise date</th>
                <th>Status</th>
                <th>Notes</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {collectionCases.map((caseRecord) => (
                <tr key={caseRecord.id}>
                  <td className="mono font-semibold text-slate-900">{caseRecord.invoiceNumber}</td>
                  <td className="text-slate-700">{caseRecord.customerName}</td>
                  <td className="text-slate-600">{caseRecord.owner}</td>
                  <td className="font-semibold text-slate-900">{formatCurrency(caseRecord.balanceAmount)}</td>
                  <td className="text-slate-600">{caseRecord.promisedPaymentDate ?? "-"}</td>
                  <td><StatusPill label={caseRecord.status} /></td>
                  <td>
                    <div className="space-y-0.5">
                      {caseRecord.notes.map((note) => (
                        <p key={note} className="text-[0.65rem] text-slate-400">{note}</p>
                      ))}
                    </div>
                  </td>
                  <td>
                    <JsonActionButton
                      endpoint={`/api/collections/${caseRecord.id}/remind`}
                      label="Remind"
                      body={{}}
                    />
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

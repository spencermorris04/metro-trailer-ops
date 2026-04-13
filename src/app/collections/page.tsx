import { JsonActionButton } from "@/components/json-action-button";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import { formatCurrency } from "@/lib/format";
import { listCollectionCases } from "@/lib/server/platform";

export const dynamic = "force-dynamic";

export default async function CollectionsPage() {
  const collectionCases = await listCollectionCases();

  return (
    <>
      <PageHeader
        eyebrow="Phase 7.2"
        title="Collections workflow with reminders, promises, and recovery context"
        description="Collections stays connected to contract, invoice, and telematics data so the team can act on both payment risk and asset recovery with full operational context."
      />

      <SectionCard
        eyebrow="Collections Queue"
        title="Open collection cases"
        description="Reminder actions are available directly from the case view, and recovery context can be refreshed from telematics when a unit is tied to a collection issue."
      >
        <div className="grid gap-4 xl:grid-cols-2">
          {collectionCases.map((caseRecord) => (
            <div key={caseRecord.id} className="soft-panel p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="mono text-xs uppercase tracking-[0.18em] text-slate-500">
                    {caseRecord.invoiceNumber}
                  </p>
                  <h3 className="mt-2 text-lg font-semibold text-slate-900">
                    {caseRecord.customerName}
                  </h3>
                </div>
                <StatusPill label={caseRecord.status} />
              </div>
              <div className="mt-4 space-y-2 text-sm text-slate-600">
                <p>Owner: {caseRecord.owner}</p>
                <p>Balance: {formatCurrency(caseRecord.balanceAmount)}</p>
                <p>
                  Promise to pay: {caseRecord.promisedPaymentDate ?? "Not recorded"}
                </p>
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                <JsonActionButton
                  endpoint={`/api/collections/${caseRecord.id}/remind`}
                  label="Send reminder"
                  body={{}}
                />
              </div>
              <div className="mt-5 space-y-2 text-sm text-slate-600">
                {caseRecord.notes.map((note) => (
                  <p key={note} className="rounded-xl bg-white/80 px-3 py-2">
                    {note}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </>
  );
}

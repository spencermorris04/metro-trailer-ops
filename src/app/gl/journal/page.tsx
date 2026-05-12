import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import { formatCurrency, formatDate, titleize } from "@/lib/format";
import { getGlJournalView } from "@/lib/server/platform";


export default async function GlJournalPage() {
  const entries = await getGlJournalView();

  return (
    <div className="space-y-2">
      <PageHeader
        eyebrow="Accounting"
        title="GL journal"
        description="App-native journal entries and debit/credit posture. BC GL history is not imported into app-native journals."
      />
      <SectionCard
        eyebrow="Business Central"
        title="BC GL history is separate"
        description="Imported BC GL entries will be shown as read-only historical activity once the BC GL entry import completes. They are not merged into app-native journal entries automatically."
      >
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[0.75rem] text-amber-900">
          This journal page represents the new ERP posting layer. Historical BC accounting
          remains under Business Central reconciliation until a deliberate migration maps it.
        </div>
      </SectionCard>
      <SectionCard eyebrow="Journal" title="Recent entries">
        <div className="data-table">
          <table>
            <thead>
              <tr>
                <th>Entry</th>
                <th>Date</th>
                <th>Description</th>
                <th>Source</th>
                <th>Status</th>
                <th>Totals</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td>{entry.entryNumber}</td>
                  <td>{entry.entryDate ? formatDate(entry.entryDate) : "No date"}</td>
                  <td>{entry.description}</td>
                  <td className="text-[0.7rem] text-slate-500">
                    {entry.sourceType ?? "manual"}
                    <br />
                    {entry.sourceId ?? "-"}
                  </td>
                  <td><StatusPill label={titleize(entry.status)} /></td>
                  <td>
                    Dr {formatCurrency(entry.debitTotal)}
                    <br />
                    <span className="text-[0.65rem] text-slate-400">
                      Cr {formatCurrency(entry.creditTotal)}
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

import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import { formatCurrency, formatDate, titleize } from "@/lib/format";
import { getGlJournalView } from "@/lib/server/platform";

export const dynamic = "force-dynamic";

export default async function GlJournalPage() {
  const entries = await getGlJournalView();

  return (
    <div className="space-y-2">
      <PageHeader
        eyebrow="Accounting"
        title="GL journal"
        description="Journal entries and debit/credit posture for posted accounting."
      />
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
                  <td>{formatDate(entry.entryDate)}</td>
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

import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import { formatDate } from "@/lib/format";
import { getGlPeriodsView } from "@/lib/server/platform";

export const dynamic = "force-dynamic";

export default async function GlPeriodsPage() {
  const periods = await getGlPeriodsView();

  return (
    <div className="space-y-2">
      <PageHeader
        eyebrow="Accounting"
        title="Posting periods"
        description="Open and closed periods that govern journal posting."
      />
      <SectionCard eyebrow="Periods" title="GL posting periods">
        <div className="data-table">
          <table>
            <thead>
              <tr>
                <th>Period</th>
                <th>Window</th>
                <th>Status</th>
                <th>Closed at</th>
              </tr>
            </thead>
            <tbody>
              {periods.map((period) => (
                <tr key={period.id}>
                  <td>{period.periodCode}</td>
                  <td>
                    {formatDate(period.startsAt)}
                    <br />
                    <span className="text-[0.65rem] text-slate-400">
                      {formatDate(period.endsAt)}
                    </span>
                  </td>
                  <td><StatusPill label={period.isClosed ? "Closed" : "Open"} /></td>
                  <td>{period.closedAt ? formatDate(period.closedAt) : "Open"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

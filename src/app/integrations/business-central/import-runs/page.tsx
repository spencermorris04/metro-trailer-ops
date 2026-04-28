import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import { formatDate } from "@/lib/format";
import { getBusinessCentralImportRunsView } from "@/lib/server/platform";

export const dynamic = "force-dynamic";

export default async function BusinessCentralImportRunsPage() {
  const runs = await getBusinessCentralImportRunsView();

  return (
    <div className="space-y-2">
      <PageHeader
        eyebrow="Admin"
        title="BC import runs"
        description="Historical BC import run log with counts, status, and source windows."
      />
      <SectionCard eyebrow="Runs" title="Import history">
        <div className="data-table">
          <table>
            <thead>
              <tr>
                <th>Run</th>
                <th>Status</th>
                <th>Window</th>
                <th>Counts</th>
                <th>Started / finished</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id}>
                  <td>{run.jobVersion ?? run.id}</td>
                  <td><StatusPill label={run.status} /></td>
                  <td>
                    {run.sourceWindowStart ? formatDate(run.sourceWindowStart) : "n/a"}
                    <br />
                    <span className="text-[0.65rem] text-slate-400">
                      {run.sourceWindowEnd ? formatDate(run.sourceWindowEnd) : "n/a"}
                    </span>
                  </td>
                  <td className="text-[0.7rem] text-slate-500">
                    Seen {run.recordsSeen}
                    <br />
                    Ins {run.recordsInserted} / Upd {run.recordsUpdated} / Fail {run.recordsFailed}
                  </td>
                  <td>
                    {formatDate(run.startedAt)}
                    <br />
                    <span className="text-[0.65rem] text-slate-400">
                      {run.finishedAt ? formatDate(run.finishedAt) : "Running"}
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

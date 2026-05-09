import Link from "next/link";

import { JsonActionButton } from "@/components/json-action-button";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import { listDispatchTasks } from "@/lib/server/platform";


export default async function DispatchPage() {
  const tasks = await listDispatchTasks();

  return (
    <div className="space-y-2">
      <PageHeader
        eyebrow="Dispatch"
        title="Daily delivery and pickup execution"
        description="Assignment, confirmation, and asset state updates tied to contracts and fleet."
      />

      <SectionCard eyebrow="Board" title="Dispatch tasks">
        <div className="data-table">
          <table>
            <thead>
              <tr>
                <th>Task</th>
                <th>Asset</th>
                <th>Contract / site</th>
                <th>Scheduled</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr key={task.id}>
                  <td>
                    <span className="font-semibold text-slate-900">{task.type}</span>
                    <br /><span className="text-[0.65rem] text-slate-400">{task.branch}</span>
                  </td>
                  <td className="text-slate-600">
                    <Link href={`/assets/${task.assetNumber}`} className="font-semibold text-[var(--brand)]">
                      {task.assetNumber}
                    </Link>
                  </td>
                  <td className="text-slate-600">
                    {task.contractNumber ? (
                      <>
                        <Link href={`/leases/${task.contractNumber}`} className="font-semibold text-[var(--brand)]">
                          {task.contractNumber}
                        </Link>
                        <br />
                      </>
                    ) : null}
                    <span className="text-[0.65rem] text-slate-400">{task.customerSite}</span>
                  </td>
                  <td className="text-slate-600">{task.scheduledFor}</td>
                  <td><StatusPill label={task.status} /></td>
                  <td>
                    {task.status !== "completed" ? (
                      <div className="flex gap-1.5">
                        <JsonActionButton
                          endpoint={`/api/dispatch-tasks/${task.id}/confirm`}
                          label="Delivery"
                          body={{ outcome: "delivery_confirmed" }}
                        />
                        <JsonActionButton
                          endpoint={`/api/dispatch-tasks/${task.id}/confirm`}
                          label="Pickup"
                          body={{ outcome: "pickup_confirmed" }}
                          variant="light"
                        />
                      </div>
                    ) : (
                      <span className="text-[0.65rem] text-slate-400">Done</span>
                    )}
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

import { JsonActionButton } from "@/components/json-action-button";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import { listDispatchTasks } from "@/lib/server/platform";

export const dynamic = "force-dynamic";

export default async function DispatchPage() {
  const tasks = await listDispatchTasks();

  return (
    <>
      <PageHeader
        eyebrow="Phase 3"
        title="Dispatch board for daily delivery and pickup execution"
        description="This board focuses on clear assignment, confirmation, and asset state updates rather than route optimization. Delivery confirmation can promote a reserved contract to active; pickup confirmation can move the asset into inspection hold."
      />

      <SectionCard
        eyebrow="Board"
        title="Dispatch tasks"
        description="Assignments are tied directly to assets and customer sites so execution can update the contract and fleet state machine."
      >
        <div className="data-table">
          <table>
            <thead>
              <tr>
                <th>Task</th>
                <th>Asset</th>
                <th>Site</th>
                <th>Scheduled</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr key={task.id}>
                  <td>
                    <p className="font-semibold text-slate-900">{task.type}</p>
                    <p className="mt-1 text-xs text-slate-500">{task.branch}</p>
                  </td>
                  <td className="text-sm text-slate-700">{task.assetNumber}</td>
                  <td className="text-sm text-slate-700">{task.customerSite}</td>
                  <td className="text-sm text-slate-700">{task.scheduledFor}</td>
                  <td>
                    <StatusPill label={task.status} />
                  </td>
                  <td>
                    {task.status !== "completed" ? (
                      <div className="flex flex-wrap gap-2">
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
                      <span className="text-xs text-slate-500">Completed</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </>
  );
}

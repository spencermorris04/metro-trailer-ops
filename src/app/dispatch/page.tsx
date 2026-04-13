import { JsonActionButton } from "@/components/json-action-button";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import { listDispatchTasks } from "@/lib/server/platform-service";

export const dynamic = "force-dynamic";

export default function DispatchPage() {
  const tasks = listDispatchTasks();

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
        <div className="grid gap-4 xl:grid-cols-3">
          {tasks.map((task) => (
            <div key={task.id} className="soft-panel p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="mono text-xs uppercase tracking-[0.18em] text-slate-500">
                    {task.branch}
                  </p>
                  <h3 className="mt-2 text-xl font-semibold text-slate-900">
                    {task.type}
                  </h3>
                </div>
                <StatusPill label={task.status} />
              </div>
              <div className="mt-4 space-y-2 text-sm text-slate-600">
                <p>Asset: {task.assetNumber}</p>
                <p>Site: {task.customerSite}</p>
                <p>Scheduled: {task.scheduledFor}</p>
              </div>
              {task.status !== "completed" ? (
                <div className="mt-5 flex flex-wrap gap-3">
                  <JsonActionButton
                    endpoint={`/api/dispatch-tasks/${task.id}/confirm`}
                    label="Confirm delivery"
                    body={{ outcome: "delivery_confirmed" }}
                  />
                  <JsonActionButton
                    endpoint={`/api/dispatch-tasks/${task.id}/confirm`}
                    label="Confirm pickup"
                    body={{ outcome: "pickup_confirmed" }}
                    variant="light"
                  />
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </SectionCard>
    </>
  );
}

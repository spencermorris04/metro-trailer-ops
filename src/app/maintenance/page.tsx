import { JsonActionButton } from "@/components/json-action-button";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import { listWorkOrders } from "@/lib/server/platform-service";

export const dynamic = "force-dynamic";

export default function MaintenancePage() {
  const workOrders = listWorkOrders();

  return (
    <>
      <PageHeader
        eyebrow="Phase 5"
        title="Maintenance and work order execution"
        description="Inspection outcomes and technician findings become work orders that hold assets out of circulation until repairs are complete and the unit is ready to rent again."
      />

      <SectionCard
        eyebrow="Work Orders"
        title="Open and completed maintenance tasks"
        description="Completing a work order can automatically clear maintenance state and return the asset to rentable inventory."
      >
        <div className="grid gap-4 xl:grid-cols-3">
          {workOrders.map((order) => (
            <div key={order.id} className="soft-panel p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="mono text-xs uppercase tracking-[0.18em] text-slate-500">
                    {order.assetNumber}
                  </p>
                  <h3 className="mt-2 text-lg font-semibold text-slate-900">
                    {order.title}
                  </h3>
                </div>
                <StatusPill label={order.status} />
              </div>
              <div className="mt-4 space-y-2 text-sm text-slate-600">
                <p>Branch: {order.branch}</p>
                <p>Priority: {order.priority}</p>
                <p>Source: {order.source}</p>
              </div>
              {order.status !== "completed" ? (
                <div className="mt-5">
                  <JsonActionButton
                    endpoint={`/api/work-orders/${order.id}/complete`}
                    label="Complete work order"
                    body={{}}
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

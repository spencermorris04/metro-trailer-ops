import { JsonActionButton } from "@/components/json-action-button";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import {
  listTechnicianWorkloads,
  listVerificationQueue,
  listVendorQueue,
  listWorkOrders,
} from "@/lib/server/platform";

export const dynamic = "force-dynamic";

export default async function MaintenancePage() {
  const [workOrders, technicianQueue, vendorQueue, verificationQueue] = await Promise.all([
    listWorkOrders(),
    listTechnicianWorkloads(),
    listVendorQueue(),
    listVerificationQueue(),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Phase 5"
        title="Maintenance and work order execution"
        description="Inspection outcomes and technician findings become work orders that hold assets out of circulation until repairs are complete and the unit is ready to rent again."
      />

      <SectionCard
        eyebrow="Work Orders"
        title="Blocking maintenance board"
        description="Assets stay unavailable until repair work is completed, verified, and administratively closed."
      >
        <div className="mb-6 grid gap-4 md:grid-cols-4">
          <div className="soft-panel p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Open backlog</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {workOrders.filter((order) => !["verified", "closed", "cancelled"].includes(order.status)).length}
            </p>
          </div>
          <div className="soft-panel p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Awaiting verification</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {verificationQueue.length}
            </p>
          </div>
          <div className="soft-panel p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Technician queue</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {technicianQueue.reduce((sum, row) => sum + row.inProgressCount + row.awaitingCount, 0)}
            </p>
          </div>
          <div className="soft-panel p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Vendor queue</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {vendorQueue.reduce((sum, row) => sum + row.awaitingVendorCount, 0)}
            </p>
          </div>
        </div>

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
                <p>Disposition: {order.billableDisposition}</p>
              </div>

              {["assigned", "in_progress", "awaiting_parts", "awaiting_vendor"].includes(order.status) ? (
                <div className="mt-5">
                  <JsonActionButton
                    endpoint={`/api/work-orders/${order.id}/repair-complete`}
                    label="Mark repair complete"
                    body={{
                      repairSummary: "Repair completed and ready for QA verification.",
                    }}
                  />
                </div>
              ) : null}
              {order.status === "repair_completed" ? (
                <div className="mt-5">
                  <JsonActionButton
                    endpoint={`/api/work-orders/${order.id}/verify`}
                    label="Verify and release"
                    body={{ result: "passed" }}
                  />
                </div>
              ) : null}
              {order.status === "verified" ? (
                <div className="mt-5">
                  <JsonActionButton
                    endpoint={`/api/work-orders/${order.id}/close`}
                    label="Close work order"
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

import Link from "next/link";

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
    <div className="space-y-2">
      <PageHeader
        eyebrow="Maintenance"
        title="Work order execution"
        description="Assets stay unavailable until repairs are completed, verified, and closed."
      />

      {/* KPI strip */}
      <div className="grid grid-cols-4 gap-px border border-[var(--line)] bg-[var(--line)]">
        <div className="bg-white px-3 py-2">
          <p className="workspace-metric-label">Open backlog</p>
          <p className="text-lg font-semibold text-slate-900">
            {workOrders.filter((o) => !["verified", "closed", "cancelled"].includes(o.status)).length}
          </p>
        </div>
        <div className="bg-white px-3 py-2">
          <p className="workspace-metric-label">Awaiting verification</p>
          <p className="text-lg font-semibold text-slate-900">{verificationQueue.length}</p>
        </div>
        <div className="bg-white px-3 py-2">
          <p className="workspace-metric-label">Technician queue</p>
          <p className="text-lg font-semibold text-slate-900">
            {technicianQueue.reduce((sum, row) => sum + row.inProgressCount + row.awaitingCount, 0)}
          </p>
        </div>
        <div className="bg-white px-3 py-2">
          <p className="workspace-metric-label">Vendor queue</p>
          <p className="text-lg font-semibold text-slate-900">
            {vendorQueue.reduce((sum, row) => sum + row.awaitingVendorCount, 0)}
          </p>
        </div>
      </div>

      <SectionCard eyebrow="Board" title="Work orders">
        <div className="data-table">
          <table>
            <thead>
              <tr>
                <th>Asset</th>
                <th>Title</th>
                <th>Branch</th>
                <th>Priority</th>
                <th>Source</th>
                <th>Disposition</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {workOrders.map((order) => (
                <tr key={order.id}>
                  <td className="mono font-semibold text-slate-900">
                    <Link href={`/assets/${order.assetNumber}`} className="text-[var(--brand)]">
                      {order.assetNumber}
                    </Link>
                  </td>
                  <td className="text-slate-700">{order.title}</td>
                  <td className="text-slate-600">{order.branch}</td>
                  <td className="text-slate-600">{order.priority}</td>
                  <td className="text-slate-600">
                    {order.source}
                    {order.inspectionId ? (
                      <>
                        <br />
                        <span className="text-[0.65rem] text-slate-400">
                          Insp. {order.inspectionId}
                        </span>
                        {order.assetNumber ? (
                          <>
                            {" / "}
                            <Link href={`/inspections`} className="text-[0.65rem] text-[var(--brand)]">
                              review queue
                            </Link>
                          </>
                        ) : null}
                      </>
                    ) : (
                      <>
                        <br />
                        <span className="text-[0.65rem] text-slate-400">
                          No inspection linkage
                        </span>
                      </>
                    )}
                  </td>
                  <td className="text-slate-600">{order.billableDisposition}</td>
                  <td><StatusPill label={order.status} /></td>
                  <td>
                    {["assigned", "in_progress", "awaiting_parts", "awaiting_vendor"].includes(order.status) ? (
                      <JsonActionButton
                        endpoint={`/api/work-orders/${order.id}/repair-complete`}
                        label="Repair done"
                        body={{ repairSummary: "Repair completed and ready for QA verification." }}
                      />
                    ) : null}
                    {order.status === "repair_completed" ? (
                      <JsonActionButton
                        endpoint={`/api/work-orders/${order.id}/verify`}
                        label="Verify"
                        body={{ result: "passed" }}
                      />
                    ) : null}
                    {order.status === "verified" ? (
                      <JsonActionButton
                        endpoint={`/api/work-orders/${order.id}/close`}
                        label="Close"
                        body={{}}
                      />
                    ) : null}
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

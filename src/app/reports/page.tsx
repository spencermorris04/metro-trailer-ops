import { JsonActionButton } from "@/components/json-action-button";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import { formatCurrency } from "@/lib/format";
import { getReports } from "@/lib/server/platform";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const reports = await getReports();

  return (
    <>
      <PageHeader
        eyebrow="Phase 7.3"
        title="Operational and financial reporting"
        description="Fleet utilization, revenue mix, overdue exposure, and audit visibility are all computed from the same underlying lifecycle and billing records."
        actions={
          <JsonActionButton
            endpoint="/api/reports"
            method="POST"
            label="Prepare revenue export"
          />
        }
      />

      <SectionCard
        eyebrow="Fleet Utilization"
        title="Branch-level fleet use"
        description="Utilization is driven by the same asset statuses that dispatch and maintenance see."
      >
        <div className="grid gap-4 xl:grid-cols-4">
          {reports.utilization.map((record) => (
            <div key={record.branch} className="soft-panel p-4">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-slate-500">
                Branch
              </p>
              <h3 className="mt-2 text-lg font-semibold text-slate-900">{record.branch}</h3>
              <p className="mt-4 text-sm text-slate-600">
                Fleet count: {record.fleetCount}
              </p>
              <p className="mt-2 text-sm text-slate-600">
                On rent: {record.onRentCount}
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-900">
                Utilization: {record.utilizationRate}%
              </p>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Revenue"
        title="Revenue by event type"
        description="Revenue mix is computed from financial events rather than inferred after the fact from accounting exports."
      >
        <div className="grid gap-4 xl:grid-cols-4">
          {reports.revenueSeries.map((point) => (
            <div key={point.label} className="soft-panel p-4">
              <StatusPill label={point.label} />
              <p className="mt-4 text-2xl font-semibold text-slate-900">
                {formatCurrency(point.revenue)}
              </p>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Aging"
        title="Overdue exposure"
        description="Accounts receivable is broken into aging buckets from live invoice balances."
      >
        <div className="grid gap-4 xl:grid-cols-5">
          {reports.overdueAging.map((bucket) => (
            <div key={bucket.label} className="soft-panel p-4">
              <StatusPill label={bucket.label} />
              <p className="mt-4 text-sm text-slate-600">
                Invoices: {bucket.invoiceCount}
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">
                {formatCurrency(bucket.balanceAmount)}
              </p>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Maintenance"
        title="Work order backlog"
        description="Maintenance exposure is derived from open work orders, assigned labor, and estimated versus actual cost."
      >
        <div className="grid gap-4 xl:grid-cols-4">
          <div className="soft-panel p-4">
            <p className="text-sm text-slate-600">Open work orders</p>
            <p className="mt-3 text-2xl font-semibold text-slate-900">
              {reports.maintenanceSummary.openWorkOrders}
            </p>
          </div>
          <div className="soft-panel p-4">
            <p className="text-sm text-slate-600">Assigned work orders</p>
            <p className="mt-3 text-2xl font-semibold text-slate-900">
              {reports.maintenanceSummary.assignedWorkOrders}
            </p>
          </div>
          <div className="soft-panel p-4">
            <p className="text-sm text-slate-600">Estimated cost</p>
            <p className="mt-3 text-2xl font-semibold text-slate-900">
              {formatCurrency(reports.maintenanceSummary.estimatedCost)}
            </p>
          </div>
          <div className="soft-panel p-4">
            <p className="text-sm text-slate-600">Actual cost</p>
            <p className="mt-3 text-2xl font-semibold text-slate-900">
              {formatCurrency(reports.maintenanceSummary.actualCost)}
            </p>
          </div>
          <div className="soft-panel p-4">
            <p className="text-sm text-slate-600">Awaiting verification</p>
            <p className="mt-3 text-2xl font-semibold text-slate-900">
              {reports.maintenanceSummary.verificationQueue}
            </p>
          </div>
          <div className="soft-panel p-4">
            <p className="text-sm text-slate-600">Average backlog age</p>
            <p className="mt-3 text-2xl font-semibold text-slate-900">
              {reports.maintenanceSummary.averageBacklogAgeDays}d
            </p>
          </div>
          <div className="soft-panel p-4">
            <p className="text-sm text-slate-600">Avg repair duration</p>
            <p className="mt-3 text-2xl font-semibold text-slate-900">
              {reports.maintenanceSummary.averageRepairDurationHours}h
            </p>
          </div>
          <div className="soft-panel p-4">
            <p className="text-sm text-slate-600">Billable recovery</p>
            <p className="mt-3 text-2xl font-semibold text-slate-900">
              {formatCurrency(reports.maintenanceSummary.billableRecoveryTotal)}
            </p>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Inspection Damage"
        title="Inspection outcomes and damage"
        description="Inspection throughput and damage scoring are visible without waiting for downstream exports."
      >
        <div className="grid gap-4 xl:grid-cols-6">
          {[
            ["Requested", reports.inspectionDamageSummary.requested],
            ["In progress", reports.inspectionDamageSummary.inProgress],
            ["Passed", reports.inspectionDamageSummary.passed],
            ["Failed", reports.inspectionDamageSummary.failed],
            ["Needs review", reports.inspectionDamageSummary.needsReview],
            ["Damaged assets", reports.inspectionDamageSummary.damagedAssets],
          ].map(([label, value]) => (
            <div key={label} className="soft-panel p-4">
              <p className="text-sm text-slate-600">{label}</p>
              <p className="mt-3 text-2xl font-semibold text-slate-900">{value}</p>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Audit Trail"
        title="Recent auditable activity"
        description="Operationally sensitive systems need a clear event history for compliance, troubleshooting, and user accountability."
      >
        <div className="grid gap-4 xl:grid-cols-3">
          {reports.auditTrail.map((event) => (
            <div key={event.id} className="soft-panel p-4">
              <p className="mono text-[0.68rem] uppercase tracking-[0.12em] text-slate-500">
                {event.entityType}
              </p>
              <h3 className="mt-2 text-lg font-semibold text-slate-900">
                {event.eventType}
              </h3>
              <p className="mt-2 text-sm text-slate-600">{event.entityId}</p>
              <p className="mt-2 text-xs text-slate-500">{event.userName}</p>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Audit Health"
        title="Operational controls"
        description="This combines audit coverage, queue backlog, failed webhooks, and current feature-flag posture."
      >
        <div className="grid gap-4 xl:grid-cols-4">
          <div className="soft-panel p-4">
            <p className="text-sm text-slate-600">Events last 7 days</p>
            <p className="mt-3 text-2xl font-semibold text-slate-900">
              {reports.auditHealth.totalEventsLast7Days}
            </p>
          </div>
          <div className="soft-panel p-4">
            <p className="text-sm text-slate-600">Actor coverage</p>
            <p className="mt-3 text-2xl font-semibold text-slate-900">
              {reports.auditHealth.actorCoverageRate}%
            </p>
          </div>
          <div className="soft-panel p-4">
            <p className="text-sm text-slate-600">Pending outbox jobs</p>
            <p className="mt-3 text-2xl font-semibold text-slate-900">
              {reports.auditHealth.pendingOutboxJobs}
            </p>
          </div>
          <div className="soft-panel p-4">
            <p className="text-sm text-slate-600">Failed webhooks</p>
            <p className="mt-3 text-2xl font-semibold text-slate-900">
              {reports.auditHealth.failedWebhookReceipts}
            </p>
          </div>
        </div>
      </SectionCard>
    </>
  );
}

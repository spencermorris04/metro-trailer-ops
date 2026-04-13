import { JsonActionButton } from "@/components/json-action-button";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import { formatCurrency } from "@/lib/format";
import { getReports } from "@/lib/server/platform-service";

export const dynamic = "force-dynamic";

export default function ReportsPage() {
  const reports = getReports();

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
            <div key={record.branch} className="soft-panel p-5">
              <h3 className="text-xl font-semibold text-slate-900">{record.branch}</h3>
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
            <div key={point.label} className="soft-panel p-5">
              <StatusPill label={point.label} />
              <p className="mt-4 text-2xl font-semibold text-slate-900">
                {formatCurrency(point.revenue)}
              </p>
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
            <div key={event.id} className="soft-panel p-5">
              <p className="mono text-xs uppercase tracking-[0.18em] text-slate-500">
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
    </>
  );
}

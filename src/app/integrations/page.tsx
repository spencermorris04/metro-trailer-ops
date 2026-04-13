import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import { integrationBlueprint } from "@/lib/platform-data";
import { listIntegrationJobs } from "@/lib/server/platform-service";

export const dynamic = "force-dynamic";

export default function IntegrationsPage() {
  const jobs = listIntegrationJobs();

  return (
    <>
      <PageHeader
        eyebrow="Boundaries and Sync"
        title="Integration adapters for payments, accounting, inspections, and telematics"
        description="The platform keeps the operational state machine internal while generating provider-specific requests, sync jobs, and webhook-ready endpoints for Stripe, QuickBooks, Record360, and SkyBitz."
      />

      <SectionCard
        eyebrow="Provider Boundaries"
        title="Integration responsibilities"
        description="Each provider has a narrow responsibility so Metro Trailer remains the primary operational system."
      >
        <div className="grid gap-4 xl:grid-cols-2">
          {integrationBlueprint.map((integration) => (
            <div key={integration.provider} className="soft-panel p-5">
              <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
                {integration.provider}
              </h2>
              <p className="mt-4 text-sm leading-7 text-slate-600">
                {integration.purpose}
              </p>
              <div className="mt-5 space-y-3 text-sm text-slate-700">
                <p>
                  <span className="font-semibold">Sync mode:</span>{" "}
                  {integration.syncMode}
                </p>
                <p>
                  <span className="font-semibold">System of record:</span>{" "}
                  {integration.systemOfRecord}
                </p>
                <p>
                  <span className="font-semibold">Boundary:</span>{" "}
                  {integration.boundary}
                </p>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Integration Jobs"
        title="Recent sync activity"
        description="Sync jobs are tracked separately from the core entities so operators can inspect provider failures without losing the business event itself."
      >
        <div className="grid gap-4 xl:grid-cols-2">
          {jobs.map((job) => (
            <div key={job.id} className="soft-panel p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="mono text-xs uppercase tracking-[0.18em] text-slate-500">
                    {job.provider}
                  </p>
                  <h3 className="mt-2 text-lg font-semibold text-slate-900">
                    {job.entityType}
                  </h3>
                </div>
                <StatusPill label={job.status} />
              </div>
              <div className="mt-4 space-y-2 text-sm text-slate-600">
                <p>Entity: {job.entityId}</p>
                <p>Direction: {job.direction}</p>
                <p>Started: {job.startedAt}</p>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </>
  );
}

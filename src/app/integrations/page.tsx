import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import { getBusinessCentralOverviewView, listIntegrationJobs } from "@/lib/server/platform";

export const dynamic = "force-dynamic";

const providers = [
  {
    provider: "Business Central",
    purpose: "Historical seed, legacy document lineage, and reconciliation fallback",
    syncMode: "Bulk seed + resumable import",
    systemOfRecord: "History + fallback",
    boundary: "BC data is imported read-only while the app becomes the current operational truth.",
    href: "/integrations/business-central",
  },
  {
    provider: "Record360",
    purpose: "Inspection summaries, dashboard/PDF links, and trailer inspection history",
    syncMode: "API + webhook-ready",
    systemOfRecord: "Inspection media and workflow",
    boundary: "Record360 remains the inspection capture surface; the app stores normalized inspection context.",
    href: "/inspections",
  },
  {
    provider: "SkyBitz",
    purpose: "Telematics, availability confidence, and current asset location hints",
    syncMode: "Polling",
    systemOfRecord: "Telematics telemetry",
    boundary: "Location and freshness signals come from SkyBitz; dispatch decisions stay in the app.",
    href: "/assets",
  },
  {
    provider: "QuickBooks Online",
    purpose: "Downstream accounting integration",
    syncMode: "Selective sync",
    systemOfRecord: "External accounting endpoint",
    boundary: "QuickBooks does not define the internal accounting schema or contract model.",
    href: "/financial",
  },
  {
    provider: "Internal e-sign",
    purpose: "Contract packets, signatures, and retained signed artifacts",
    syncMode: "Native",
    systemOfRecord: "Internal app",
    boundary: "Signing is first-class in the app; external providers are optional later.",
    href: "/documents",
  },
];

export default async function IntegrationsPage() {
  const [jobs, bcOverview] = await Promise.all([
    listIntegrationJobs(),
    getBusinessCentralOverviewView(),
  ]);

  return (
    <div className="space-y-2">
      <PageHeader
        eyebrow="Admin"
        title="Integrations"
        description="Provider boundaries, sync posture, and the transition from BC history to app-native operational truth."
      />

      <SectionCard eyebrow="Providers" title="Integration boundaries">
        <div className="data-table">
          <table>
            <thead>
              <tr>
                <th>Provider</th>
                <th>Purpose</th>
                <th>Sync mode</th>
                <th>System of record</th>
                <th>Boundary</th>
              </tr>
            </thead>
            <tbody>
              {providers.map((provider) => (
                <tr key={provider.provider}>
                  <td>
                    <Link href={provider.href} className="font-semibold text-[var(--brand)]">
                      {provider.provider}
                    </Link>
                  </td>
                  <td>{provider.purpose}</td>
                  <td>{provider.syncMode}</td>
                  <td>{provider.systemOfRecord}</td>
                  <td>{provider.boundary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <div className="grid gap-2 xl:grid-cols-2">
        <SectionCard eyebrow="Business Central" title="Migration admin">
          <div className="grid grid-cols-2 gap-px border border-[var(--line)] bg-[var(--line)]">
            {[
              ["Assets", bcOverview.metrics.assets],
              ["Customers", bcOverview.metrics.customers],
              ["Contracts", bcOverview.metrics.contracts],
              ["Source docs", bcOverview.metrics.sourceDocuments],
            ].map(([label, value]) => (
              <div key={label} className="bg-white px-3 py-2">
                <p className="workspace-metric-label">{label}</p>
                <p className="text-base font-semibold text-slate-900">{value}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <Link href="/integrations/business-central" className="btn-secondary">
              Overview
            </Link>
            <Link href="/integrations/business-central/import-runs" className="btn-secondary">
              Import runs
            </Link>
            <Link href="/integrations/business-central/import-errors" className="btn-secondary">
              Errors
            </Link>
          </div>
        </SectionCard>

        <SectionCard eyebrow="Jobs" title="Recent sync activity">
          <div className="divide-y divide-[var(--line)]">
            {jobs.map((job) => (
              <div key={job.id} className="flex items-center justify-between py-1.5">
                <div>
                  <div className="mono text-[0.65rem] text-slate-500">{job.provider}</div>
                  <div className="text-[0.75rem] text-slate-700">
                    {job.entityType} / {job.entityId}
                  </div>
                </div>
                <div className="text-right">
                  <StatusPill label={job.status} />
                  <div className="mt-1 text-[0.65rem] text-slate-400">
                    {job.direction} / {job.startedAt}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

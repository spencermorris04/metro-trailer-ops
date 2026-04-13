import Link from "next/link";

import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import { assetGuardrails } from "@/lib/domain/lifecycle";
import { titleize } from "@/lib/format";
import { branchSnapshots } from "@/lib/platform-data";
import { listAssets } from "@/lib/server/platform-service";

export const dynamic = "force-dynamic";

export default function AssetsPage() {
  const sampleAssets = listAssets();
  const statusCounts = sampleAssets.reduce<Record<string, number>>((acc, asset) => {
    acc[asset.status] = (acc[asset.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <>
      <SectionCard
        eyebrow="Phase 1.1"
        title="Asset management is the fleet control plane"
        description="Every downstream workflow depends on reliable asset status, availability, branch ownership, maintenance readiness, and telematics linkage."
      >
        <div className="grid gap-4 lg:grid-cols-[1.25fr_0.95fr]">
          <div className="space-y-4">
            <p className="text-sm leading-7 text-slate-600">
              The starter schema models asset type, dimensions, branch, status,
              availability, GPS device mapping, and maintenance posture so a
              single trailer record can drive reservations, dispatch, billing,
              inspections, and work orders.
            </p>
            <div className="flex flex-wrap gap-3">
              {Object.entries(statusCounts).map(([status, count]) => (
                <div
                  key={status}
                  className="rounded-2xl border border-[rgba(19,35,45,0.08)] bg-white/80 px-4 py-3"
                >
                  <p className="mono text-xs uppercase tracking-[0.18em] text-slate-500">
                    {status}
                  </p>
                  <p className="mt-2 text-xl font-semibold text-slate-950">
                    {count}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="soft-panel p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              API Surface
            </p>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Starter route handlers already validate asset payloads and expose
              sample fleet data while persistence is being wired in.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                href="/api/assets"
                className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
              >
                GET /api/assets
              </Link>
              <Link
                href="/api/domain"
                className="rounded-full border border-[rgba(19,35,45,0.12)] bg-white px-4 py-2 text-sm font-semibold text-slate-800"
              >
                GET /api/domain
              </Link>
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Branch Snapshot"
        title="Availability must stay local and global at the same time"
        description="Dispatch and sales teams need per-branch visibility without losing the shared fleet picture."
      >
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
          {branchSnapshots.map((branch) => (
            <div key={branch.branch} className="soft-panel p-5">
              <h3 className="text-xl font-semibold text-slate-900">
                {branch.branch}
              </h3>
              <div className="mt-4 space-y-2 text-sm text-slate-600">
                <p>Available: {branch.available.toLocaleString()}</p>
                <p>Reserved: {branch.reserved.toLocaleString()}</p>
                <p>On rent: {branch.onRent.toLocaleString()}</p>
                <p>Maintenance: {branch.maintenance.toLocaleString()}</p>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Sample Fleet"
        title="Representative asset records"
        description="The data below mirrors how branch operations, telematics, and maintenance readiness are expected to appear in the system."
      >
        <div className="data-table">
          <table>
            <thead>
              <tr>
                <th>Asset</th>
                <th>Type</th>
                <th>Branch</th>
                <th>Status</th>
                <th>Availability</th>
                <th>Maintenance</th>
                <th>Telemetry</th>
              </tr>
            </thead>
            <tbody>
              {sampleAssets.map((asset) => (
                <tr key={asset.id}>
                  <td>
                    <p className="font-semibold text-slate-900">
                      {asset.assetNumber}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {asset.dimensions}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Age: {asset.age}
                    </p>
                  </td>
                  <td className="text-sm text-slate-700">
                    {titleize(asset.type)}
                  </td>
                  <td className="text-sm text-slate-700">{asset.branch}</td>
                  <td>
                    <StatusPill label={titleize(asset.status)} />
                  </td>
                  <td>
                    <StatusPill label={titleize(asset.availability)} />
                  </td>
                  <td>
                    <StatusPill label={titleize(asset.maintenanceStatus)} />
                  </td>
                  <td className="text-sm text-slate-700">
                    {asset.gpsDeviceId ?? "Not linked"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Guardrails"
        title="Asset lifecycle rules"
        description="These rules are encoded in the domain layer so future mutations, background jobs, and integrations can reuse the same transition logic."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          {Object.entries(assetGuardrails).map(([status, rules]) => (
            <div key={status} className="soft-panel p-5">
              <StatusPill label={titleize(status)} />
              <ul className="mt-4 space-y-2 text-sm leading-7 text-slate-600">
                {rules.map((rule) => (
                  <li key={rule}>{rule}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </SectionCard>
    </>
  );
}

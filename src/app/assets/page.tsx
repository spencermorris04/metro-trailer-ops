import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import {
  assetAvailabilities,
  assetStatuses,
  assetTypes,
  maintenanceStatuses,
} from "@/lib/domain/models";
import { formatDate, titleize } from "@/lib/format";
import {
  getInventoryOverview,
  listAssetsPage,
} from "@/lib/server/platform";

export const dynamic = "force-dynamic";

type AssetsPageProps = {
  searchParams: Promise<{
    q?: string | string[];
    branch?: string | string[];
    status?: string | string[];
    availability?: string | string[];
    maintenanceStatus?: string | string[];
    type?: string | string[];
    page?: string | string[];
  }>;
};

function getParam(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function buildAssetHref(
  current: Record<string, string | undefined>,
  overrides: Record<string, string | undefined>,
) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...current, ...overrides })) {
    if (value) {
      params.set(key, value);
    }
  }

  const query = params.toString();
  return query ? `/assets?${query}` : "/assets";
}

export default async function AssetsPage({ searchParams }: AssetsPageProps) {
  const resolved = await searchParams;
  const filters = {
    q: getParam(resolved.q),
    branch: getParam(resolved.branch),
    status: getParam(resolved.status),
    availability: getParam(resolved.availability),
    maintenanceStatus: getParam(resolved.maintenanceStatus),
    type: getParam(resolved.type),
  };
  const page = Math.max(1, Number(getParam(resolved.page) ?? "1"));
  const pageSize = 25;

  const [overview, pagedAssets] = await Promise.all([
    getInventoryOverview(),
    listAssetsPage({
      ...filters,
      page,
      pageSize,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(pagedAssets.total / pagedAssets.pageSize));
  const statusCards: Array<{ label: string; value: number }> = [
    { label: "available", value: overview.countsByStatus.available ?? 0 },
    { label: "reserved", value: overview.countsByStatus.reserved ?? 0 },
    { label: "dispatched", value: overview.countsByStatus.dispatched ?? 0 },
    { label: "on_rent", value: overview.countsByStatus.on_rent ?? 0 },
    { label: "inspection_hold", value: overview.countsByStatus.inspection_hold ?? 0 },
    { label: "in_maintenance", value: overview.countsByStatus.in_maintenance ?? 0 },
  ];
  const exceptionSections: Array<{
    title: string;
    assets: typeof pagedAssets.data;
  }> = [
    { title: "Dispatched now", assets: overview.exceptionAssets.dispatched },
    { title: "Inspection hold", assets: overview.exceptionAssets.inspection },
    { title: "Maintenance blocked", assets: overview.exceptionAssets.maintenance },
    { title: "Stale telematics", assets: overview.exceptionAssets.staleTelematics },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Inventory"
        title="Fleet control tower for availability, custody, and blocking work"
        description="Inventory is now presented as an operational control surface. Every unit shows its custody, owning workflow, next reservation, and the concrete reason it is or is not rentable."
        actions={
          <>
            <Link
              href="/dispatch"
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-700"
            >
              Dispatch queue
            </Link>
            <Link
              href="/maintenance"
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-700"
            >
              Maintenance queue
            </Link>
          </>
        }
      />

      <SectionCard
        eyebrow="Filters"
        title="Search rentable risk before it becomes a dispatch problem"
        description="Filter by branch, lifecycle state, availability, maintenance posture, or asset type. The table below reflects the live derived inventory state, not just the base asset row."
      >
        <form className="grid gap-3 lg:grid-cols-6" action="/assets">
          <input
            type="text"
            name="q"
            defaultValue={filters.q ?? ""}
            placeholder="Asset, subtype, serial, yard slot"
            className="rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm text-slate-900 lg:col-span-2"
          />
          <input
            type="text"
            name="branch"
            defaultValue={filters.branch ?? ""}
            placeholder="Branch"
            className="rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm text-slate-900"
          />
          <select
            name="status"
            defaultValue={filters.status ?? ""}
            className="rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm text-slate-900"
          >
            <option value="">All statuses</option>
            {assetStatuses.map((status) => (
              <option key={status} value={status}>
                {titleize(status)}
              </option>
            ))}
          </select>
          <select
            name="availability"
            defaultValue={filters.availability ?? ""}
            className="rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm text-slate-900"
          >
            <option value="">All availability</option>
            {assetAvailabilities.map((availability) => (
              <option key={availability} value={availability}>
                {titleize(availability)}
              </option>
            ))}
          </select>
          <select
            name="maintenanceStatus"
            defaultValue={filters.maintenanceStatus ?? ""}
            className="rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm text-slate-900"
          >
            <option value="">All maintenance</option>
            {maintenanceStatuses.map((status) => (
              <option key={status} value={status}>
                {titleize(status)}
              </option>
            ))}
          </select>
          <select
            name="type"
            defaultValue={filters.type ?? ""}
            className="rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm text-slate-900 lg:col-span-2"
          >
            <option value="">All asset types</option>
            {assetTypes.map((type) => (
              <option key={type} value={type}>
                {titleize(type)}
              </option>
            ))}
          </select>
          <div className="flex gap-3 lg:col-span-4">
            <button
              type="submit"
              className="rounded-md border border-slate-900 bg-slate-900 px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-white"
            >
              Apply filters
            </button>
            <Link
              href="/assets"
              className="rounded-md border border-[var(--line)] bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-700"
            >
              Reset
            </Link>
          </div>
        </form>
      </SectionCard>

      <SectionCard
        eyebrow="Pulse"
        title="Live inventory posture"
        description="These counts reflect the derived state model driven by allocations, dispatch execution, inspections, and maintenance holds."
      >
        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
          {statusCards.map(({ label, value }) => (
            <div key={label} className="soft-panel p-4">
              <p className="mono text-[0.68rem] uppercase tracking-[0.12em] text-slate-500">
                {titleize(label)}
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="soft-panel p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Blocked assets</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {overview.blockedAssetsCount}
            </p>
          </div>
          <div className="soft-panel p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Dispatch queue</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {overview.dispatchQueueCount}
            </p>
          </div>
          <div className="soft-panel p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Inspection queue</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {overview.inspectionQueueCount}
            </p>
          </div>
          <div className="soft-panel p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Stale telematics</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {overview.staleTelematicsCount}
            </p>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Branch Posture"
        title="Local yard control without losing the fleet-wide picture"
        description="Each branch shows immediately how much inventory is truly rentable versus already spoken for or blocked downstream."
      >
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
          {overview.branchSnapshots.map((branch) => (
            <div key={branch.branch} className="soft-panel p-4">
              <h3 className="text-lg font-semibold text-slate-900">{branch.branch}</h3>
              <div className="mt-4 space-y-2 text-sm text-slate-600">
                <p>Available: {branch.available.toLocaleString()}</p>
                <p>Reserved: {branch.reserved.toLocaleString()}</p>
                <p>Dispatched: {branch.dispatched.toLocaleString()}</p>
                <p>On rent: {branch.onRent.toLocaleString()}</p>
                <p>Inspection: {branch.inspection.toLocaleString()}</p>
                <p>Maintenance: {branch.maintenance.toLocaleString()}</p>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Exceptions"
        title="Queues that deserve immediate operator attention"
        description="These are the units most likely to cause revenue leakage, failed dispatches, or branch-level confusion."
      >
        <div className="grid gap-4 xl:grid-cols-4">
          {exceptionSections.map(({ title, assets }) => (
            <div key={title} className="soft-panel p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{title}</p>
              <div className="mt-4 space-y-3">
                {assets.length === 0 ? (
                  <p className="text-sm text-slate-500">No current exceptions.</p>
                ) : (
                  assets.map((asset) => (
                    <div key={asset.id} className="rounded-md border border-[var(--line)] bg-white p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-semibold text-slate-900">{asset.assetNumber}</p>
                        <StatusPill label={titleize(asset.status)} />
                      </div>
                      <p className="mt-2 text-sm text-slate-600">
                        {asset.blockingReason ?? asset.custodyLocation ?? "Operational review required."}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Inventory Ledger"
        title="Units with custody, owning workflow, and next move"
        description="This table is built from the unified state model. Dispatch, contracts, inspections, and maintenance all contribute to what you see here."
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-sm text-slate-600">
            Showing {(page - 1) * pageSize + 1}-
            {Math.min(page * pageSize, pagedAssets.total)} of {pagedAssets.total} assets
          </p>
          <div className="flex gap-2">
            <Link
              href={buildAssetHref(filters, {
                page: page > 1 ? String(page - 1) : undefined,
              })}
              className="rounded-md border border-[var(--line)] bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-700"
            >
              Previous
            </Link>
            <Link
              href={buildAssetHref(filters, {
                page: page < totalPages ? String(page + 1) : String(totalPages),
              })}
              className="rounded-md border border-[var(--line)] bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-700"
            >
              Next
            </Link>
          </div>
        </div>

        <div className="data-table">
          <table>
            <thead>
              <tr>
                <th>Asset</th>
                <th>Placement</th>
                <th>Status</th>
                <th>Owning workflow</th>
                <th>Next reservation</th>
                <th>Telematics</th>
              </tr>
            </thead>
            <tbody>
              {pagedAssets.data.map((asset) => (
                <tr key={asset.id}>
                  <td>
                    <p className="font-semibold text-slate-900">{asset.assetNumber}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {titleize(asset.type)}
                      {asset.subtype ? ` / ${asset.subtype}` : ""}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {asset.dimensions}
                      {asset.serialNumber ? ` • SN ${asset.serialNumber}` : ""}
                    </p>
                  </td>
                  <td>
                    <p className="text-sm text-slate-700">{asset.custodyLocation ?? asset.branch}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {asset.locationSource ? titleize(asset.locationSource) : asset.branch}
                    </p>
                  </td>
                  <td>
                    <div className="space-y-2">
                      <StatusPill label={titleize(asset.status)} />
                      <StatusPill label={titleize(asset.availability)} />
                    </div>
                  </td>
                  <td>
                    <p className="text-sm text-slate-700">
                      {asset.activeContractNumber ?? asset.activeWorkOrderId ?? asset.activeDispatchTaskId ?? "Unowned"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {asset.blockingReason ?? "Rentable now"}
                    </p>
                  </td>
                  <td>
                    {asset.nextContractNumber && asset.nextReservationStart ? (
                      <>
                        <p className="text-sm text-slate-700">{asset.nextContractNumber}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          Starts {formatDate(asset.nextReservationStart)}
                        </p>
                      </>
                    ) : (
                      <span className="text-sm text-slate-500">No upcoming reservation</span>
                    )}
                  </td>
                  <td>
                    {asset.telematicsFreshnessMinutes !== null ? (
                      <>
                        <p className="text-sm text-slate-700">
                          {asset.telematicsFreshnessMinutes} min old
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {asset.telematicsStale ? "Needs refresh" : "Fresh enough"}
                        </p>
                      </>
                    ) : (
                      <span className="text-sm text-slate-500">No recent ping</span>
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

import { headers } from "next/headers";
import Link from "next/link";

import { StatusPill } from "@/components/status-pill";
import { WorkspacePanels } from "@/components/workspace-panels";
import {
  assetAvailabilities,
  assetStatuses,
  assetTypes,
  maintenanceStatuses,
} from "@/lib/domain/models";
import { formatCompactNumber, formatDate, titleize } from "@/lib/format";
import { getInventoryOverview, listAssetsPage } from "@/lib/server/platform";
import { getWorkspaceLayout } from "@/lib/server/workspace-layouts";

export const dynamic = "force-dynamic";

const defaultLayout = {
  left: 296,
  right: 360,
};

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

type FilterState = {
  q?: string;
  branch?: string;
  status?: string;
  availability?: string;
  maintenanceStatus?: string;
  type?: string;
};

function getParam(value: string | string[] | undefined) {
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

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatFreshness(minutes: number | null | undefined) {
  if (minutes === null || minutes === undefined) {
    return "No ping";
  }
  if (minutes < 60) {
    return `${minutes} min`;
  }
  return `${Math.round((minutes / 60) * 10) / 10} hr`;
}

function hasActiveFilters(filters: FilterState) {
  return Object.values(filters).some(Boolean);
}

function describeOwner(
  asset: Awaited<ReturnType<typeof listAssetsPage>>["data"][number],
) {
  if (asset.activeDispatchTaskId) {
    return asset.activeDispatchTaskStatus
      ? `Dispatch / ${titleize(asset.activeDispatchTaskStatus)}`
      : "Dispatch-owned";
  }
  if (asset.activeWorkOrderId) {
    return asset.activeWorkOrderStatus
      ? `Maintenance / ${titleize(asset.activeWorkOrderStatus)}`
      : "Maintenance-owned";
  }
  if (asset.activeContractNumber) {
    return asset.activeCustomerName
      ? `Contract / ${asset.activeCustomerName}`
      : `Contract / ${asset.activeContractNumber}`;
  }
  if (asset.status === "retired") {
    return "Retired";
  }
  return "Unowned";
}

function describeClock(
  asset: Awaited<ReturnType<typeof listAssetsPage>>["data"][number],
) {
  if (asset.nextContractNumber && asset.nextReservationStart) {
    return `Turns ${formatDate(asset.nextReservationStart)}`;
  }
  return formatFreshness(asset.telematicsFreshnessMinutes);
}

export default async function AssetsPage({ searchParams }: AssetsPageProps) {
  const requestHeaders = new Headers(await headers());
  const resolved = await searchParams;
  const filters: FilterState = {
    q: getParam(resolved.q),
    branch: getParam(resolved.branch),
    status: getParam(resolved.status),
    availability: getParam(resolved.availability),
    maintenanceStatus: getParam(resolved.maintenanceStatus),
    type: getParam(resolved.type),
  };
  const page = Math.max(1, Number(getParam(resolved.page) ?? "1"));
  const pageSize = 25;

  const [workspace, overview, pagedAssets] = await Promise.all([
    getWorkspaceLayout(requestHeaders, "assets", defaultLayout),
    getInventoryOverview(),
    listAssetsPage({
      ...filters,
      page,
      pageSize,
    }),
  ]);

  const filtersActive = hasActiveFilters(filters);
  const totalPages = Math.max(1, Math.ceil(pagedAssets.total / pagedAssets.pageSize));
  const activeFilterChips = [
    { label: "Search", value: filters.q },
    { label: "Branch", value: filters.branch },
    { label: "Status", value: filters.status ? titleize(filters.status) : undefined },
    {
      label: "Availability",
      value: filters.availability ? titleize(filters.availability) : undefined,
    },
    {
      label: "Maintenance",
      value: filters.maintenanceStatus ? titleize(filters.maintenanceStatus) : undefined,
    },
    { label: "Type", value: filters.type ? titleize(filters.type) : undefined },
  ].filter((chip) => chip.value);

  const summaryCards = [
    { label: "Ready now", value: overview.summary.rentReadyCount, note: "Rentable units" },
    { label: "Blocked", value: overview.summary.branchBlockedCount, note: "Reserved, dispatched, or held" },
    { label: "On rent", value: overview.summary.onRentCount, note: "Customer-controlled units" },
    { label: "Blind", value: overview.summary.telematicsBlindCount, note: "Missing or stale telematics" },
  ];

  return (
    <WorkspacePanels
      pageKey="assets"
      initialLayout={workspace.layout as typeof defaultLayout}
      left={
        <div className="space-y-4">
          <section className="panel overflow-hidden">
            <div className="border-b border-[var(--line)] px-5 py-4">
              <p className="workspace-section-label">Inventory scope</p>
              <h1 className="mt-1 text-xl font-semibold text-slate-950">Asset workspace</h1>
            </div>
            <div className="px-5 py-4">
              <form className="grid gap-3" action="/assets">
                <input
                  type="text"
                  name="q"
                  defaultValue={filters.q ?? ""}
                  placeholder="Asset, serial, subtype, yard slot"
                  className="workspace-input"
                />
                <input
                  type="text"
                  name="branch"
                  defaultValue={filters.branch ?? ""}
                  placeholder="Branch"
                  className="workspace-input"
                />
                <select name="status" defaultValue={filters.status ?? ""} className="workspace-input">
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
                  className="workspace-input"
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
                  className="workspace-input"
                >
                  <option value="">All maintenance</option>
                  {maintenanceStatuses.map((status) => (
                    <option key={status} value={status}>
                      {titleize(status)}
                    </option>
                  ))}
                </select>
                <select name="type" defaultValue={filters.type ?? ""} className="workspace-input">
                  <option value="">All asset types</option>
                  {assetTypes.map((type) => (
                    <option key={type} value={type}>
                      {titleize(type)}
                    </option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <button type="submit" className="btn-primary flex-1 justify-center">
                    Apply
                  </button>
                  <Link href="/assets" className="btn-secondary justify-center">
                    Reset
                  </Link>
                </div>
              </form>

              <div className="mt-4 border-t border-[var(--line)] pt-4">
                <p className="workspace-metric-label">Current scope</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {filtersActive ? (
                    activeFilterChips.map((chip) => (
                      <span key={`${chip.label}-${chip.value}`} className="workspace-chip">
                        {chip.label}: {chip.value}
                      </span>
                    ))
                  ) : (
                    <span className="workspace-chip">Fleet-wide</span>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className="panel overflow-hidden">
            <div className="border-b border-[var(--line)] px-5 py-4">
              <p className="workspace-section-label">Branch pressure</p>
            </div>
            <div className="divide-y divide-[var(--line)]">
              {overview.branchPressure.slice(0, 8).map((branch) => (
                <div key={branch.branch} className="px-5 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{branch.branch}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Ready {branch.available} / Blocked {branch.blocked}
                      </p>
                    </div>
                    <StatusPill label={formatPercent(branch.readyRate)} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      }
      center={
        <div className="space-y-4">
          <section className="panel overflow-hidden">
            <div className="border-b border-[var(--line)] px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="workspace-section-label">Inventory board</p>
                  <h2 className="mt-1 text-2xl font-semibold text-slate-950">
                    Fleet placement and ownership
                  </h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link href="/dispatch" className="btn-secondary">
                    Dispatch
                  </Link>
                  <Link href="/inspections" className="btn-secondary">
                    Inspections
                  </Link>
                  <Link href="/maintenance" className="btn-secondary">
                    Maintenance
                  </Link>
                </div>
              </div>
            </div>
            <div className="grid gap-px bg-[var(--line)] lg:grid-cols-4">
              {summaryCards.map((card) => (
                <div key={card.label} className="bg-white px-5 py-4">
                  <p className="workspace-metric-label">{card.label}</p>
                  <p className="mt-2 text-3xl font-semibold text-slate-950">
                    {formatCompactNumber(card.value)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">{card.note}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="panel overflow-hidden">
            <div className="border-b border-[var(--line)] px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="workspace-section-label">Asset lookup</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {(page - 1) * pageSize + 1}-
                    {Math.min(page * pageSize, pagedAssets.total)} of {formatCompactNumber(pagedAssets.total)}
                  </p>
                </div>
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-slate-500">
                  Page {page} of {totalPages}
                </p>
              </div>
            </div>

            <div className="divide-y divide-[var(--line)]">
              {pagedAssets.data.length === 0 ? (
                <div className="px-5 py-8 text-sm text-slate-500">No assets match the current scope.</div>
              ) : (
                pagedAssets.data.map((asset) => (
                  <div
                    key={asset.id}
                    className="grid gap-4 px-5 py-4 xl:grid-cols-[minmax(0,1.2fr)_220px_220px_180px]"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="mono text-sm font-semibold text-slate-950">{asset.assetNumber}</p>
                        <StatusPill label={titleize(asset.status)} />
                        <StatusPill label={titleize(asset.maintenanceStatus)} />
                      </div>
                      <p className="mt-2 text-sm text-slate-700">
                        {titleize(asset.type)}
                        {asset.subtype ? ` / ${asset.subtype}` : ""}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {asset.dimensions}
                        {asset.serialNumber ? ` / SN ${asset.serialNumber}` : ""}
                      </p>
                    </div>

                    <div>
                      <p className="workspace-metric-label">Placement</p>
                      <p className="mt-2 text-sm font-medium text-slate-900">
                        {asset.custodyLocation ?? asset.branch}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {asset.locationSource ? titleize(asset.locationSource) : asset.branch}
                      </p>
                    </div>

                    <div>
                      <p className="workspace-metric-label">Owner</p>
                      <p className="mt-2 text-sm font-medium text-slate-900">{describeOwner(asset)}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {asset.blockingReason ?? asset.activeContractNumber ?? "No downstream owner"}
                      </p>
                    </div>

                    <div>
                      <p className="workspace-metric-label">Clock</p>
                      <p className="mt-2 text-sm font-medium text-slate-900">{describeClock(asset)}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {asset.nextContractNumber ?? "Telematics state"}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="border-t border-[var(--line)] px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-slate-500">
                  {filtersActive ? "Filtered inventory view." : "Fleet-wide inventory view."}
                </p>
                <div className="flex gap-2">
                  <Link
                    href={buildAssetHref(filters, {
                      page: page > 1 ? String(page - 1) : undefined,
                    })}
                    className="btn-secondary"
                  >
                    Previous
                  </Link>
                  <Link
                    href={buildAssetHref(filters, {
                      page: page < totalPages ? String(page + 1) : String(totalPages),
                    })}
                    className="btn-secondary"
                  >
                    Next
                  </Link>
                </div>
              </div>
            </div>
          </section>
        </div>
      }
      right={
        <div className="space-y-4">
          <section className="panel overflow-hidden">
            <div className="border-b border-[var(--line)] px-5 py-4">
              <p className="workspace-section-label">Queue ownership</p>
            </div>
            <div className="divide-y divide-[var(--line)]">
              <div className="workspace-list-row">
                <span>Contract-owned</span>
                <strong>{formatCompactNumber(overview.ownership.contractOwned)}</strong>
              </div>
              <div className="workspace-list-row">
                <span>Dispatch-owned</span>
                <strong>{formatCompactNumber(overview.ownership.dispatchOwned)}</strong>
              </div>
              <div className="workspace-list-row">
                <span>Maintenance-owned</span>
                <strong>{formatCompactNumber(overview.ownership.maintenanceOwned)}</strong>
              </div>
              <div className="workspace-list-row">
                <span>Inspection-owned</span>
                <strong>{formatCompactNumber(overview.ownership.inspectionOwned)}</strong>
              </div>
            </div>
          </section>

          {overview.actionLanes.map((lane) => (
            <section key={lane.key} className="panel overflow-hidden">
              <div className="border-b border-[var(--line)] px-5 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="workspace-section-label">{lane.title}</p>
                    <p className="mt-1 text-2xl font-semibold text-slate-950">
                      {formatCompactNumber(lane.count)}
                    </p>
                  </div>
                  <Link href={lane.href} className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--brand)]">
                    Open
                  </Link>
                </div>
              </div>
              <div className="divide-y divide-[var(--line)]">
                {lane.assets.length === 0 ? (
                  <div className="px-5 py-5 text-sm text-slate-500">Queue clear.</div>
                ) : (
                  lane.assets.slice(0, 5).map((asset) => (
                    <div key={`${lane.key}-${asset.id}`} className="px-5 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="mono text-sm font-semibold text-slate-950">
                            {asset.assetNumber}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">{asset.branch}</p>
                        </div>
                        <StatusPill label={titleize(asset.status)} />
                      </div>
                      <p className="mt-2 text-sm text-slate-600">
                        {asset.blockingReason ?? asset.custodyLocation ?? "Operator review"}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </section>
          ))}
        </div>
      }
    />
  );
}

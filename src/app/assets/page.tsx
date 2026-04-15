import Link from "next/link";

import { StatusPill } from "@/components/status-pill";
import {
  assetAvailabilities,
  assetStatuses,
  assetTypes,
  maintenanceStatuses,
} from "@/lib/domain/models";
import { formatCompactNumber, formatDate, titleize } from "@/lib/format";
import { getInventoryOverview, listAssetsPage } from "@/lib/server/platform";

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

type FilterState = {
  q?: string;
  branch?: string;
  status?: string;
  availability?: string;
  maintenanceStatus?: string;
  type?: string;
};

function getParam(value: string | string[] | undefined): string | undefined {
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

  const hours = Math.round((minutes / 60) * 10) / 10;
  return `${hours} hr`;
}

function hasActiveFilters(filters: FilterState) {
  return Object.values(filters).some(Boolean);
}

function describeOwner(
  asset: Awaited<ReturnType<typeof listAssetsPage>>["data"][number],
) {
  if (asset.activeDispatchTaskId) {
    return {
      label: `Dispatch ${asset.activeDispatchTaskId}`,
      detail: asset.activeDispatchTaskStatus
        ? titleize(asset.activeDispatchTaskStatus)
        : "Dispatch-owned",
    };
  }

  if (asset.activeWorkOrderId) {
    return {
      label: `Work order ${asset.activeWorkOrderId}`,
      detail: asset.activeWorkOrderStatus
        ? titleize(asset.activeWorkOrderStatus)
        : "Maintenance-owned",
    };
  }

  if (asset.activeContractNumber) {
    return {
      label: `Contract ${asset.activeContractNumber}`,
      detail: asset.activeCustomerName ?? "Customer-controlled",
    };
  }

  if (asset.status === "retired") {
    return {
      label: "Retired",
      detail: "Out of active fleet",
    };
  }

  return {
    label: "Unowned",
    detail: "No active downstream workflow",
  };
}

function describeClock(
  asset: Awaited<ReturnType<typeof listAssetsPage>>["data"][number],
) {
  if (asset.nextContractNumber && asset.nextReservationStart) {
    return {
      label: asset.nextContractNumber,
      detail: `Turns ${formatDate(asset.nextReservationStart)}`,
    };
  }

  return {
    label: formatFreshness(asset.telematicsFreshnessMinutes),
    detail:
      asset.telematicsFreshnessMinutes === null
        ? "Telematics blind"
        : asset.telematicsStale
          ? "Refresh needed"
          : "Telematics current",
  };
}

function describeLaneDetail(
  asset: Awaited<ReturnType<typeof listAssetsPage>>["data"][number],
) {
  if (asset.blockingReason) {
    return asset.blockingReason;
  }
  if (asset.nextContractNumber && asset.nextReservationStart) {
    return `Turns ${formatDate(asset.nextReservationStart)} on ${asset.nextContractNumber}.`;
  }
  if (asset.custodyLocation) {
    return asset.custodyLocation;
  }
  if (asset.telematicsFreshnessMinutes === null) {
    return "No recent telematics ping.";
  }
  if (asset.telematicsStale) {
    return `${asset.telematicsFreshnessMinutes} minutes since last ping.`;
  }

  return "Operator review.";
}

export default async function AssetsPage({ searchParams }: AssetsPageProps) {
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

  const [overview, pagedAssets] = await Promise.all([
    getInventoryOverview(),
    listAssetsPage({
      ...filters,
      page,
      pageSize,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(pagedAssets.total / pagedAssets.pageSize));
  const filtersActive = hasActiveFilters(filters);
  const summaryCards = [
    {
      label: "Ready now",
      value: overview.summary.rentReadyCount,
      note: `${formatPercent(overview.summary.readyRate)} of active fleet`,
      tone: "emerald",
    },
    {
      label: "Branch blocked",
      value: overview.summary.branchBlockedCount,
      note: "Reserved, dispatched, inspection, maintenance",
      tone: "amber",
    },
    {
      label: "On rent",
      value: overview.summary.onRentCount,
      note: "Customer-controlled inventory",
      tone: "sky",
    },
    {
      label: "Telematics blind",
      value: overview.summary.telematicsBlindCount,
      note: "Missing or stale last ping",
      tone: "rose",
    },
    {
      label: "Turns in 7 days",
      value: overview.summary.turningSoonCount,
      note: "Upcoming handoff pressure",
      tone: "slate",
    },
    {
      label: "Retired",
      value: overview.summary.retiredCount,
      note: "Out of active fleet",
      tone: "slate",
    },
  ] as const;
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

  return (
    <>
      <section className="panel overflow-hidden">
        <div className="grid gap-px bg-[var(--line)] 2xl:grid-cols-[minmax(0,1.8fr)_420px]">
          <div className="bg-white px-5 py-5 sm:px-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="eyebrow">Inventory Ops</p>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
                  Asset board
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                  Ready units, blocked capacity, branch pressure, and current ownership.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Link
                  href="/dispatch"
                  className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-700"
                >
                  Dispatch
                </Link>
                <Link
                  href="/inspections"
                  className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-700"
                >
                  Inspections
                </Link>
                <Link
                  href="/maintenance"
                  className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-700"
                >
                  Maintenance
                </Link>
              </div>
            </div>

            <div className="mt-5 grid gap-px rounded-xl border border-[var(--line)] bg-[var(--line)] sm:grid-cols-2 xl:grid-cols-3">
              {summaryCards.map((card) => (
                <div key={card.label} className="bg-white px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-slate-500">
                      {card.label}
                    </p>
                    <StatusPill label={card.label} tone={card.tone} />
                  </div>
                  <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
                    {formatCompactNumber(card.value)}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{card.note}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-px bg-[var(--line)]">
            <div className="bg-[var(--surface-soft)] px-5 py-5 sm:px-6">
              <p className="eyebrow">Live queues</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-[var(--line)] bg-white px-4 py-4">
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Dispatch
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-slate-950">
                    {formatCompactNumber(overview.activityCounts.dispatchOpen)}
                  </p>
                </div>
                <div className="rounded-lg border border-[var(--line)] bg-white px-4 py-4">
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Inspection
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-slate-950">
                    {formatCompactNumber(overview.activityCounts.inspectionOpen)}
                  </p>
                </div>
                <div className="rounded-lg border border-[var(--line)] bg-white px-4 py-4">
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Maintenance
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-slate-950">
                    {formatCompactNumber(overview.activityCounts.maintenanceOpen)}
                  </p>
                </div>
                <div className="rounded-lg border border-[var(--line)] bg-white px-4 py-4">
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Blind spots
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-slate-950">
                    {formatCompactNumber(overview.activityCounts.telematicsBlind)}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white px-5 py-5 sm:px-6">
              <p className="eyebrow">Current ownership</p>
              <div className="mt-4 space-y-3 text-sm text-slate-700">
                <div className="flex items-center justify-between gap-4 rounded-md border border-[var(--line)] px-3 py-2">
                  <span>Contract-owned</span>
                  <span className="mono text-xs text-slate-500">
                    {formatCompactNumber(overview.ownership.contractOwned)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4 rounded-md border border-[var(--line)] px-3 py-2">
                  <span>Dispatch-owned</span>
                  <span className="mono text-xs text-slate-500">
                    {formatCompactNumber(overview.ownership.dispatchOwned)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4 rounded-md border border-[var(--line)] px-3 py-2">
                  <span>Maintenance-owned</span>
                  <span className="mono text-xs text-slate-500">
                    {formatCompactNumber(overview.ownership.maintenanceOwned)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4 rounded-md border border-[var(--line)] px-3 py-2">
                  <span>Inspection-owned</span>
                  <span className="mono text-xs text-slate-500">
                    {formatCompactNumber(overview.ownership.inspectionOwned)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-[290px_minmax(0,1fr)]">
        <div className="grid gap-4 self-start xl:sticky xl:top-4">
          <section className="panel overflow-hidden">
            <div className="border-b border-[var(--line)] px-5 py-4">
              <p className="eyebrow">Scope</p>
              <h3 className="mt-1 text-lg font-semibold tracking-tight text-slate-900">
                Filter assets
              </h3>
            </div>
            <div className="px-5 py-4">
              <form className="grid gap-3" action="/assets">
                <input
                  type="text"
                  name="q"
                  defaultValue={filters.q ?? ""}
                  placeholder="Asset, serial, subtype, yard slot"
                  className="rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm text-slate-900"
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
                  className="rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm text-slate-900"
                >
                  <option value="">All asset types</option>
                  {assetTypes.map((type) => (
                    <option key={type} value={type}>
                      {titleize(type)}
                    </option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 rounded-md border border-slate-900 bg-slate-900 px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-white"
                  >
                    Apply
                  </button>
                  <Link
                    href="/assets"
                    className="rounded-md border border-[var(--line)] bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-700"
                  >
                    Reset
                  </Link>
                </div>
              </form>

              <div className="mt-4 border-t border-[var(--line)] pt-4">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Current scope
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {filtersActive ? (
                    activeFilterChips.map((chip) => (
                      <span
                        key={`${chip.label}-${chip.value}`}
                        className="rounded-md border border-[var(--line)] bg-[var(--surface-soft)] px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-slate-600"
                      >
                        {chip.label}: {chip.value}
                      </span>
                    ))
                  ) : (
                    <span className="rounded-md border border-[var(--line)] bg-[var(--surface-soft)] px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-slate-600">
                      Fleet-wide
                    </span>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className="panel overflow-hidden">
            <div className="border-b border-[var(--line)] px-5 py-4">
              <p className="eyebrow">Pressure</p>
              <h3 className="mt-1 text-lg font-semibold tracking-tight text-slate-900">
                Branch pressure
              </h3>
            </div>
            <div className="divide-y divide-[var(--line)]">
              {overview.branchPressure.slice(0, 8).map((branch) => {
                const total = Math.max(branch.active, 1);
                const readyWidth = `${(branch.available / total) * 100}%`;
                const blockedWidth = `${(branch.blocked / total) * 100}%`;
                const onRentWidth = `${(branch.onRent / total) * 100}%`;

                return (
                  <div key={branch.branch} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">{branch.branch}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          Ready {branch.available} / Blocked {branch.blocked} / On rent {branch.onRent}
                        </p>
                      </div>
                      <span className="mono text-xs text-slate-500">
                        {formatPercent(branch.readyRate)}
                      </span>
                    </div>

                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className="flex h-full">
                        <div className="bg-emerald-500" style={{ width: readyWidth }} />
                        <div className="bg-amber-400" style={{ width: blockedWidth }} />
                        <div className="bg-sky-500" style={{ width: onRentWidth }} />
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-3 text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-slate-500">
                      <span>Blind {branch.telematicsBlind}</span>
                      <span>Turns {branch.turningSoon}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="panel overflow-hidden">
            <div className="border-b border-[var(--line)] px-5 py-4">
              <p className="eyebrow">Mix</p>
              <h3 className="mt-1 text-lg font-semibold tracking-tight text-slate-900">
                Fleet mix
              </h3>
            </div>
            <div className="divide-y divide-[var(--line)]">
              {overview.fleetMix.slice(0, 5).map((entry) => (
                <div
                  key={entry.type}
                  className="flex items-center justify-between gap-3 px-5 py-3 text-sm text-slate-700"
                >
                  <span>{titleize(entry.type)}</span>
                  <span className="mono text-xs text-slate-500">
                    {formatCompactNumber(entry.count)}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="grid gap-4">
          <section className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
            {overview.actionLanes.map((lane) => (
              <div key={lane.key} className="panel overflow-hidden">
                <div className="border-b border-[var(--line)] px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="eyebrow">{lane.title}</p>
                      <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
                        {formatCompactNumber(lane.count)}
                      </p>
                    </div>
                    <Link
                      href={lane.href}
                      className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-[var(--brand)]"
                    >
                      Open queue
                    </Link>
                  </div>
                </div>

                <div className="divide-y divide-[var(--line)]">
                  {lane.assets.length === 0 ? (
                    <div className="px-5 py-6 text-sm text-slate-500">Clear.</div>
                  ) : (
                    lane.assets.map((asset) => (
                      <div
                        key={`${lane.key}-${asset.id}`}
                        className="grid gap-3 px-5 py-4 lg:grid-cols-[110px_minmax(0,1fr)_auto]"
                      >
                        <div>
                          <p className="mono text-sm font-semibold text-slate-900">
                            {asset.assetNumber}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">{asset.branch}</p>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-800">
                            {describeLaneDetail(asset)}
                          </p>
                          <p className="mt-1 truncate text-xs text-slate-500">
                            {titleize(asset.type)}
                            {asset.subtype ? ` / ${asset.subtype}` : ""}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-start gap-2">
                          <StatusPill label={titleize(asset.status)} />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </section>

          <section className="panel overflow-hidden">
            <div className="border-b border-[var(--line)] px-5 py-4">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <p className="eyebrow">Lookup</p>
                  <h3 className="mt-1 text-lg font-semibold tracking-tight text-slate-900">
                    Asset lookup
                  </h3>
                </div>
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.08em] text-slate-500">
                  <span>
                    {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, pagedAssets.total)}
                  </span>
                  <span>/</span>
                  <span>{formatCompactNumber(pagedAssets.total)}</span>
                  <span>/</span>
                  <span>Page {page}</span>
                </div>
              </div>
            </div>

            <div className="divide-y divide-[var(--line)]">
              {pagedAssets.data.length === 0 ? (
                <div className="px-5 py-8 text-sm text-slate-500">No assets match the current scope.</div>
              ) : (
                pagedAssets.data.map((asset) => {
                  const owner = describeOwner(asset);
                  const clock = describeClock(asset);

                  return (
                    <div
                      key={asset.id}
                      className="grid gap-4 px-5 py-4 transition hover:bg-slate-50/80 xl:grid-cols-[minmax(0,1.15fr)_220px_250px_220px]"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="mono text-sm font-semibold text-slate-950">
                            {asset.assetNumber}
                          </p>
                          <StatusPill label={titleize(asset.status)} />
                          <StatusPill label={titleize(asset.availability)} />
                          <StatusPill label={titleize(asset.maintenanceStatus)} />
                        </div>
                        <p className="mt-2 text-sm text-slate-700">
                          {titleize(asset.type)}
                          {asset.subtype ? ` / ${asset.subtype}` : ""}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {asset.dimensions}
                          {asset.serialNumber ? ` • SN ${asset.serialNumber}` : ""}
                        </p>
                      </div>

                      <div>
                        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-slate-500">
                          Placement
                        </p>
                        <p className="mt-2 text-sm font-medium text-slate-800">
                          {asset.custodyLocation ?? asset.branch}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {asset.locationSource ? titleize(asset.locationSource) : asset.branch}
                        </p>
                      </div>

                      <div>
                        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-slate-500">
                          Owner
                        </p>
                        <p className="mt-2 text-sm font-medium text-slate-800">{owner.label}</p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          {asset.blockingReason ?? owner.detail}
                        </p>
                      </div>

                      <div>
                        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-slate-500">
                          Clock
                        </p>
                        <p className="mt-2 text-sm font-medium text-slate-800">{clock.label}</p>
                        <p className="mt-1 text-xs text-slate-500">{clock.detail}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="border-t border-[var(--line)] px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-slate-500">
                  {filtersActive ? "Filtered lookup." : "Fleet-wide lookup."}
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
            </div>
          </section>
        </div>
      </section>
    </>
  );
}

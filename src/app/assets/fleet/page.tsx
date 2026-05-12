import { Suspense } from "react";

import { InstantForm } from "@/components/instant-form";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { WorkspaceLink } from "@/components/workspace-link";
import { ListPageSkeleton } from "@/components/workspace-skeletons";
import {
  assetAvailabilities,
  assetStatuses,
  assetTypes,
  maintenanceStatuses,
} from "@/lib/domain/models";
import { formatCompactNumber, formatCurrency, titleize } from "@/lib/format";
import { getEquipmentListView } from "@/lib/server/platform";

export const unstable_instant = { prefetch: "static" };

type AssetsPageProps = {
  searchParams: Promise<{
    q?: string | string[];
    branch?: string | string[];
    status?: string | string[];
    availability?: string | string[];
    maintenanceStatus?: string | string[];
    type?: string | string[];
    faClassCode?: string | string[];
    faSubclassCode?: string | string[];
    blocked?: string | string[];
    inactive?: string | string[];
    disposed?: string | string[];
    onRent?: string | string[];
    inService?: string | string[];
    underMaintenance?: string | string[];
    page?: string | string[];
  }>;
};

function getParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function buildHref(
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
  return query ? `/equipment?${query}` : "/equipment";
}

function booleanLabel(value: boolean) {
  return value ? "Yes" : "No";
}

export default function AssetsPage({ searchParams }: AssetsPageProps) {
  return (
    <Suspense fallback={<ListPageSkeleton filters={13} columns={7} />}>
      <AssetsContent searchParams={searchParams} />
    </Suspense>
  );
}

async function AssetsContent({ searchParams }: AssetsPageProps) {
  const resolved = await searchParams;
  const filters = {
    q: getParam(resolved.q),
    branch: getParam(resolved.branch),
    status: getParam(resolved.status),
    availability: getParam(resolved.availability),
    maintenanceStatus: getParam(resolved.maintenanceStatus),
    type: getParam(resolved.type),
    faClassCode: getParam(resolved.faClassCode),
    faSubclassCode: getParam(resolved.faSubclassCode),
    blocked: getParam(resolved.blocked),
    inactive: getParam(resolved.inactive),
    disposed: getParam(resolved.disposed),
    onRent: getParam(resolved.onRent),
    inService: getParam(resolved.inService),
    underMaintenance: getParam(resolved.underMaintenance),
  };
  const page = Math.max(1, Number(getParam(resolved.page) ?? "1"));
  const pageSize = 25;

  const view = await getEquipmentListView({ ...filters, page, pageSize });
  const totalPages = Math.max(1, Math.ceil(view.total / view.pageSize));
  const filtersActive = Object.values(filters).some(Boolean);

  const blockedCount = view.data.filter((asset) => asset.isBlocked).length;
  const onRentCount = view.data.filter((asset) => asset.isOnRent).length;
  const maintenanceCount = view.data.filter((asset) => asset.underMaintenance).length;
  const bcSeededCount = view.data.filter(
    (asset) => asset.sourceProvider === "business_central",
  ).length;

  return (
    <div className="space-y-2">
      <PageHeader
        eyebrow="Operations"
        title="Equipment"
        description="BC-enriched trailers, containers, chassis, and equipment with lifecycle state, revenue, latest customer, and source lineage."
        actions={
          <>
            <WorkspaceLink href="/assets" className="btn-secondary">
              Equipment overview
            </WorkspaceLink>
            <WorkspaceLink href="/leases" className="btn-secondary">
              Leases
            </WorkspaceLink>
            <WorkspaceLink href="/integrations/business-central" className="btn-secondary">
              BC import
            </WorkspaceLink>
          </>
        }
      />

      <div className="panel px-3 py-2">
        <InstantForm className="flex flex-wrap items-end gap-2" action="/equipment">
          <input
            type="text"
            name="q"
            defaultValue={filters.q ?? ""}
            placeholder="Asset, serial, branch, yard..."
            className="workspace-input w-44"
          />
          <input
            type="text"
            name="branch"
            defaultValue={filters.branch ?? ""}
            placeholder="Branch"
            className="workspace-input w-24"
          />
          <select
            name="status"
            defaultValue={filters.status ?? ""}
            className="workspace-input w-32"
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
            className="workspace-input w-32"
          >
            <option value="">All avail.</option>
            {assetAvailabilities.map((availability) => (
              <option key={availability} value={availability}>
                {titleize(availability)}
              </option>
            ))}
          </select>
          <select
            name="maintenanceStatus"
            defaultValue={filters.maintenanceStatus ?? ""}
            className="workspace-input w-32"
          >
            <option value="">All maint.</option>
            {maintenanceStatuses.map((status) => (
              <option key={status} value={status}>
                {titleize(status)}
              </option>
            ))}
          </select>
          <select
            name="type"
            defaultValue={filters.type ?? ""}
            className="workspace-input w-36"
          >
            <option value="">All types</option>
            {assetTypes.map((type) => (
              <option key={type} value={type}>
                {titleize(type)}
              </option>
            ))}
          </select>
          <input
            type="text"
            name="faClassCode"
            defaultValue={filters.faClassCode ?? ""}
            placeholder="FA class"
            className="workspace-input w-24"
          />
          <input
            type="text"
            name="faSubclassCode"
            defaultValue={filters.faSubclassCode ?? ""}
            placeholder="FA subclass"
            className="workspace-input w-24"
          />
          {[
            ["blocked", "Blocked"],
            ["inactive", "Inactive"],
            ["disposed", "Disposed"],
            ["onRent", "On rent"],
            ["inService", "In service"],
            ["underMaintenance", "Under maint."],
          ].map(([name, label]) => (
            <select
              key={name}
              name={name}
              defaultValue={filters[name as keyof typeof filters] ?? ""}
              className="workspace-input w-28"
            >
              <option value="">{label}</option>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          ))}
          <button type="submit" className="btn-primary">
            Apply
          </button>
          <WorkspaceLink href="/equipment" className="btn-secondary">
            Reset
          </WorkspaceLink>
        </InstantForm>
      </div>

      <div className="grid grid-cols-4 gap-px border border-[var(--line)] bg-[var(--line)]">
        {[
          { label: "In scope", value: formatCompactNumber(view.total) },
          { label: "BC seeded", value: formatCompactNumber(bcSeededCount) },
          { label: "Blocked", value: formatCompactNumber(blockedCount) },
          { label: "On rent", value: formatCompactNumber(onRentCount) },
          { label: "Under maint.", value: formatCompactNumber(maintenanceCount) },
          {
            label: "In service",
            value: formatCompactNumber(view.data.filter((asset) => asset.isInService).length),
          },
          {
            label: "Disposed",
            value: formatCompactNumber(view.data.filter((asset) => asset.isDisposed).length),
          },
          {
            label: "Book value",
            value: formatCurrency(
              view.data.reduce((sum, asset) => sum + (asset.bookValue ?? 0), 0),
            ),
          },
        ].map((metric) => (
          <div key={metric.label} className="bg-white px-3 py-2">
            <p className="workspace-metric-label">{metric.label}</p>
            <p className="text-base font-semibold text-slate-900">{metric.value}</p>
          </div>
        ))}
      </div>

      <div className="panel overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--line)] px-3 py-1.5">
          <span className="text-[0.75rem] text-slate-500">
            {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, view.total)} of{" "}
            {formatCompactNumber(view.total)}
            {filtersActive ? " (filtered)" : ""}
          </span>
          <span className="text-[0.65rem] font-semibold uppercase tracking-[0.06em] text-slate-400">
            Page {page}/{totalPages}
          </span>
        </div>
        <div className="data-table border-0">
          <table>
            <thead>
              <tr>
                <th>Asset</th>
                <th>Classification</th>
                <th>Identity</th>
                <th>Branch / BC</th>
                <th>Lifecycle</th>
                <th>Flags</th>
                <th>Latest rental</th>
                <th>Revenue</th>
              </tr>
            </thead>
            <tbody>
              {view.data.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-slate-400">
                    No assets match the current scope.
                  </td>
                </tr>
              ) : (
                view.data.map((asset) => (
                  <tr key={asset.id}>
                    <td>
                      <WorkspaceLink
                        href={`/equipment/${asset.id}`}
                        className="font-semibold text-[var(--brand)]"
                      >
                        {asset.assetNumber}
                      </WorkspaceLink>
                      <br />
                      <span className="text-[0.65rem] text-slate-400">
                        {asset.branch} / {asset.branchCode}
                      </span>
                    </td>
                    <td>
                      <span className="text-slate-700">{titleize(asset.type)}</span>
                      <br />
                      <span className="text-[0.65rem] text-slate-400">
                        {(asset.subtype ?? "-") + " / " + (asset.faClassCode ?? "-")}
                      </span>
                      <br />
                      <span className="text-[0.65rem] text-slate-400">
                        {asset.faSubclassCode ?? "No subclass"}
                      </span>
                    </td>
                    <td>
                      <span className="text-slate-700">{asset.manufacturer ?? "Unknown mfg."}</span>
                      <br />
                      <span className="text-[0.65rem] text-slate-400">
                        SN {asset.serialNumber ?? "-"} / Reg {asset.registrationNumber ?? "-"}
                      </span>
                      <br />
                      <span className="text-[0.65rem] text-slate-400">
                        Model year {asset.modelYear ?? "-"}
                      </span>
                    </td>
                    <td>
                      <span className="text-slate-700">
                        {asset.bcLocationCode ?? asset.branchCode ?? "-"}
                      </span>
                      <br />
                      <span className="text-[0.65rem] text-slate-400">
                        Dim1 {asset.bcDimension1Code ?? "-"}
                      </span>
                      <br />
                      <span className="text-[0.65rem] text-slate-400">
                        Prod {asset.bcProductNo ?? "-"} / Svc {asset.bcServiceItemNo ?? "-"}
                      </span>
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        <StatusPill label={titleize(asset.status)} />
                        <StatusPill label={titleize(asset.availability)} />
                        <StatusPill label={titleize(asset.maintenanceStatus)} />
                      </div>
                      <div className="mt-1 text-[0.65rem] text-slate-400">
                        Book {formatCurrency(asset.bookValue ?? 0)}
                      </div>
                    </td>
                    <td className="text-[0.7rem] text-slate-600">
                      <div>Blocked: {booleanLabel(asset.isBlocked)}</div>
                      <div>Inactive: {booleanLabel(asset.isInactive)}</div>
                      <div>Disposed: {booleanLabel(asset.isDisposed)}</div>
                      <div>On rent: {booleanLabel(asset.isOnRent)}</div>
                      <div>In service: {booleanLabel(asset.isInService)}</div>
                      <div>Maint: {booleanLabel(asset.underMaintenance)}</div>
                    </td>
                    <td>
                      {asset.latestInvoiceNo ? (
                        <WorkspaceLink
                          href={`/ar/invoices/${asset.latestInvoiceNo}`}
                          className="font-semibold text-[var(--brand)]"
                        >
                          {asset.latestInvoiceNo}
                        </WorkspaceLink>
                      ) : (
                        <span className="text-slate-400">No BC invoice</span>
                      )}
                      <br />
                      <span className="text-[0.65rem] text-slate-400">
                        {asset.latestLeaseKey ? `Lease ${asset.latestLeaseKey}` : "No lease"}
                      </span>
                      <br />
                      <span className="text-[0.65rem] text-slate-400">
                        {asset.latestCustomerName ?? asset.latestCustomerNo ?? "No customer"}
                      </span>
                    </td>
                    <td>
                      <span className="font-semibold text-slate-900">
                        {formatCurrency(asset.lifetimeRevenue)}
                      </span>
                      <br />
                      <span className="text-[0.65rem] text-slate-400">
                        {asset.invoiceLineCount} lines / {asset.invoiceCount} invoices
                      </span>
                      <br />
                      <StatusPill
                        label={titleize(asset.sourceProvider.replaceAll("_", " "))}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-[var(--line)] px-3 py-1.5">
          <span className="text-[0.7rem] text-slate-400">
            {filtersActive ? "BC-aware filtered view" : "All asset master records"}
          </span>
          <div className="flex gap-1.5">
            <WorkspaceLink
              href={buildHref(filters, {
                page: page > 1 ? String(page - 1) : undefined,
              })}
              className="btn-secondary"
            >
              Prev
            </WorkspaceLink>
            <WorkspaceLink
              href={buildHref(filters, {
                page: page < totalPages ? String(page + 1) : String(totalPages),
              })}
              className="btn-secondary"
            >
              Next
            </WorkspaceLink>
          </div>
        </div>
      </div>
    </div>
  );
}

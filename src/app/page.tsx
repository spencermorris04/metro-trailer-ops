import Link from "next/link";
import { headers } from "next/headers";
import { Fragment, Suspense, type ReactNode } from "react";
import { count, desc, eq, isNull, sql } from "drizzle-orm";

import { DashboardCustomizer } from "@/components/dashboard-customizer";
import { Icon } from "@/components/icons";
import { StatusPill } from "@/components/status-pill";
import { DashboardSkeleton } from "@/components/workspace-skeletons";
import {
  formatCompactNumber,
  formatCurrency,
  formatDate,
  titleize,
} from "@/lib/format";
import {
  getActiveDashboardPreset,
  normalizeDashboardPreferences,
  type DashboardWidgetId,
} from "@/lib/dashboard-preferences";
import { db, schema } from "@/lib/db";
import {
  getDashboardSummary,
  getFinancialOverview,
  getInventoryOverview,
  listBranches,
  listDispatchTasks,
  listInspections,
  listWorkOrders,
} from "@/lib/server/platform";
import { getWorkspaceLayout } from "@/lib/server/workspace-layouts";

export const unstable_instant = { prefetch: "static" };

const defaultShellLayout = {
  left: 108,
  right: 0,
  activeStore: "all",
  density: "comfortable",
  theme: "light",
  hideCategoryRail: false,
};

const widgetOptions: Array<{
  id: DashboardWidgetId;
  label: string;
  description: string;
}> = [
  {
    id: "fleet-summary",
    label: "Serialized Fleet Quantity",
    description: "Available, on-rent, maintenance, and blocked fleet posture.",
  },
  {
    id: "fleet-category",
    label: "Fleet By Category",
    description: "Trailer mix and utilization by equipment category.",
  },
  {
    id: "open-repairs",
    label: "Open Repairs",
    description: "Maintenance and inspection work waiting for release.",
  },
  {
    id: "branch-pressure",
    label: "Branch Pressure",
    description: "Store-level readiness, blocked units, and telemetry blind spots.",
  },
  {
    id: "execution-queues",
    label: "Dispatch And Inspection",
    description: "Operational queues for dispatch, inspections, and maintenance.",
  },
  {
    id: "contracts",
    label: "Contracts",
    description: "Signature, invoicing, receivable, and close readiness.",
  },
  {
    id: "open-ar",
    label: "Open AR",
    description: "Contracts and customers carrying receivable balances.",
  },
  {
    id: "source-documents",
    label: "BC Source Documents",
    description: "Recently imported rental and commercial source documents.",
  },
  {
    id: "bc-health",
    label: "BC Import Health",
    description: "Recent Business Central runs, errors, and sync failures.",
  },
  {
    id: "top-customers",
    label: "Top Customers",
    description: "High-footprint customers by site and branch coverage.",
  },
  {
    id: "recent-invoices",
    label: "Recent Invoices",
    description: "Latest AR invoices and reconciliation posture.",
  },
];

function numberFromDb(value: unknown) {
  return typeof value === "number" ? value : Number(value ?? 0);
}

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function dateLabel(value: string | Date | null | undefined) {
  if (!value) {
    return "No date";
  }

  return formatDate(value instanceof Date ? value.toISOString() : value);
}

function storeMatches(
  activeStore: string,
  branch: { id: string; code: string; name: string } | undefined,
  value: string | null | undefined,
) {
  if (activeStore === "all") {
    return true;
  }
  if (!value) {
    return false;
  }

  return branch
    ? [branch.id, branch.code, branch.name].includes(value)
    : value === activeStore;
}

function WidgetFrame({
  title,
  href,
  children,
  wide = false,
  xwide = false,
}: {
  title: string;
  href?: string;
  children: ReactNode;
  wide?: boolean;
  xwide?: boolean;
}) {
  return (
    <section
      className={`dashboard-widget ${wide ? "dashboard-widget-wide" : ""} ${
        xwide ? "dashboard-widget-xwide" : ""
      }`}
    >
      <div className="dashboard-widget-header">
        <h2 className="dashboard-widget-title">{title}</h2>
        {href ? (
          <Link href={href} className="text-[0.68rem] font-semibold text-[var(--brand)]">
            Open
          </Link>
        ) : null}
      </div>
      <div className="dashboard-widget-body">{children}</div>
    </section>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="border border-dashed border-[var(--line)] px-3 py-8 text-center text-[0.78rem] text-slate-500">
      {label}
    </div>
  );
}

async function getBusinessCentralDashboardData() {
  const [
    recentSourceDocuments,
    sourceDocumentCounts,
    recentImportRuns,
    unresolvedImportErrors,
    failedSyncJobs,
    apBills,
  ] = await Promise.all([
    db
      .select({
        id: schema.bcSourceDocuments.id,
        documentType: schema.bcSourceDocuments.documentType,
        documentNo: schema.bcSourceDocuments.documentNo,
        status: schema.bcSourceDocuments.status,
        customerExternalId: schema.bcSourceDocuments.customerExternalId,
        documentDate: schema.bcSourceDocuments.documentDate,
        importedAt: schema.bcSourceDocuments.importedAt,
      })
      .from(schema.bcSourceDocuments)
      .orderBy(desc(schema.bcSourceDocuments.importedAt))
      .limit(8),
    db
      .select({
        documentType: schema.bcSourceDocuments.documentType,
        status: schema.bcSourceDocuments.status,
        total: count(schema.bcSourceDocuments.id),
      })
      .from(schema.bcSourceDocuments)
      .groupBy(schema.bcSourceDocuments.documentType, schema.bcSourceDocuments.status)
      .limit(12),
    db
      .select({
        id: schema.bcImportRuns.id,
        entityType: schema.bcImportRuns.entityType,
        status: schema.bcImportRuns.status,
        recordsSeen: schema.bcImportRuns.recordsSeen,
        recordsFailed: schema.bcImportRuns.recordsFailed,
        errorSummary: schema.bcImportRuns.errorSummary,
        startedAt: schema.bcImportRuns.startedAt,
      })
      .from(schema.bcImportRuns)
      .orderBy(desc(schema.bcImportRuns.startedAt))
      .limit(6),
    db
      .select({ total: count(schema.bcImportErrors.id) })
      .from(schema.bcImportErrors)
      .where(isNull(schema.bcImportErrors.resolvedAt)),
    db
      .select({ total: count(schema.integrationSyncJobs.id) })
      .from(schema.integrationSyncJobs)
      .where(eq(schema.integrationSyncJobs.status, "failed")),
    db
      .select({
        id: schema.apBills.id,
        billNumber: schema.apBills.billNumber,
        status: schema.apBills.status,
        dueDate: schema.apBills.dueDate,
        balanceAmount: schema.apBills.balanceAmount,
        vendorName: schema.bcVendors.name,
      })
      .from(schema.apBills)
      .innerJoin(schema.bcVendors, eq(schema.apBills.vendorId, schema.bcVendors.id))
      .orderBy(desc(schema.apBills.billDate))
      .limit(6),
  ]);

  return {
    recentSourceDocuments,
    sourceDocumentCounts,
    recentImportRuns,
    unresolvedImportErrorCount: unresolvedImportErrors[0]?.total ?? 0,
    failedSyncJobCount: failedSyncJobs[0]?.total ?? 0,
    apBills,
  };
}

async function getDashboardTopCustomers() {
  const locationCount = sql<number>`count(${schema.customerLocations.id})`;
  const branchCoverageCount = sql<number>`coalesce(jsonb_array_length(${schema.customers.branchCoverage}), 0)`;

  const rows = await db
    .select({
      id: schema.customers.id,
      customerNumber: schema.customers.customerNumber,
      name: schema.customers.name,
      customerType: schema.customers.customerType,
      locationCount,
      branchCoverageCount,
    })
    .from(schema.customers)
    .leftJoin(
      schema.customerLocations,
      eq(schema.customerLocations.customerId, schema.customers.id),
    )
    .groupBy(
      schema.customers.id,
      schema.customers.customerNumber,
      schema.customers.name,
      schema.customers.customerType,
      schema.customers.branchCoverage,
    )
    .orderBy(desc(locationCount), desc(branchCoverageCount), schema.customers.name)
    .limit(8);

  return rows.map((row) => ({
    ...row,
    locationCount: Number(row.locationCount),
    branchCoverageCount: Number(row.branchCoverageCount),
  }));
}

export default function HomePage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <HomeDashboard />
    </Suspense>
  );
}

async function HomeDashboard() {
  const requestHeaders = new Headers(await headers());
  const [
    shellLayoutResult,
    dashboardLayoutResult,
    summary,
    inventory,
    financial,
    topCustomers,
    branches,
    dispatchTasks,
    inspections,
    workOrders,
    bcData,
  ] = await Promise.all([
    getWorkspaceLayout(requestHeaders, "shell", defaultShellLayout),
    getWorkspaceLayout(requestHeaders, "dashboards", normalizeDashboardPreferences(null)),
    getDashboardSummary(),
    getInventoryOverview(),
    getFinancialOverview(),
    getDashboardTopCustomers(),
    listBranches(),
    listDispatchTasks(),
    listInspections(),
    listWorkOrders(),
    getBusinessCentralDashboardData(),
  ]);

  const shellLayout = shellLayoutResult.layout as typeof defaultShellLayout;
  const preferences = normalizeDashboardPreferences(dashboardLayoutResult.layout);
  const activePreset = getActiveDashboardPreset(preferences);
  const visibleWidgets = new Set(activePreset.visibleWidgets);
  const activeBranch = branches.find(
    (branch) =>
      branch.id === shellLayout.activeStore ||
      branch.code === shellLayout.activeStore ||
      branch.name === shellLayout.activeStore,
  );
  const activeStoreLabel = activeBranch?.name ?? "All Stores";
  const scopedBranchPressure = inventory.branchPressure.filter((branch) =>
    storeMatches(shellLayout.activeStore, activeBranch, branch.branch),
  );
  const branchPressure =
    scopedBranchPressure.length > 0 ? scopedBranchPressure : inventory.branchPressure;
  const openDispatchTasks = dispatchTasks.filter((task) => task.status !== "completed");
  const openInspections = inspections.filter((inspection) =>
    ["requested", "in_progress", "needs_review"].includes(inspection.status),
  );
  const openWorkOrders = workOrders.filter(
    (order) => !["verified", "closed", "cancelled"].includes(order.status),
  );
  const branchDispatchTasks = openDispatchTasks.filter((task) =>
    storeMatches(shellLayout.activeStore, activeBranch, task.branch),
  );
  const branchWorkOrders = openWorkOrders.filter((order) =>
    storeMatches(shellLayout.activeStore, activeBranch, order.branch),
  );
  const totalSourceDocuments = bcData.sourceDocumentCounts.reduce(
    (sum, item) => sum + Number(item.total),
    0,
  );
  const openReceivablesTotal = financial.queues.openReceivables.reduce(
    (sum, contract) => sum + (contract.outstandingBalance ?? 0),
    0,
  );
  const activeWidgetOrder = activePreset.widgetOrder.filter((id) => visibleWidgets.has(id));

  const kpis = [
    {
      label: "Fleet",
      value: formatCompactNumber(summary.assets),
      note: `${percent(inventory.summary.readyRate)} ready`,
    },
    {
      label: "On rent",
      value: formatCompactNumber(inventory.summary.onRentCount),
      note: `${formatCompactNumber(inventory.summary.rentReadyCount)} rent ready`,
    },
    {
      label: "Open repairs",
      value: formatCompactNumber(openWorkOrders.length),
      note: `${openInspections.length} inspections`,
    },
    {
      label: "Contracts",
      value: formatCompactNumber(summary.activeContracts),
      note: `${financial.metrics.readyToInvoice} ready to invoice`,
    },
    {
      label: "Open AR",
      value: formatCurrency(openReceivablesTotal),
      note: `${summary.overdueInvoices} overdue invoices`,
    },
    {
      label: "Uninvoiced",
      value: formatCurrency(financial.metrics.uninvoicedEventAmount),
      note: `${financial.metrics.readyToInvoice} contracts`,
    },
    {
      label: "BC docs",
      value: formatCompactNumber(totalSourceDocuments),
      note: `${bcData.unresolvedImportErrorCount} import errors`,
    },
    {
      label: "Store",
      value: activeBranch?.code ?? "All",
      note: activePreset.label,
    },
  ];

  const widgetRenderers: Record<DashboardWidgetId, React.ReactNode> = {
    "fleet-summary": (
      <WidgetFrame title="Serialized Fleet Quantity" href="/assets" wide>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            {
              label: "Available",
              value: inventory.summary.rentReadyCount,
              rate: inventory.summary.readyRate,
              color: "#2563eb",
            },
            {
              label: "On Rent",
              value: inventory.summary.onRentCount,
              rate:
                inventory.summary.activeAssetsCount > 0
                  ? inventory.summary.onRentCount / inventory.summary.activeAssetsCount
                  : 0,
              color: "#f59e0b",
            },
            {
              label: "Branch Blocked",
              value: inventory.summary.branchBlockedCount,
              rate:
                inventory.summary.activeAssetsCount > 0
                  ? inventory.summary.branchBlockedCount / inventory.summary.activeAssetsCount
                  : 0,
              color: "#e11d48",
            },
            {
              label: "Telemetry Blind",
              value: inventory.summary.telematicsBlindCount,
              rate:
                inventory.summary.activeAssetsCount > 0
                  ? inventory.summary.telematicsBlindCount / inventory.summary.activeAssetsCount
                  : 0,
              color: "#64748b",
            },
          ].map((item) => (
            <div key={item.label} className="border border-[var(--line)] p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="workspace-metric-label">{item.label}</span>
                <span className="mono text-[0.7rem] text-slate-500">{percent(item.rate)}</span>
              </div>
              <div className="mt-2 text-2xl font-semibold text-slate-950">
                {formatCompactNumber(item.value)}
              </div>
              <div className="dashboard-progress mt-3">
                <span
                  style={{
                    width: `${Math.max(2, Math.min(100, item.rate * 100))}%`,
                    backgroundColor: item.color,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </WidgetFrame>
    ),
    "fleet-category": (
      <WidgetFrame title="Serialized Fleet By Category" href="/assets" wide>
        <div className="grid gap-2">
          {inventory.fleetMix.slice(0, 7).map((item) => {
            const rate =
              inventory.summary.totalAssets > 0 ? item.count / inventory.summary.totalAssets : 0;
            return (
              <div key={item.type}>
                <div className="mb-1 flex items-center justify-between gap-3 text-[0.76rem]">
                  <span className="font-semibold text-slate-700">{titleize(item.type)}</span>
                  <span className="mono text-slate-500">{formatCompactNumber(item.count)}</span>
                </div>
                <div className="dashboard-progress">
                  <span style={{ width: `${Math.max(2, rate * 100)}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </WidgetFrame>
    ),
    "open-repairs": (
      <WidgetFrame title="Open Repairs" href="/maintenance">
        <div className="grid grid-cols-2 gap-px overflow-hidden border border-[var(--line)] bg-[var(--line)]">
          <div className="bg-white p-3 text-center">
            <div className="text-3xl font-semibold text-slate-950">{openWorkOrders.length}</div>
            <div className="mt-1 text-[0.72rem] font-semibold text-slate-600">
              Open Maintenance
            </div>
          </div>
          <div className="bg-white p-3 text-center">
            <div className="text-3xl font-semibold text-slate-950">{openInspections.length}</div>
            <div className="mt-1 text-[0.72rem] font-semibold text-slate-600">
              Inspection Holds
            </div>
          </div>
        </div>
        <div className="mt-3 divide-y divide-[var(--line)] border border-[var(--line)]">
          {openWorkOrders.slice(0, 5).map((order) => (
            <div key={order.id} className="workspace-list-row">
              <span className="min-w-0 truncate">
                {order.assetNumber} / {order.title}
              </span>
              <StatusPill label={titleize(order.status)} />
            </div>
          ))}
        </div>
      </WidgetFrame>
    ),
    "branch-pressure": (
      <WidgetFrame title="Branch Pressure" href="/assets" wide>
        <div className="grid gap-2">
          {branchPressure.slice(0, 8).map((branch) => (
            <div key={branch.branch} className="border border-[var(--line)] p-2">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-[0.8rem] font-semibold text-slate-900">
                    {branch.branch}
                  </div>
                  <div className="mt-0.5 text-[0.68rem] text-slate-500">
                    {branch.available} ready / {branch.blocked} blocked /{" "}
                    {branch.telematicsBlind} telemetry blind
                  </div>
                </div>
                <StatusPill label={percent(branch.readyRate)} />
              </div>
              <div className="dashboard-progress mt-2">
                <span style={{ width: `${Math.max(2, branch.readyRate * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </WidgetFrame>
    ),
    "execution-queues": (
      <WidgetFrame title="Dispatch And Inspection Queues" href="/dispatch" wide>
        <div className="grid gap-3 lg:grid-cols-3">
          <div>
            <div className="workspace-section-label">Dispatch</div>
            <div className="mt-2 divide-y divide-[var(--line)] border border-[var(--line)]">
              {(branchDispatchTasks.length > 0 ? branchDispatchTasks : openDispatchTasks)
                .slice(0, 5)
                .map((task) => (
                  <div key={task.id} className="px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="mono text-[0.7rem] font-semibold text-slate-800">
                        {task.assetNumber}
                      </span>
                      <StatusPill label={titleize(task.status)} />
                    </div>
                    <p className="mt-1 truncate text-[0.72rem] text-slate-500">
                      {task.type} / {task.customerSite}
                    </p>
                  </div>
                ))}
            </div>
          </div>
          <div>
            <div className="workspace-section-label">Inspections</div>
            <div className="mt-2 divide-y divide-[var(--line)] border border-[var(--line)]">
              {openInspections.slice(0, 5).map((inspection) => (
                <div key={inspection.id} className="px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="mono text-[0.7rem] font-semibold text-slate-800">
                      {inspection.assetNumber}
                    </span>
                    <StatusPill label={titleize(inspection.status)} />
                  </div>
                  <p className="mt-1 truncate text-[0.72rem] text-slate-500">
                    {inspection.inspectionType} / {inspection.customerSite}
                  </p>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="workspace-section-label">Maintenance</div>
            <div className="mt-2 divide-y divide-[var(--line)] border border-[var(--line)]">
              {(branchWorkOrders.length > 0 ? branchWorkOrders : openWorkOrders)
                .slice(0, 5)
                .map((order) => (
                  <div key={order.id} className="px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="mono text-[0.7rem] font-semibold text-slate-800">
                        {order.assetNumber}
                      </span>
                      <StatusPill label={titleize(order.status)} />
                    </div>
                    <p className="mt-1 truncate text-[0.72rem] text-slate-500">{order.title}</p>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </WidgetFrame>
    ),
    contracts: (
      <WidgetFrame title="Leases" href="/leases" wide>
        <div className="grid grid-cols-4 gap-px overflow-hidden border border-[var(--line)] bg-[var(--line)]">
          {[
            ["Awaiting signature", financial.metrics.awaitingSignature],
            ["Ready to invoice", financial.metrics.readyToInvoice],
            ["Open AR", financial.metrics.openReceivables],
            ["Ready close", financial.metrics.readyToClose],
          ].map(([label, value]) => (
            <div key={label} className="bg-white p-3">
              <div className="text-xl font-semibold text-slate-950">
                {formatCompactNumber(value as number)}
              </div>
              <div className="mt-1 text-[0.65rem] font-semibold text-slate-500">{label}</div>
            </div>
          ))}
        </div>
        <div className="mt-3 divide-y divide-[var(--line)] border border-[var(--line)]">
          {financial.queues.readyToInvoice.slice(0, 5).map((contract) => (
            <div key={contract.id} className="workspace-list-row">
              <span className="min-w-0 truncate">
                {contract.contractNumber} / {contract.customerName}
              </span>
              <span className="mono text-[0.7rem]">
                {formatCurrency(contract.uninvoicedEventAmount ?? 0)}
              </span>
            </div>
          ))}
        </div>
      </WidgetFrame>
    ),
    "open-ar": (
      <WidgetFrame title="Open AR" href="/ar/invoices" wide>
        {financial.queues.openReceivables.length === 0 ? (
          <EmptyState label="No open receivable contracts." />
        ) : (
          <div className="divide-y divide-[var(--line)] border border-[var(--line)]">
            {financial.queues.openReceivables.slice(0, 8).map((contract) => (
              <div key={contract.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="min-w-0">
                  <div className="truncate text-[0.78rem] font-semibold text-slate-900">
                    {contract.customerName}
                  </div>
                  <div className="mt-0.5 text-[0.68rem] text-slate-500">
                    {contract.contractNumber} / {titleize(contract.status)}
                  </div>
                </div>
                <span className="mono shrink-0 text-[0.75rem] font-semibold text-slate-950">
                  {formatCurrency(contract.outstandingBalance ?? 0)}
                </span>
              </div>
            ))}
          </div>
        )}
      </WidgetFrame>
    ),
    "source-documents": (
      <WidgetFrame title="BC Source Documents" href="/source-documents" xwide>
        <div className="grid gap-3 lg:grid-cols-[220px_1fr]">
          <div className="divide-y divide-[var(--line)] border border-[var(--line)]">
            {bcData.sourceDocumentCounts.slice(0, 5).map((item) => (
              <div key={`${item.documentType}-${item.status}`} className="workspace-list-row">
                <span className="min-w-0 truncate">{item.documentType}</span>
                <strong>{formatCompactNumber(Number(item.total))}</strong>
              </div>
            ))}
          </div>
          <div className="divide-y divide-[var(--line)] border border-[var(--line)]">
            {bcData.recentSourceDocuments.slice(0, 6).map((document) => (
              <div key={document.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="min-w-0">
                  <div className="truncate text-[0.78rem] font-semibold text-slate-900">
                    {document.documentNo}
                  </div>
                  <div className="mt-0.5 text-[0.68rem] text-slate-500">
                    {document.documentType} / {document.customerExternalId ?? "No customer"} /{" "}
                    {dateLabel(document.documentDate)}
                  </div>
                </div>
                <StatusPill label={document.status ?? "Imported"} />
              </div>
            ))}
          </div>
        </div>
      </WidgetFrame>
    ),
    "bc-health": (
      <WidgetFrame title="Business Central Import Health" href="/integrations/business-central" wide>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="border border-[var(--line)] p-3">
            <div className="workspace-metric-label">Unresolved import errors</div>
            <div className="mt-1 text-2xl font-semibold text-slate-950">
              {formatCompactNumber(bcData.unresolvedImportErrorCount)}
            </div>
          </div>
          <div className="border border-[var(--line)] p-3">
            <div className="workspace-metric-label">Failed sync jobs</div>
            <div className="mt-1 text-2xl font-semibold text-slate-950">
              {formatCompactNumber(bcData.failedSyncJobCount)}
            </div>
          </div>
        </div>
        <div className="mt-3 divide-y divide-[var(--line)] border border-[var(--line)]">
          {bcData.recentImportRuns.slice(0, 5).map((run) => (
            <div key={run.id} className="flex items-center justify-between gap-3 px-3 py-2">
              <div className="min-w-0">
                <div className="truncate text-[0.78rem] font-semibold text-slate-900">
                  {run.entityType}
                </div>
                <div className="mt-0.5 text-[0.68rem] text-slate-500">
                  {formatCompactNumber(run.recordsSeen)} seen /{" "}
                  {formatCompactNumber(run.recordsFailed)} failed / {dateLabel(run.startedAt)}
                </div>
              </div>
              <StatusPill label={titleize(run.status)} />
            </div>
          ))}
        </div>
      </WidgetFrame>
    ),
    "top-customers": (
      <WidgetFrame title="Top Customers" href="/customers">
        <div className="divide-y divide-[var(--line)] border border-[var(--line)]">
          {topCustomers.map((customer) => (
            <div key={customer.id} className="px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <Link
                  href={`/customers/${customer.id}`}
                  className="min-w-0 truncate text-[0.78rem] font-semibold text-slate-900"
                >
                  {customer.name}
                </Link>
                <StatusPill label={titleize(customer.customerType)} />
              </div>
              <p className="mt-1 text-[0.68rem] text-slate-500">
                {customer.locationCount} sites / {customer.branchCoverageCount} branches /{" "}
                {customer.customerNumber}
              </p>
            </div>
          ))}
        </div>
      </WidgetFrame>
    ),
    "recent-invoices": (
      <WidgetFrame title="Recent Invoices" href="/ar/invoices" wide>
        <div className="divide-y divide-[var(--line)] border border-[var(--line)]">
          {financial.invoices.slice(0, 8).map((invoice) => (
            <div key={invoice.id} className="flex items-center justify-between gap-3 px-3 py-2">
              <div className="min-w-0">
                <div className="truncate text-[0.78rem] font-semibold text-slate-900">
                  {invoice.invoiceNumber} / {invoice.customerName}
                </div>
                <div className="mt-0.5 text-[0.68rem] text-slate-500">
                  {invoice.contractNumber} / due {dateLabel(invoice.dueDate)}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="mono text-[0.72rem] font-semibold text-slate-950">
                  {formatCurrency(invoice.balanceAmount)}
                </span>
                <StatusPill label={titleize(invoice.status)} />
              </div>
            </div>
          ))}
        </div>
      </WidgetFrame>
    ),
  };

  return (
    <div className="dashboard-shell">
      <div className="dashboard-toolbar">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-base font-semibold text-slate-950">Metro Operating Dashboard</h1>
            <span className="workspace-chip">{activeStoreLabel}</span>
            <span className="workspace-chip">{activePreset.label}</span>
          </div>
          <p className="mt-1 max-w-4xl text-[0.75rem] leading-5 text-slate-500">
            Business Central seeded data, app-native operations, and accounting readiness in one
            configurable workspace.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link href="/reports" className="btn-secondary">
            <Icon name="bar-chart" size={14} />
            Reports
          </Link>
          <DashboardCustomizer preferences={preferences} widgets={widgetOptions} />
        </div>
      </div>

      <div className="dashboard-kpi-grid">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="dashboard-kpi">
            <p className="workspace-metric-label">{kpi.label}</p>
            <p className="mt-1 truncate text-lg font-semibold text-slate-950">{kpi.value}</p>
            <p className="mt-0.5 truncate text-[0.65rem] text-slate-500">{kpi.note}</p>
          </div>
        ))}
      </div>

      <div className="dashboard-grid">
        {activeWidgetOrder.length === 0 ? (
          <WidgetFrame title="No Widgets Enabled" wide>
            <EmptyState label="Open Customize and enable at least one dashboard widget." />
          </WidgetFrame>
        ) : (
          activeWidgetOrder.map((id) => (
            <Fragment key={id}>{widgetRenderers[id]}</Fragment>
          ))
        )}
      </div>

      {bcData.apBills.length > 0 ? (
        <div className="panel overflow-hidden">
          <div className="dashboard-widget-header">
            <h2 className="dashboard-widget-title">Procurement And AP Preview</h2>
            <Link href="/ap/bills" className="text-[0.68rem] font-semibold text-[var(--brand)]">
              Purchase Orders
            </Link>
          </div>
          <div className="grid gap-px bg-[var(--line)] lg:grid-cols-3">
            {bcData.apBills.slice(0, 6).map((bill) => (
              <div key={bill.id} className="bg-white p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="mono text-[0.72rem] font-semibold text-slate-900">
                    {bill.billNumber}
                  </span>
                  <StatusPill label={titleize(bill.status)} />
                </div>
                <div className="mt-1 truncate text-[0.78rem] text-slate-700">
                  {bill.vendorName}
                </div>
                <div className="mt-2 flex items-center justify-between gap-3 text-[0.7rem] text-slate-500">
                  <span>Due {dateLabel(bill.dueDate)}</span>
                  <span className="mono font-semibold text-slate-900">
                    {formatCurrency(numberFromDb(bill.balanceAmount))}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

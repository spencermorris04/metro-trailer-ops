import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import { WorkspaceLink } from "@/components/workspace-link";
import { formatCompactNumber, formatCurrency } from "@/lib/format";
import { getAssetsOverviewView } from "@/lib/server/platform";

export const unstable_instant = { prefetch: "static" };

function formatPercent(value: number | null) {
  if (value === null) {
    return "Unknown";
  }
  return `${Math.round(value * 100)}%`;
}

export default async function AssetsOverviewPage() {
  const overview = await getAssetsOverviewView();
  const { metrics } = overview;

  return (
    <div className="space-y-2">
      <PageHeader
        eyebrow="Assets"
        title="Rental management"
        description="Fleet, leases, imported BC/RMI invoice history, and accounting readiness in one operating view."
        actions={
          <>
            <WorkspaceLink href="/assets/fleet" className="btn-secondary">
              Fleet
            </WorkspaceLink>
            <WorkspaceLink href="/leases" className="btn-secondary">
              Leases
            </WorkspaceLink>
            <WorkspaceLink href="/ar/invoices" className="btn-secondary">
              Invoices
            </WorkspaceLink>
          </>
        }
      />

      <div className="grid grid-cols-4 gap-px border border-[var(--line)] bg-[var(--line)]">
        {[
          ["Fleet", formatCompactNumber(metrics.totalAssets), "assets"],
          ["Customers", formatCompactNumber(metrics.totalCustomers), "accounts"],
          ["BC invoices", formatCompactNumber(metrics.bcInvoiceHeaders), "posted"],
          ["BC lines", formatCompactNumber(metrics.bcLines), "imported"],
          ["BC leases", formatCompactNumber(metrics.bcDistinctOrderKeys), "order keys"],
          ["App leases", formatCompactNumber(metrics.appLeases), "native"],
          ["App open AR", formatCurrency(metrics.appOpenInvoiceBalance), `${metrics.appOpenInvoiceCount} invoices`],
          ["Line import", formatPercent(overview.lineImport.percent), `${formatCompactNumber(overview.lineImport.recordsSeen)} seen`],
        ].map(([label, value, sub]) => (
          <div key={label} className="bg-white px-3 py-2">
            <p className="workspace-metric-label">{label}</p>
            <p className="text-base font-semibold text-slate-900">{value}</p>
            <p className="text-[0.65rem] text-slate-400">{sub}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-2 xl:grid-cols-3">
        <SectionCard
          eyebrow="Fleet"
          title="Trailers and equipment"
          description="Asset master with BC identity, lifecycle flags, and service context."
        >
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-px border border-[var(--line)] bg-[var(--line)]">
              {[
                ["On rent", metrics.onRentAssets],
                ["In service", metrics.inServiceAssets],
                ["Maintenance", metrics.maintenanceAssets],
                ["Disposed", metrics.disposedAssets],
              ].map(([label, value]) => (
                <div key={label} className="bg-white px-3 py-2">
                  <p className="workspace-metric-label">{label}</p>
                  <p className="text-base font-semibold text-slate-900">
                    {formatCompactNumber(Number(value))}
                  </p>
                </div>
              ))}
            </div>
            <WorkspaceLink href="/assets/fleet" className="btn-primary">
              Open fleet register
            </WorkspaceLink>
          </div>
        </SectionCard>

        <SectionCard
          eyebrow="Leases"
          title="Rental orders and agreements"
          description="BC order keys grouped as leases, plus app-native leases."
        >
          <div className="space-y-3 text-[0.75rem] text-slate-600">
            <div className="flex items-center justify-between">
              <span>Imported BC order groups</span>
              <span className="font-semibold text-slate-900">
                {formatCompactNumber(metrics.bcDistinctOrderKeys)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>App-native leases</span>
              <span className="font-semibold text-slate-900">
                {formatCompactNumber(metrics.appLeases)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Asset line match rate</span>
              <span className="font-semibold text-slate-900">
                {metrics.bcFixedAssetLines > 0
                  ? formatPercent(metrics.bcLinesMatchedToAssets / metrics.bcFixedAssetLines)
                  : "Unknown"}
              </span>
            </div>
            <WorkspaceLink href="/leases" className="btn-primary">
              Open lease register
            </WorkspaceLink>
          </div>
        </SectionCard>

        <SectionCard
          eyebrow="Invoices"
          title="Posted BC/RMI invoice history"
          description="Raw invoice headers are primary history while canonical synthesis catches up."
        >
          <div className="space-y-3 text-[0.75rem] text-slate-600">
            <div className="flex items-center justify-between">
              <span>Posted invoices</span>
              <span className="font-semibold text-slate-900">
                {formatCompactNumber(metrics.bcInvoiceHeaders)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Credit memos</span>
              <span className="font-semibold text-slate-900">
                {formatCompactNumber(metrics.bcCreditMemos)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Customer match</span>
              <span className="font-semibold text-slate-900">
                {formatPercent(
                  metrics.bcInvoiceHeaders > 0
                    ? metrics.bcInvoiceHeadersMatchedToCustomers / metrics.bcInvoiceHeaders
                    : null,
                )}
              </span>
            </div>
            <WorkspaceLink href="/ar/invoices?source=business_central" className="btn-primary">
              Open invoice register
            </WorkspaceLink>
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-2 xl:grid-cols-2">
        <SectionCard
          eyebrow="Import"
          title="Business Central readiness"
          description="Accounting history is incomplete until AR, GL, and dimensions are imported."
        >
          <div className="grid gap-2 text-[0.75rem] text-slate-600">
            <div className="flex items-center justify-between">
              <span>Posted rental line import</span>
              <StatusPill label={overview.lineImport.done ? "Complete" : "Running"} />
            </div>
            <div className="flex items-center justify-between">
              <span>BC customer ledger</span>
              <span className="font-semibold text-slate-900">
                {formatCompactNumber(metrics.bcCustomerLedgerEntries)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>BC G/L entries</span>
              <span className="font-semibold text-slate-900">
                {formatCompactNumber(metrics.bcGlEntries)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Dimension set entries</span>
              <span className="font-semibold text-slate-900">
                {formatCompactNumber(metrics.bcDimensionSetEntries)}
              </span>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          eyebrow="Accounting"
          title="Historical AR posture"
          description="BC open balances wait for customer ledger import."
        >
          <div className="space-y-3 text-[0.75rem] text-slate-600">
            <div className="flex items-center justify-between">
              <span>BC open invoice balances</span>
              <StatusPill label="Pending ledger import" />
            </div>
            <div className="flex items-center justify-between">
              <span>App-native open AR</span>
              <span className="font-semibold text-slate-900">
                {formatCurrency(metrics.appOpenInvoiceBalance)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Unresolved BC import errors</span>
              <span className="font-semibold text-slate-900">
                {formatCompactNumber(metrics.bcImportErrors)}
              </span>
            </div>
            <WorkspaceLink href="/financial" className="btn-secondary">
              Open finance
            </WorkspaceLink>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

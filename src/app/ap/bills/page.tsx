import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import { formatCompactNumber, formatCurrency, formatDate, titleize } from "@/lib/format";
import { getVendorApHistoryView } from "@/lib/server/platform";

export default async function ApBillsPage() {
  const view = await getVendorApHistoryView();

  return (
    <div className="space-y-2">
      <PageHeader
        eyebrow="Accounting"
        title="AP / Vendors"
        description="Business Central vendor master and vendor ledger history. Purchase-order documents are not imported yet."
      />

      <div className="grid grid-cols-4 gap-px border border-[var(--line)] bg-[var(--line)]">
        {[
          ["Vendors", formatCompactNumber(view.summary.vendorCount)],
          ["Vendor ledger rows", formatCompactNumber(view.summary.vendorLedgerCount)],
          ["Ledger amount", formatCurrency(view.summary.vendorLedgerAmount)],
          ["App AP bills", formatCompactNumber(view.summary.appBillCount)],
        ].map(([label, value]) => (
          <div key={label} className="bg-white px-3 py-2">
            <p className="workspace-metric-label">{label}</p>
            <p className="text-base font-semibold text-slate-900">{value}</p>
          </div>
        ))}
      </div>

      <SectionCard
        eyebrow="Purchase Orders"
        title="PO data is not imported"
        description="Vendor ledger entries are accounting history, not purchase orders. This page will show POs only after purchase document headers and lines are imported."
      >
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[0.75rem] text-amber-900">
          Current data supports vendor lookup and AP history review. It does not support PO no.,
          receiving status, expected receipt date, or purchase line quantities yet.
        </div>
      </SectionCard>

      <div className="grid gap-2 xl:grid-cols-2">
        <SectionCard eyebrow="Vendor Master" title="BC vendors">
          <div className="data-table">
            <table>
              <thead>
                <tr>
                  <th>Vendor</th>
                  <th>Status</th>
                  <th>Location</th>
                  <th>Ledger rows</th>
                  <th>Balance/activity</th>
                </tr>
              </thead>
              <tbody>
                {view.vendors.map((vendor) => (
                  <tr key={vendor.id}>
                    <td>
                      <span className="font-semibold text-slate-900">{vendor.name}</span>
                      <br />
                      <span className="mono text-[0.65rem] text-slate-400">
                        {vendor.vendorNo}
                      </span>
                    </td>
                    <td>
                      <StatusPill label={titleize(vendor.status ?? "active")} />
                    </td>
                    <td>{vendor.locationCode ?? "-"}</td>
                    <td>{formatCompactNumber(vendor.ledgerCount)}</td>
                    <td>
                      {formatCurrency(vendor.balance)}
                      <br />
                      <span className="text-[0.65rem] text-slate-400">
                        {vendor.latestPostingDate
                          ? formatDate(vendor.latestPostingDate)
                          : "No ledger activity"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard eyebrow="AP History" title="Recent vendor ledger entries">
          <div className="data-table">
            <table>
              <thead>
                <tr>
                  <th>Entry</th>
                  <th>Vendor</th>
                  <th>Date</th>
                  <th>Document</th>
                  <th>Type</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {view.ledgerEntries.map((entry) => (
                  <tr key={entry.id}>
                    <td>{entry.entryNo}</td>
                    <td>
                      {entry.vendorName ?? "Unknown vendor"}
                      <br />
                      <span className="mono text-[0.65rem] text-slate-400">
                        {entry.vendorNo ?? "-"}
                      </span>
                    </td>
                    <td>{entry.postingDate ? formatDate(entry.postingDate) : "Unknown"}</td>
                    <td>{entry.documentNo ?? "-"}</td>
                    <td>{entry.documentType ?? "-"}</td>
                    <td className="font-semibold text-slate-900">
                      {formatCurrency(entry.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

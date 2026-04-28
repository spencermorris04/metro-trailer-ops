import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { formatCurrency, formatDate, titleize } from "@/lib/format";
import { getContractListView } from "@/lib/server/platform";

export const dynamic = "force-dynamic";

type ContractsPageProps = {
  searchParams: Promise<{
    q?: string | string[];
    status?: string | string[];
    branch?: string | string[];
    sourceProvider?: string | string[];
    sourceDocumentType?: string | string[];
  }>;
};

function getParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ContractsPage({ searchParams }: ContractsPageProps) {
  const resolved = await searchParams;
  const filters = {
    q: getParam(resolved.q),
    status: getParam(resolved.status),
    branch: getParam(resolved.branch),
    sourceProvider: getParam(resolved.sourceProvider),
    sourceDocumentType: getParam(resolved.sourceDocumentType),
  };

  const contracts = await getContractListView(filters);

  return (
    <div className="space-y-2">
      <PageHeader
        eyebrow="Commercial"
        title="Contracts"
        description="Operational rental agreements with source-aware BC document lineage, invoice exposure, and asset allocation context."
        actions={
          <>
            <Link href="/commercial-events" className="btn-secondary">
              Commercial events
            </Link>
            <Link href="/source-documents" className="btn-secondary">
              Source documents
            </Link>
          </>
        }
      />

      <div className="panel px-3 py-2">
        <form className="flex flex-wrap items-end gap-2" action="/contracts">
          <input
            type="text"
            name="q"
            defaultValue={filters.q ?? ""}
            placeholder="Contract, customer, site..."
            className="workspace-input w-48"
          />
          <input
            type="text"
            name="branch"
            defaultValue={filters.branch ?? ""}
            placeholder="Branch"
            className="workspace-input w-28"
          />
          <input
            type="text"
            name="status"
            defaultValue={filters.status ?? ""}
            placeholder="Status"
            className="workspace-input w-28"
          />
          <select
            name="sourceProvider"
            defaultValue={filters.sourceProvider ?? ""}
            className="workspace-input w-36"
          >
            <option value="">Any source</option>
            <option value="business_central">Business Central</option>
            <option value="internal">Internal</option>
          </select>
          <input
            type="text"
            name="sourceDocumentType"
            defaultValue={filters.sourceDocumentType ?? ""}
            placeholder="Source doc type"
            className="workspace-input w-36"
          />
          <button type="submit" className="btn-primary">
            Apply
          </button>
          <Link href="/contracts" className="btn-secondary">
            Reset
          </Link>
        </form>
      </div>

      <div className="grid grid-cols-4 gap-px border border-[var(--line)] bg-[var(--line)]">
        {[
          { label: "Contracts", value: contracts.length },
          {
            label: "BC seeded",
            value: contracts.filter(
              (contract) =>
                (contract.sourceProvider ?? "internal") === "business_central",
            ).length,
          },
          {
            label: "Open balance",
            value: formatCurrency(
              contracts.reduce(
                (sum, contract) => sum + (contract.outstandingBalance ?? 0),
                0,
              ),
            ),
          },
          {
            label: "Invoices",
            value: contracts.reduce(
              (sum, contract) => sum + (contract.invoiceCount ?? 0),
              0,
            ),
          },
        ].map((metric) => (
          <div key={metric.label} className="bg-white px-3 py-2">
            <p className="workspace-metric-label">{metric.label}</p>
            <p className="text-base font-semibold text-slate-900">
              {typeof metric.value === "number" ? metric.value : metric.value}
            </p>
          </div>
        ))}
      </div>

      <div className="panel overflow-hidden">
        <div className="data-table border-0">
          <table>
            <thead>
              <tr>
                <th>Contract</th>
                <th>Customer / site</th>
                <th>Dates</th>
                <th>Commercial posture</th>
                <th>Source</th>
                <th>Assets</th>
              </tr>
            </thead>
            <tbody>
              {contracts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-slate-400">
                    No contracts match the current scope.
                  </td>
                </tr>
              ) : (
                contracts.map((contract) => (
                  <tr key={contract.id}>
                    <td>
                      <Link
                        href={`/contracts/${contract.id}`}
                        className="font-semibold text-[var(--brand)]"
                      >
                        {contract.contractNumber}
                      </Link>
                      <br />
                      <span className="text-[0.65rem] text-slate-400">
                        {titleize(contract.status)}
                      </span>
                    </td>
                    <td>
                      <span className="text-slate-700">{contract.customerName}</span>
                      <br />
                      <span className="text-[0.65rem] text-slate-400">
                        {contract.locationName}
                      </span>
                      <br />
                      <span className="text-[0.65rem] text-slate-400">
                        {contract.branch}
                      </span>
                    </td>
                    <td>
                      <span className="text-slate-700">{formatDate(contract.startDate)}</span>
                      <br />
                      <span className="text-[0.65rem] text-slate-400">
                        {contract.endDate ? formatDate(contract.endDate) : "Open"}
                      </span>
                    </td>
                    <td>
                      <StatusPill label={titleize(contract.commercialStage ?? contract.status)} />
                      <div className="mt-1 text-[0.65rem] text-slate-400">
                        {contract.invoiceCount ?? 0} invoices /{" "}
                        {contract.uninvoicedEventCount ?? 0} uninvoiced events
                      </div>
                      <div className="text-[0.65rem] text-slate-400">
                        Bal. {formatCurrency(contract.outstandingBalance ?? 0)}
                      </div>
                    </td>
                    <td>
                      <StatusPill
                        label={titleize(
                          (contract.sourceProvider ?? "internal").replaceAll("_", " "),
                        )}
                      />
                      <div className="mt-1 text-[0.65rem] text-slate-400">
                        {contract.sourceDocumentType ?? "No source type"}
                      </div>
                      <div className="text-[0.65rem] text-slate-400">
                        {contract.sourceDocumentNo ?? "No source doc no."}
                      </div>
                    </td>
                    <td className="text-slate-600">
                      {contract.assets.join(", ") || "No assets"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

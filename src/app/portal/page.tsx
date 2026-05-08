import { headers } from "next/headers";
import Link from "next/link";

import { JsonActionButton } from "@/components/json-action-button";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import { formatCurrency, formatDate } from "@/lib/format";
import type { PaymentTransactionRecord } from "@/lib/platform-types";
import { getCurrentPortalOverview } from "@/lib/server/portal-service";


export default async function PortalPage() {
  const portalContext = await getCurrentPortalOverview(
    new Headers(await headers()),
  ).catch(() => null);

  if (!portalContext) {
    return (
      <div className="space-y-2">
        <PageHeader
          eyebrow="Portal"
          title="Customer account access required"
          description="Sign in with a customer portal account to view contracts, invoices, payments, and documents."
        />
      </div>
    );
  }

  const portal = portalContext;
  const paymentHistory: PaymentTransactionRecord[] =
    "paymentHistory" in portal && Array.isArray(portal.paymentHistory)
      ? portal.paymentHistory
      : [];

  return (
    <div className="space-y-2">
      <PageHeader
        eyebrow="Portal"
        title="Customer portal"
        description="Invoices, contracts, payments, inspections, and signature records."
        actions={
          <Link href={portal.portalSession.url} className="btn-secondary">Open billing portal</Link>
        }
      />

      {/* KPI strip */}
      <div className="grid grid-cols-4 gap-px border border-[var(--line)] bg-[var(--line)]">
        {[
          { label: "Customer", value: portal.customer.customerNumber },
          { label: "Contracts", value: portal.contracts.length },
          { label: "Invoices", value: portal.invoices.length },
          { label: "Payment methods", value: portal.paymentMethods.length },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-white px-3 py-2">
            <p className="workspace-metric-label">{kpi.label}</p>
            <p className="text-lg font-semibold text-slate-900">{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Contracts table */}
      <SectionCard eyebrow="Contracts" title="Rental status by site">
        <div className="data-table">
          <table>
            <thead>
              <tr>
                <th>Contract</th>
                <th>Location</th>
                <th>Branch</th>
                <th>Assets</th>
                <th>Start</th>
                <th>End</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {portal.contracts.map((contract) => (
                <tr key={contract.id}>
                  <td className="mono font-semibold text-slate-900">{contract.contractNumber}</td>
                  <td className="text-slate-700">{contract.locationName}</td>
                  <td className="text-slate-600">{contract.branch}</td>
                  <td className="text-slate-600">{contract.assets.join(", ") || "-"}</td>
                  <td className="text-slate-600">{formatDate(contract.startDate)}</td>
                  <td className="text-slate-500">{contract.endDate ? formatDate(contract.endDate) : "Open"}</td>
                  <td><StatusPill label={contract.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Invoices table */}
      <SectionCard eyebrow="Invoices" title="Self-service payment">
        <div className="data-table">
          <table>
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Contract</th>
                <th>Total</th>
                <th>Balance</th>
                <th>Due</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {portal.invoices.map((invoice) => (
                <tr key={invoice.id}>
                  <td className="mono font-semibold text-slate-900">{invoice.invoiceNumber}</td>
                  <td className="text-slate-600">{invoice.contractNumber}</td>
                  <td className="text-slate-600">{formatCurrency(invoice.totalAmount)}</td>
                  <td className="font-semibold text-slate-900">{formatCurrency(invoice.balanceAmount)}</td>
                  <td className="text-slate-600">{formatDate(invoice.dueDate)}</td>
                  <td><StatusPill label={invoice.status} /></td>
                  <td>
                    <JsonActionButton
                      endpoint="/api/payments/intents"
                      label="Pay"
                      body={{ invoiceId: invoice.id }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Payment methods + history */}
      <div className="grid gap-2 xl:grid-cols-2">
        <SectionCard eyebrow="Methods" title="Saved billing methods">
          <div className="divide-y divide-[var(--line)]">
            {portal.paymentMethods.map((method) => (
              <div key={method.id} className="flex items-center justify-between gap-3 py-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-[0.8rem] font-medium text-slate-800">{method.label}</span>
                  <span className="text-[0.7rem] text-slate-400">{method.methodType} / {method.last4}</span>
                  <StatusPill label={method.isDefault ? "default" : method.methodType} />
                </div>
                {!method.isDefault ? (
                  <JsonActionButton endpoint={`/api/payment-methods/${method.id}/default`} label="Set default" body={{}} variant="light" />
                ) : null}
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard eyebrow="History" title="Payment activity">
          <div className="divide-y divide-[var(--line)]">
            {paymentHistory.map((payment) => (
              <div key={payment.id} className="flex items-center justify-between gap-3 py-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="mono text-[0.65rem] text-slate-400">{payment.invoiceNumber ?? "-"}</span>
                  <span className="text-[0.75rem] text-slate-700">{payment.transactionType}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="mono text-[0.7rem] text-slate-800">{formatCurrency(payment.amount)}</span>
                  <StatusPill label={payment.status} />
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      {/* Inspections + documents */}
      <div className="grid gap-2 xl:grid-cols-2">
        <SectionCard eyebrow="Inspections" title="Damage and condition">
          <div className="divide-y divide-[var(--line)]">
            {portal.inspections.map((inspection) => (
              <div key={inspection.id} className="py-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="mono text-[0.65rem] text-slate-400">{inspection.assetNumber}</span>
                    <span className="text-[0.75rem] font-medium text-slate-800">{inspection.inspectionType}</span>
                  </div>
                  <StatusPill label={inspection.status} />
                </div>
                <p className="text-[0.7rem] text-slate-400">{inspection.damageSummary}</p>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard eyebrow="Documents" title="Records and signatures">
          <div className="divide-y divide-[var(--line)]">
            {portal.documents.map((document) => (
              <div key={document.id} className="flex items-center justify-between gap-2 py-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[0.65rem] text-slate-400">{document.documentType}</span>
                  <span className="text-[0.75rem] font-medium text-slate-800">{document.filename}</span>
                </div>
                <div className="flex items-center gap-2">
                  <StatusPill label={document.status} />
                  <Link href={`/api/documents/${document.id}/download`} className="text-[0.65rem] font-semibold text-[var(--brand)]">Download</Link>
                </div>
              </div>
            ))}
            {portal.signatureRequests.map((signature) => (
              <div key={signature.id} className="py-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="mono text-[0.65rem] text-slate-400">{signature.contractNumber}</span>
                    <span className="text-[0.75rem] font-medium text-slate-800">{signature.title}</span>
                  </div>
                  <StatusPill label={signature.status} />
                </div>
                <div className="flex gap-3 text-[0.65rem] text-slate-400">
                  {signature.signers.map((s) => <span key={s.id}>{s.name}: {s.status}</span>)}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

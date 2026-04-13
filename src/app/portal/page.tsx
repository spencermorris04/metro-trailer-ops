import { headers } from "next/headers";
import Link from "next/link";

import { JsonActionButton } from "@/components/json-action-button";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import { formatCurrency, formatDate } from "@/lib/format";
import type { PaymentTransactionRecord } from "@/lib/platform-types";
import { getCurrentPortalOverview } from "@/lib/server/portal-service";

export const dynamic = "force-dynamic";

export default async function PortalPage() {
  const portalContext = await getCurrentPortalOverview(
    new Headers(await headers()),
  ).catch(() => null);

  if (!portalContext) {
    return (
      <>
        <PageHeader
          eyebrow="Portal"
          title="Customer account access is required"
          description="Sign in with a customer portal account to view contracts, invoices, inspections, payments, and signed documents."
        />
      </>
    );
  }

  const portal = portalContext;
  const paymentHistory: PaymentTransactionRecord[] =
    "paymentHistory" in portal && Array.isArray(portal.paymentHistory)
      ? portal.paymentHistory
      : [];

  return (
    <>
      <PageHeader
        eyebrow="Portal"
        title="Customer portal for invoices, contracts, payments, and damage history"
        description="Customer-scoped access to rental status, invoices, payment activity, inspections, documents, and signature records."
        actions={
          <Link
            href={portal.portalSession.url}
            className="rounded-full border border-[rgba(19,35,45,0.12)] bg-white px-4 py-2 text-sm font-semibold text-slate-800"
          >
            Open billing portal
          </Link>
        }
      />

      <SectionCard
        eyebrow="Portal Account"
        title={portal.customer.name}
        description="The portal account is scoped to its customer record and only exposes contracts, invoices, inspections, documents, and payments tied to that account."
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="soft-panel p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Customer</p>
            <p className="mt-3 text-xl font-semibold text-slate-900">
              {portal.customer.customerNumber}
            </p>
          </div>
          <div className="soft-panel p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Contracts</p>
            <p className="mt-3 text-xl font-semibold text-slate-900">
              {portal.contracts.length}
            </p>
          </div>
          <div className="soft-panel p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Invoices</p>
            <p className="mt-3 text-xl font-semibold text-slate-900">
              {portal.invoices.length}
            </p>
          </div>
          <div className="soft-panel p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Payment methods</p>
            <p className="mt-3 text-xl font-semibold text-slate-900">
              {portal.paymentMethods.length}
            </p>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Contracts"
        title="Rental status by site"
        description="Contract visibility is limited to the locations and contracts assigned to this portal account."
      >
        <div className="grid gap-4 xl:grid-cols-2">
          {portal.contracts.map((contract) => (
            <div key={contract.id} className="soft-panel p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="mono text-xs uppercase tracking-[0.18em] text-slate-500">
                    {contract.contractNumber}
                  </p>
                  <h3 className="mt-2 text-lg font-semibold text-slate-900">
                    {contract.locationName}
                  </h3>
                </div>
                <StatusPill label={contract.status} />
              </div>
              <div className="mt-4 space-y-2 text-sm text-slate-600">
                <p>Branch: {contract.branch}</p>
                <p>Assets: {contract.assets.join(", ") || "None assigned"}</p>
                <p>Start: {formatDate(contract.startDate)}</p>
                <p>End: {contract.endDate ? formatDate(contract.endDate) : "Open ended"}</p>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Open Invoices"
        title="Self-service payment activity"
        description="Review open balances and trigger the portal payment flow for invoices assigned to this customer."
      >
        <div className="grid gap-4 xl:grid-cols-2">
          {portal.invoices.map((invoice) => (
            <div key={invoice.id} className="soft-panel p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="mono text-xs uppercase tracking-[0.18em] text-slate-500">
                    {invoice.invoiceNumber}
                  </p>
                  <h3 className="mt-2 text-lg font-semibold text-slate-900">
                    {invoice.contractNumber}
                  </h3>
                </div>
                <StatusPill label={invoice.status} />
              </div>
              <div className="mt-4 space-y-2 text-sm text-slate-600">
                <p>Total: {formatCurrency(invoice.totalAmount)}</p>
                <p>Balance: {formatCurrency(invoice.balanceAmount)}</p>
                <p>Due: {formatDate(invoice.dueDate)}</p>
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                <JsonActionButton
                  endpoint="/api/payments/intents"
                  label="Create payment intent"
                  body={{ invoiceId: invoice.id }}
                />
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Payment Methods"
        title="Saved billing methods"
        description="Default payment methods are customer-scoped and used by the Stripe-backed payment flow."
      >
        <div className="grid gap-4 xl:grid-cols-2">
          {portal.paymentMethods.map((method) => (
            <div key={method.id} className="soft-panel p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="mono text-xs uppercase tracking-[0.18em] text-slate-500">
                    {method.provider}
                  </p>
                  <h3 className="mt-2 text-lg font-semibold text-slate-900">
                    {method.label}
                  </h3>
                </div>
                <StatusPill label={method.isDefault ? "default" : method.methodType} />
              </div>
              <div className="mt-4 space-y-2 text-sm text-slate-600">
                <p>Type: {method.methodType}</p>
                <p>Last four: {method.last4}</p>
              </div>
              {!method.isDefault ? (
                <div className="mt-5">
                  <JsonActionButton
                    endpoint={`/api/payment-methods/${method.id}/default`}
                    label="Set as default"
                    body={{}}
                    variant="light"
                  />
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Payment History"
        title="Recorded customer payment activity"
        description="Stripe-backed payment attempts, applications, and refunds appear here as they are persisted to the platform ledger."
      >
        <div className="grid gap-4 xl:grid-cols-2">
          {paymentHistory.map((payment) => (
            <div key={payment.id} className="soft-panel p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="mono text-xs uppercase tracking-[0.18em] text-slate-500">
                    {payment.invoiceNumber ?? "Unassigned"}
                  </p>
                  <h3 className="mt-2 text-lg font-semibold text-slate-900">
                    {payment.transactionType}
                  </h3>
                </div>
                <StatusPill label={payment.status} />
              </div>
              <div className="mt-4 space-y-2 text-sm text-slate-600">
                <p>Amount: {formatCurrency(payment.amount)}</p>
                <p>Method: {payment.paymentMethodLabel ?? "Unspecified"}</p>
                <p>Created: {formatDate(payment.createdAt)}</p>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Inspection History"
        title="Damage and condition visibility"
        description="Inspection history stays customer-visible so disputes and damage conversations are grounded in the same evidence seen by operations."
      >
        <div className="grid gap-4 xl:grid-cols-2">
          {portal.inspections.map((inspection) => (
            <div key={inspection.id} className="soft-panel p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="mono text-xs uppercase tracking-[0.18em] text-slate-500">
                    {inspection.assetNumber}
                  </p>
                  <h3 className="mt-2 text-lg font-semibold text-slate-900">
                    {inspection.inspectionType}
                  </h3>
                </div>
                <StatusPill label={inspection.status} />
              </div>
              <p className="mt-4 text-sm leading-7 text-slate-600">
                {inspection.damageSummary}
              </p>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Documents and Signatures"
        title="Downloadable records and signature status"
        description="Customers can retrieve packet copies, signed agreements, and signature certificates from the same portal workspace."
      >
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="space-y-4">
            {portal.documents.map((document) => (
              <div key={document.id} className="soft-panel p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="mono text-xs uppercase tracking-[0.18em] text-slate-500">
                      {document.documentType}
                    </p>
                    <h3 className="mt-2 text-lg font-semibold text-slate-900">
                      {document.filename}
                    </h3>
                  </div>
                  <StatusPill label={document.status} />
                </div>
                <div className="mt-4">
                  <Link
                    href={`/api/documents/${document.id}/download`}
                    className="text-sm font-semibold text-slate-900 underline"
                  >
                    Download document
                  </Link>
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-4">
            {portal.signatureRequests.map((signature) => (
              <div key={signature.id} className="soft-panel p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="mono text-xs uppercase tracking-[0.18em] text-slate-500">
                      {signature.contractNumber}
                    </p>
                    <h3 className="mt-2 text-lg font-semibold text-slate-900">
                      {signature.title}
                    </h3>
                  </div>
                  <StatusPill label={signature.status} />
                </div>
                <div className="mt-4 space-y-2 text-sm text-slate-600">
                  {signature.signers.map((signer) => (
                    <p key={signer.id}>
                      {signer.name}: {signer.status}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </SectionCard>
    </>
  );
}

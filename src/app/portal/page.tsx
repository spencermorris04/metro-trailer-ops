import Link from "next/link";

import { JsonActionButton } from "@/components/json-action-button";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  listDocuments,
  listSignatureRequests,
} from "@/lib/server/esign";
import { getPortalOverview, listCustomers } from "@/lib/server/platform";

export const dynamic = "force-dynamic";

export default async function PortalPage() {
  const customers = await listCustomers();
  const defaultCustomer =
    customers.find((customer) => customer.portalEnabled) ?? customers[0];

  if (!defaultCustomer) {
    return (
      <>
        <PageHeader
          eyebrow="Phase 6"
          title="Customer portal for invoices, contracts, payments, and damage history"
          description="No customer accounts are available in the current demo runtime."
        />
      </>
    );
  }

  const portal = await getPortalOverview(defaultCustomer.customerNumber);
  const contractNumbers = new Set(portal.contracts.map((contract) => contract.contractNumber));
  const portalDocuments = (await listDocuments()).filter((document) =>
    contractNumbers.has(document.contractNumber),
  );
  const portalSignatures = (await listSignatureRequests()).filter((request) =>
    contractNumbers.has(request.contractNumber),
  );

  return (
    <>
      <PageHeader
        eyebrow="Phase 6"
        title="Customer portal for invoices, contracts, payments, and damage history"
        description="Customers can view contract status, open invoices, stored payment methods, inspection history, and the handoff points to Stripe-hosted payment and account management flows."
        actions={
          <Link
            href={portal.portalSession.url}
            className="rounded-full border border-[rgba(19,35,45,0.12)] bg-white px-4 py-2 text-sm font-semibold text-slate-800"
          >
            Open demo billing portal
          </Link>
        }
      />

      <SectionCard
        eyebrow="Portal Account"
        title={portal.customer.name}
        description="This page is currently wired to a demo customer account to exercise the portal flows end to end."
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
        eyebrow="Open Invoices"
        title="Self-service payment activity"
        description="The pay action below creates a Stripe payment intent in demo mode and the record-payment endpoint updates invoice state in the platform."
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
                {invoice.balanceAmount > 0 ? (
                  <JsonActionButton
                    endpoint={`/api/invoices/${invoice.id}/pay`}
                    label="Apply demo payment"
                    body={{ amount: Math.min(invoice.balanceAmount, 500) }}
                    variant="light"
                  />
                ) : null}
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
            {portalDocuments.map((document) => (
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
            {portalSignatures.map((signature) => (
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

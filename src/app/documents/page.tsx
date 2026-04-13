import Link from "next/link";

import { JsonActionButton } from "@/components/json-action-button";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { SignatureRequestComposer } from "@/components/signature-request-composer";
import { StatusPill } from "@/components/status-pill";
import { listContracts } from "@/lib/server/platform";
import {
  listDocuments,
  listSignatureRequests,
} from "@/lib/server/esign";

export const dynamic = "force-dynamic";

export default async function DocumentsPage() {
  const contracts = (await listContracts()).map((contract) => ({
    contractNumber: contract.contractNumber,
    customerName: contract.customerName,
  }));
  const documents = await listDocuments();
  const signatures = await listSignatureRequests();

  return (
    <>
      <PageHeader
        eyebrow="Phase 8"
        title="Internal document retention and bespoke e-signature workflow"
        description="Metro Trailer now owns the signing workflow directly: contract packets, signer routing, consent capture, evidence hashing, certificate generation, and immutable signed records all live inside the platform."
      />

      <SignatureRequestComposer contracts={contracts} />

      <SectionCard
        eyebrow="Documents"
        title="Retained artifacts"
        description="Every packet, signed agreement, certificate, and operational PDF is stored with a hash and object-lock posture so the final record can be reproduced and verified."
      >
        <div className="grid gap-4 xl:grid-cols-2">
          {documents.map((document) => (
            <div key={document.id} className="soft-panel p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="mono text-[0.68rem] uppercase tracking-[0.12em] text-slate-500">
                    {document.documentType}
                  </p>
                  <h3 className="mt-2 text-lg font-semibold text-slate-900">
                    {document.filename}
                  </h3>
                </div>
                <StatusPill label={document.status} />
              </div>
              <div className="mt-4 space-y-2 text-sm text-slate-600">
                <p>Contract: {document.contractNumber}</p>
                <p>Customer: {document.customerName}</p>
                <p>Object lock: {document.objectLocked ? "enabled" : "disabled"}</p>
                <p>Retention mode: {document.retentionMode}</p>
                <p>Storage: {document.storageProvider === "s3" ? "AWS S3" : "Inline demo storage"}</p>
                <p className="mono text-xs">{document.hash.slice(0, 22)}...</p>
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  href={`/api/documents/${document.id}/download`}
                  className="rounded-md border border-slate-900 bg-slate-900 px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-white"
                >
                  Download
                </Link>
                {!["signed", "evidence_locked", "archived"].includes(document.status) ? (
                  <JsonActionButton
                    endpoint={`/api/documents/${document.id}/archive`}
                    label="Archive"
                    body={{}}
                    variant="light"
                  />
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="E-Signature"
        title="Signature requests"
        description="Signer links are generated from internal, HMAC-protected access tokens. Typed signature adoption, consent, routing order, reminders, and final certificate generation are all tracked in the same platform."
      >
        <div className="grid gap-4 xl:grid-cols-2">
          {signatures.map((signature) => (
            <div key={signature.id} className="soft-panel p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="mono text-[0.68rem] uppercase tracking-[0.12em] text-slate-500">
                    {signature.provider}
                  </p>
                  <h3 className="mt-2 text-lg font-semibold text-slate-900">
                    {signature.contractNumber}
                  </h3>
                </div>
                <StatusPill label={signature.status} />
              </div>

              <div className="mt-4 space-y-2 text-sm text-slate-600">
                <p>Customer: {signature.customerName}</p>
                <p>Title: {signature.title}</p>
                <p>Consent: {signature.consentTextVersion}</p>
                <p>
                  Packet:
                  {" "}
                  {signature.packetDocument ? (
                    <Link
                      href={`/api/documents/${signature.packetDocument.id}/download`}
                      className="font-medium text-slate-900 underline"
                    >
                      {signature.packetDocument.filename}
                    </Link>
                  ) : (
                    "Unavailable"
                  )}
                </p>
              </div>

              <div className="mt-5 space-y-3">
                {signature.signers.map((signer) => {
                  const signerLink = signature.signerLinks.find(
                    (link) => link.signerId === signer.id,
                  );

                  return (
                    <div
                      key={signer.id}
                      className="rounded-md border border-[var(--line)] bg-white p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {signer.name}
                          </p>
                          <p className="text-xs text-slate-500">{signer.email}</p>
                        </div>
                        <StatusPill label={signer.status} />
                      </div>
                      <div className="mt-3 space-y-1 text-xs leading-6 text-slate-600">
                        <p>Role: {signer.title ?? "Not provided"}</p>
                        <p>Routing order: {signer.routingOrder}</p>
                        <p>
                          Signed at: {signer.signedAt ? new Date(signer.signedAt).toLocaleString("en-US") : "Pending"}
                        </p>
                      </div>
                      {signerLink?.url ? (
                        <div className="mt-3">
                          <Link
                            href={signerLink.url}
                            className="text-sm font-semibold text-slate-900 underline"
                          >
                            Open signer link
                          </Link>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                {signature.status !== "completed" &&
                signature.status !== "cancelled" &&
                signature.status !== "expired" ? (
                  <>
                    <JsonActionButton
                      endpoint={`/api/signatures/${signature.id}/remind`}
                      label="Send reminder"
                      body={{}}
                      variant="light"
                    />
                    <JsonActionButton
                      endpoint={`/api/signatures/${signature.id}/cancel`}
                      label="Cancel request"
                      body={{ reason: "Cancelled from the documents workspace." }}
                      variant="light"
                    />
                  </>
                ) : null}

                {signature.finalDocument ? (
                  <Link
                    href={`/api/documents/${signature.finalDocument.id}/download`}
                    className="rounded-md border border-slate-900 bg-slate-900 px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-white"
                  >
                    Signed PDF
                  </Link>
                ) : null}

                {signature.certificateDocument ? (
                  <Link
                    href={`/api/documents/${signature.certificateDocument.id}/download`}
                    className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-800"
                  >
                    Certificate
                  </Link>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </>
  );
}

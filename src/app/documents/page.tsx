import { JsonActionButton } from "@/components/json-action-button";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import {
  listDocuments,
  listSignatureRequests,
} from "@/lib/server/platform-service";

export const dynamic = "force-dynamic";

export default function DocumentsPage() {
  const documents = listDocuments();
  const signatures = listSignatureRequests();

  return (
    <>
      <PageHeader
        eyebrow="Phase 8"
        title="Documents, immutable storage posture, and e-signature workflow"
        description="Contract and signature documents are modeled as object-locked artifacts with hashes so the system can support either third-party e-signature or a later in-house trust workflow."
      />

      <SectionCard
        eyebrow="Documents"
        title="Stored contract and inspection artifacts"
        description="Documents are tracked with hashes and object-lock intent to support legal and operational retention requirements."
      >
        <div className="grid gap-4 xl:grid-cols-2">
          {documents.map((document) => (
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
              <div className="mt-4 space-y-2 text-sm text-slate-600">
                <p>Contract: {document.contractNumber}</p>
                <p>Object lock: {document.objectLocked ? "enabled" : "disabled"}</p>
                <p className="mono text-xs">{document.hash.slice(0, 18)}...</p>
              </div>
              {document.status !== "archived" ? (
                <div className="mt-5">
                  <JsonActionButton
                    endpoint={`/api/documents/${document.id}/archive`}
                    label="Archive document"
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
        eyebrow="E-Signature"
        title="Signature requests"
        description="The current workflow assumes Dropbox Sign or another third-party provider first, with enough internal metadata to support a future in-house signature system if needed."
      >
        <div className="grid gap-4 xl:grid-cols-2">
          {signatures.map((signature) => (
            <div key={signature.id} className="soft-panel p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="mono text-xs uppercase tracking-[0.18em] text-slate-500">
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
                <p>Signers: {signature.signers.join(", ")}</p>
              </div>
              {signature.status !== "signed" ? (
                <div className="mt-5">
                  <JsonActionButton
                    endpoint={`/api/signatures/${signature.id}/complete`}
                    label="Mark signed"
                    body={{}}
                  />
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </SectionCard>
    </>
  );
}

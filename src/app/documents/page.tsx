import Link from "next/link";

import { JsonActionButton } from "@/components/json-action-button";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { SignatureRequestComposer } from "@/components/signature-request-composer";
import { StatusPill } from "@/components/status-pill";
import { listContracts } from "@/lib/server/platform";
import { getSourceDocumentsView } from "@/lib/server/platform";
import { formatCurrency, formatDate } from "@/lib/format";
import { listDocuments, listSignatureRequests } from "@/lib/server/esign";

export const dynamic = "force-dynamic";

export default async function DocumentsPage() {
  const [contracts, documents, signatures, sourceDocuments] = await Promise.all([
    listContracts(),
    listDocuments(),
    listSignatureRequests(),
    getSourceDocumentsView(),
  ]);

  const composerContracts = contracts.map((contract) => ({
    contractNumber: contract.contractNumber,
    customerName: contract.customerName,
  }));

  return (
    <div className="space-y-2">
      <PageHeader
        eyebrow="Commercial"
        title="Documents"
        description="Internal retained documents, native e-sign packets, and linked BC source-document lineage."
      />

      <SignatureRequestComposer contracts={composerContracts} />

      <SectionCard eyebrow="Internal" title="Retained documents">
        <div className="data-table">
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>Filename</th>
                <th>Contract</th>
                <th>Customer</th>
                <th>Storage</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((document) => (
                <tr key={document.id}>
                  <td>{document.documentType}</td>
                  <td className="font-semibold text-slate-900">{document.filename}</td>
                  <td>{document.contractNumber}</td>
                  <td>{document.customerName}</td>
                  <td>{document.storageProvider === "s3" ? "S3" : "Inline"}</td>
                  <td><StatusPill label={document.status} /></td>
                  <td>
                    <div className="flex gap-1.5">
                      <Link
                        href={`/api/documents/${document.id}/download`}
                        className="border border-slate-900 bg-slate-900 px-2 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-white"
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
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard eyebrow="E-Sign" title="Signature requests">
        <div className="divide-y divide-[var(--line)]">
          {signatures.map((signature) => (
            <div key={signature.id} className="py-2.5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="mono text-[0.65rem] text-slate-400">{signature.provider}</span>
                  <span className="text-[0.8rem] font-semibold text-slate-900">
                    {signature.contractNumber}
                  </span>
                  <span className="text-[0.75rem] text-slate-500">
                    {signature.customerName} - {signature.title}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <StatusPill label={signature.status} />
                  {signature.finalDocument ? (
                    <Link
                      href={`/api/documents/${signature.finalDocument.id}/download`}
                      className="border border-slate-900 bg-slate-900 px-2 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-white"
                    >
                      Signed PDF
                    </Link>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard eyebrow="Legacy BC" title="Linked source documents">
        <div className="data-table">
          <table>
            <thead>
              <tr>
                <th>Document</th>
                <th>Customer</th>
                <th>Imported</th>
                <th>Linked app records</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {sourceDocuments.slice(0, 20).map((doc) => (
                <tr key={doc.id}>
                  <td>
                    <span className="font-semibold text-slate-900">{doc.documentNo}</span>
                    <br />
                    <span className="text-[0.65rem] text-slate-400">{doc.documentType}</span>
                  </td>
                  <td>{doc.customerName ?? "Unknown"}</td>
                  <td>{formatDate(doc.importedAt)}</td>
                  <td className="text-[0.7rem] text-slate-500">
                    {doc.linkedContracts.length} contracts
                    <br />
                    {doc.linkedInvoices.length} invoices
                  </td>
                  <td>{formatCurrency(doc.totalAmount ?? 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

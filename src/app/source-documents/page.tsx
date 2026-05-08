import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { formatCurrency, formatDate } from "@/lib/format";
import { getSourceDocumentsView } from "@/lib/server/platform";


export default async function SourceDocumentsPage() {
  const docs = await getSourceDocumentsView();

  return (
    <div className="space-y-2">
      <PageHeader
        eyebrow="Admin"
        title="Source documents"
        description="Imported BC/RMI commercial documents retained for search, reconciliation, and lineage."
        actions={
          <Link href="/integrations/business-central" className="btn-secondary">
            BC admin
          </Link>
        }
      />

      <SectionCard eyebrow="Legacy BC" title="Imported commercial documents">
        <div className="data-table">
          <table>
            <thead>
              <tr>
                <th>Document</th>
                <th>Customer</th>
                <th>Dates</th>
                <th>Lines</th>
                <th>Linked records</th>
                <th>Amounts</th>
              </tr>
            </thead>
            <tbody>
              {docs.map((doc) => (
                <tr key={doc.id}>
                  <td>
                    <span className="font-semibold text-slate-900">{doc.documentNo}</span>
                    <br />
                    <span className="text-[0.65rem] text-slate-400">
                      {doc.documentType}
                    </span>
                  </td>
                  <td>{doc.customerName ?? "Unknown"}</td>
                  <td>
                    {doc.documentDate ? formatDate(doc.documentDate) : "Unknown"}
                    <br />
                    <span className="text-[0.65rem] text-slate-400">
                      Imported {formatDate(doc.importedAt)}
                    </span>
                  </td>
                  <td>{doc.lineCount}</td>
                  <td className="text-[0.7rem] text-slate-500">
                    {doc.linkedContracts.length} contracts
                    <br />
                    {doc.linkedInvoices.length} invoices
                  </td>
                  <td>
                    {formatCurrency(doc.totalAmount ?? 0)}
                    <br />
                    <span className="text-[0.65rem] text-slate-400">
                      Due {doc.dueDate ? formatDate(doc.dueDate) : "n/a"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

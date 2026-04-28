import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { formatDate } from "@/lib/format";
import { getBusinessCentralImportErrorsView } from "@/lib/server/platform";

export const dynamic = "force-dynamic";

export default async function BusinessCentralImportErrorsPage() {
  const errors = await getBusinessCentralImportErrorsView();

  return (
    <div className="space-y-2">
      <PageHeader
        eyebrow="Admin"
        title="BC import errors"
        description="Row-level import failures retained for reconciliation and debugging."
      />
      <SectionCard eyebrow="Errors" title="Import failure log">
        <div className="data-table">
          <table>
            <thead>
              <tr>
                <th>Run</th>
                <th>Entity</th>
                <th>External</th>
                <th>Error</th>
                <th>Message</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {errors.map((error) => (
                <tr key={error.id}>
                  <td>{error.runId}</td>
                  <td>{error.entityType}</td>
                  <td>{error.externalId ?? "-"}</td>
                  <td>{error.errorCode}</td>
                  <td>{error.message}</td>
                  <td>{formatDate(error.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

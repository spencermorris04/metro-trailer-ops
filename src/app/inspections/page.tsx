import Link from "next/link";

import { JsonActionButton } from "@/components/json-action-button";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import { listInspections } from "@/lib/server/platform";

export const dynamic = "force-dynamic";

export default async function InspectionsPage() {
  const inspections = await listInspections();

  return (
    <div className="space-y-2">
      <PageHeader
        eyebrow="Inspections"
        title="Record360-driven damage review"
        description="Delivery, return, and spot-check inspection results stored against asset and contract history."
      />

      <SectionCard eyebrow="Queue" title="Inspection records">
        <div className="data-table">
          <table>
            <thead>
              <tr>
                <th>Asset</th>
                <th>Type</th>
                <th>Contract</th>
                <th>Site</th>
                <th>Damage</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {inspections.map((inspection) => (
                <tr key={inspection.id}>
                  <td className="mono font-semibold text-slate-900">
                    <Link href={`/assets/${inspection.assetNumber}`} className="text-[var(--brand)]">
                      {inspection.assetNumber}
                    </Link>
                  </td>
                  <td className="text-slate-700">{inspection.inspectionType}</td>
                  <td className="text-slate-600">
                    {inspection.contractNumber ? (
                      <Link href={`/contracts/${inspection.contractNumber}`} className="text-[var(--brand)]">
                        {inspection.contractNumber}
                      </Link>
                    ) : (
                      "Unassigned"
                    )}
                  </td>
                  <td className="text-slate-600">{inspection.customerSite}</td>
                  <td className="text-slate-500">{inspection.damageSummary}</td>
                  <td><StatusPill label={inspection.status} /></td>
                  <td>
                    {inspection.status === "requested" ? (
                      <div className="flex gap-1.5">
                        <JsonActionButton
                          endpoint={`/api/inspections/${inspection.id}/complete`}
                          label="Passed"
                          body={{ status: "passed", damageSummary: "Inspection passed with no new damage." }}
                        />
                        <JsonActionButton
                          endpoint={`/api/inspections/${inspection.id}/complete`}
                          label="Flag"
                          body={{ status: "needs_review", damageSummary: "Damage identified and forwarded to maintenance review." }}
                          variant="light"
                        />
                      </div>
                    ) : null}
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

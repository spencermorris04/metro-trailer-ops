import { JsonActionButton } from "@/components/json-action-button";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import { listInspections } from "@/lib/server/platform-service";

export const dynamic = "force-dynamic";

export default function InspectionsPage() {
  const inspections = listInspections();

  return (
    <>
      <PageHeader
        eyebrow="Phase 4"
        title="Record360-driven inspections and damage review"
        description="Inspection requests can be triggered from delivery, return, or spot-check flows. Completing an inspection can either release the unit back to inventory or generate a maintenance work order."
      />

      <SectionCard
        eyebrow="Inspection Queue"
        title="Current inspection records"
        description="The results below are stored against the asset and contract history so billing and maintenance both have the same source material."
      >
        <div className="grid gap-4 xl:grid-cols-2">
          {inspections.map((inspection) => (
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
              <div className="mt-4 space-y-2 text-sm text-slate-600">
                <p>Contract: {inspection.contractNumber}</p>
                <p>Site: {inspection.customerSite}</p>
                <p>{inspection.damageSummary}</p>
              </div>
              {inspection.status === "requested" ? (
                <div className="mt-5 flex flex-wrap gap-3">
                  <JsonActionButton
                    endpoint={`/api/inspections/${inspection.id}/complete`}
                    label="Mark passed"
                    body={{
                      status: "passed",
                      damageSummary: "Inspection passed with no new damage.",
                    }}
                  />
                  <JsonActionButton
                    endpoint={`/api/inspections/${inspection.id}/complete`}
                    label="Flag damage"
                    body={{
                      status: "needs_review",
                      damageSummary: "Damage identified and forwarded to maintenance review.",
                    }}
                    variant="light"
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

import Link from "next/link";

import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import {
  amendmentActions,
  contractGuardrails,
  contractTransitionMap,
} from "@/lib/domain/lifecycle";
import { formatCurrency, formatDate, titleize } from "@/lib/format";
import { listContracts, listFinancialEvents } from "@/lib/server/platform";

export const dynamic = "force-dynamic";

export default async function ContractsPage() {
  const sampleContracts = await listContracts();
  const financialEvents = await listFinancialEvents();

  return (
    <>
      <SectionCard
        eyebrow="Phase 1.3"
        title="Contracts own the rental lifecycle"
        description="Quote, reservation, active rent, completion, closure, and cancellation are explicit states with clear operational consequences."
      >
        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.9fr]">
          <div className="space-y-4 text-sm leading-7 text-slate-600">
            <p>
              This foundation encodes the contract workflow directly into the
              domain layer. That makes it easier to enforce dispatch readiness,
              billing eligibility, amendment behavior, and audit logging with a
              single state machine instead of ad hoc flags.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/api/contracts"
                className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
              >
                GET /api/contracts
              </Link>
              <Link
                href="/api/contracts/contract_002/transition"
                className="rounded-full border border-[rgba(19,35,45,0.12)] bg-white px-4 py-2 text-sm font-semibold text-slate-800"
              >
                POST transition preview
              </Link>
            </div>
          </div>

          <div className="soft-panel p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Amendment paths
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {amendmentActions.map((action) => (
                <span
                  key={action}
                  className="mono rounded-full border border-[rgba(19,35,45,0.08)] bg-white/80 px-3 py-1 text-xs text-slate-700"
                >
                  {action}
                </span>
              ))}
            </div>
            <p className="mt-4 text-sm leading-7 text-slate-600">
              Extensions, swaps, partial returns, and rate adjustments are
              modeled as amendments on the same agreement rather than detached
              side records.
            </p>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Sample Agreements"
        title="Representative rental contracts"
        description="These records mirror the operational mix of reservations, active rentals, and closeout work."
      >
        <div className="data-table">
          <table>
            <thead>
              <tr>
                <th>Contract</th>
                <th>Customer</th>
                <th>Branch</th>
                <th>Dates</th>
                <th>Assets</th>
                <th>Status</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              {sampleContracts.map((contract) => (
                <tr key={contract.id}>
                  <td>
                    <p className="font-semibold text-slate-900">
                      {contract.contractNumber}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {contract.locationName}
                    </p>
                  </td>
                  <td className="text-sm text-slate-700">
                    {contract.customerName}
                  </td>
                  <td className="text-sm text-slate-700">{contract.branch}</td>
                  <td className="text-sm text-slate-700">
                    <p>{formatDate(contract.startDate)}</p>
                    <p className="mt-1 text-slate-500">
                      {contract.endDate ? formatDate(contract.endDate) : "Open-ended"}
                    </p>
                  </td>
                  <td className="text-sm text-slate-700">
                    {contract.assets.join(", ")}
                  </td>
                  <td>
                    <StatusPill label={titleize(contract.status)} />
                  </td>
                  <td className="text-sm font-semibold text-slate-900">
                    {formatCurrency(contract.value)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Transition Rules"
        title="Lifecycle guardrails and allowed next states"
        description="The workflow remains understandable because transitions are finite and each state carries operational rules."
      >
        <div className="grid gap-4 xl:grid-cols-2">
          {Object.entries(contractGuardrails).map(([status, rules]) => (
            <div key={status} className="soft-panel p-5">
              <div className="flex flex-wrap items-center gap-3">
                <StatusPill label={titleize(status)} />
                <div className="flex flex-wrap gap-2">
                  {contractTransitionMap[status as keyof typeof contractTransitionMap].map(
                    (nextState) => (
                      <span
                        key={nextState}
                        className="mono rounded-full bg-white/80 px-3 py-1 text-xs text-slate-600"
                      >
                        {nextState}
                      </span>
                    ),
                  )}
                </div>
              </div>
              <ul className="mt-4 space-y-2 text-sm leading-7 text-slate-600">
                {rules.map((rule) => (
                  <li key={rule}>{rule}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Billing Readiness"
        title="Financial events attach directly to contracts"
        description="The same agreement that owns asset assignments also becomes the source of delivery, rent, damage, credit, and pickup events."
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {financialEvents.map((event) => (
            <div key={event.id} className="soft-panel p-5">
              <StatusPill label={titleize(event.eventType)} />
              <p className="mt-4 text-lg font-semibold text-slate-900">
                {event.contractNumber}
              </p>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                {event.description}
              </p>
              <p className="mt-3 text-sm font-semibold text-slate-900">
                {formatCurrency(event.amount)}
              </p>
            </div>
          ))}
        </div>
      </SectionCard>
    </>
  );
}

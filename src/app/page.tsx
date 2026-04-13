import Link from "next/link";

import { MetricCard } from "@/components/metric-card";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import { assetTransitionMap, contractTransitionMap } from "@/lib/domain/lifecycle";
import { titleize } from "@/lib/format";
import { getDashboardSummary } from "@/lib/server/platform";
import {
  domainCards,
  integrationBlueprint,
  portfolioMetrics,
  roadmapPhases,
} from "@/lib/platform-data";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const summary = await getDashboardSummary();

  return (
    <>
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_360px]">
        <div className="panel overflow-hidden">
          <div className="border-b border-[var(--line)] px-5 py-4 sm:px-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="eyebrow">Overview</p>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
                  Fleet and rental operations dashboard
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                  Core operating posture across inventory, active rentals, overdue
                  exposure, field execution, and retained documents.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <StatusPill
                  label={
                    summary.runtimeMode === "production"
                      ? "Production runtime"
                      : "Demo runtime"
                  }
                  tone={summary.runtimeMode === "production" ? "emerald" : "amber"}
                />
                <Link
                  href="/dispatch"
                  className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-700"
                >
                  Dispatch board
                </Link>
                <Link
                  href="/portal"
                  className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-700"
                >
                  Customer portal
                </Link>
              </div>
            </div>
          </div>

          <div className="grid gap-px bg-[var(--line)] lg:grid-cols-4">
            <div className="bg-white px-5 py-4 sm:px-6">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-slate-500">
                Assets
              </p>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
                {summary.assets}
              </p>
            </div>
            <div className="bg-white px-5 py-4 sm:px-6">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-slate-500">
                Contracts
              </p>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
                {summary.contracts}
              </p>
            </div>
            <div className="bg-white px-5 py-4 sm:px-6">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-slate-500">
                Active
              </p>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
                {summary.activeContracts}
              </p>
            </div>
            <div className="bg-white px-5 py-4 sm:px-6">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-slate-500">
                Overdue invoices
              </p>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
                {summary.overdueInvoices}
              </p>
            </div>
          </div>

          <div className="grid gap-px border-t border-[var(--line)] bg-[var(--line)] lg:grid-cols-[1.15fr_0.85fr]">
            <div className="bg-white px-5 py-5 sm:px-6">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-slate-500">
                Work queues
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="soft-panel p-4">
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Maintenance queue
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-slate-950">
                    {summary.openWorkOrders}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-600">
                    Open work orders awaiting assignment, execution, or release.
                  </p>
                </div>
                <div className="soft-panel p-4">
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Inspection queue
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-slate-950">
                    {summary.pendingInspections}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-600">
                    Requested or unresolved inspections that can block
                    availability.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white px-5 py-5 sm:px-6">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-slate-500">
                Boundaries
              </p>
              <ul className="mt-4 space-y-2 text-sm text-slate-700">
                <li className="flex items-center justify-between rounded-md border border-[var(--line)] px-3 py-2">
                  <span>Payments</span>
                  <span className="mono text-xs text-slate-500">Stripe</span>
                </li>
                <li className="flex items-center justify-between rounded-md border border-[var(--line)] px-3 py-2">
                  <span>Accounting</span>
                  <span className="mono text-xs text-slate-500">QuickBooks</span>
                </li>
                <li className="flex items-center justify-between rounded-md border border-[var(--line)] px-3 py-2">
                  <span>Inspections</span>
                  <span className="mono text-xs text-slate-500">Record360</span>
                </li>
                <li className="flex items-center justify-between rounded-md border border-[var(--line)] px-3 py-2">
                  <span>Telematics</span>
                  <span className="mono text-xs text-slate-500">SkyBitz</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="grid gap-4">
          <div className="panel p-5">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-slate-500">
              Immediate actions
            </p>
            <div className="mt-4 grid gap-2">
              <Link
                href="/contracts"
                className="rounded-md border border-[var(--line)] bg-slate-50 px-3 py-3 text-sm font-medium text-slate-800"
              >
                Review reservation and activation flow
              </Link>
              <Link
                href="/financial"
                className="rounded-md border border-[var(--line)] bg-slate-50 px-3 py-3 text-sm font-medium text-slate-800"
              >
                Review invoice and payment queues
              </Link>
              <Link
                href="/documents"
                className="rounded-md border border-[var(--line)] bg-slate-50 px-3 py-3 text-sm font-medium text-slate-800"
              >
                Review retained documents and signatures
              </Link>
            </div>
          </div>

          <div className="panel p-5">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-slate-500">
              Operating posture
            </p>
            <div className="mt-4 space-y-3 text-sm text-slate-700">
              <div className="flex items-start justify-between gap-4 border-b border-[var(--line)] pb-3">
                <span>Runtime mode</span>
                <span className="mono text-xs text-slate-500">
                  {summary.runtimeMode}
                </span>
              </div>
              <div className="flex items-start justify-between gap-4 border-b border-[var(--line)] pb-3">
                <span>Document retention</span>
                <span className="mono text-xs text-slate-500">
                  S3 / object lock ready
                </span>
              </div>
              <div className="flex items-start justify-between gap-4">
                <span>System of record</span>
                <span className="mono text-xs text-slate-500">Metro Trailer</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {portfolioMetrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </section>

      <SectionCard
        eyebrow="Core model"
        title="Operational domains"
        description="Primary entities and records that drive the platform."
      >
        <div className="grid gap-4 lg:grid-cols-3">
          {domainCards.map((card) => (
            <div key={card.name} className="soft-panel p-4">
              <h3 className="text-base font-semibold text-slate-900">{card.name}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {card.summary}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {card.fields.map((field) => (
                  <span
                    key={field}
                    className="mono rounded-md border border-[var(--line)] bg-white px-2 py-1 text-[0.68rem] text-slate-600"
                  >
                    {field}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Lifecycle"
        title="State transition matrix"
        description="Explicit contract and asset transitions keep billing, dispatch, and maintenance aligned."
      >
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="soft-panel p-4">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-slate-500">
              Contract flow
            </p>
            <div className="mt-4 space-y-3">
              {Object.entries(contractTransitionMap).map(([status, nextStates]) => (
                <div
                  key={status}
                  className="grid gap-2 rounded-md border border-[var(--line)] bg-white p-3"
                >
                  <StatusPill label={titleize(status)} />
                  <p className="text-xs text-slate-500">Allowed next states</p>
                  <div className="flex flex-wrap gap-2">
                    {nextStates.length ? (
                      nextStates.map((nextState) => (
                        <span
                          key={nextState}
                          className="mono rounded-md bg-slate-100 px-2 py-1 text-[0.68rem] text-slate-700"
                        >
                          {nextState}
                        </span>
                      ))
                    ) : (
                      <span className="mono rounded-md bg-slate-100 px-2 py-1 text-[0.68rem] text-slate-700">
                        terminal
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="soft-panel p-4">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-slate-500">
              Asset flow
            </p>
            <div className="mt-4 space-y-3">
              {Object.entries(assetTransitionMap).map(([status, nextStates]) => (
                <div
                  key={status}
                  className="grid gap-2 rounded-md border border-[var(--line)] bg-white p-3"
                >
                  <StatusPill label={titleize(status)} />
                  <p className="text-xs text-slate-500">Allowed next states</p>
                  <div className="flex flex-wrap gap-2">
                    {nextStates.length ? (
                      nextStates.map((nextState) => (
                        <span
                          key={nextState}
                          className="mono rounded-md bg-slate-100 px-2 py-1 text-[0.68rem] text-slate-700"
                        >
                          {nextState}
                        </span>
                      ))
                    ) : (
                      <span className="mono rounded-md bg-slate-100 px-2 py-1 text-[0.68rem] text-slate-700">
                        terminal
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Roadmap"
        title="Delivery map"
        description="Major implementation tracks arranged for operational rollout."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          {roadmapPhases.map((phase) => (
            <div key={phase.phase} className="soft-panel p-4">
              <div className="flex items-center justify-between gap-4">
                <p className="eyebrow">Phase {phase.phase}</p>
                <StatusPill
                  label={phase.phase === "0" ? "Foundation ready" : "Queued"}
                  tone={phase.phase === "0" ? "amber" : "slate"}
                />
              </div>
              <h3 className="mt-2 text-lg font-semibold text-slate-900">
                {phase.title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {phase.summary}
              </p>
              <ul className="mt-3 space-y-2 text-sm text-slate-700">
                {phase.deliverables.map((deliverable) => (
                  <li
                    key={deliverable}
                    className="rounded-md border border-[var(--line)] bg-white px-3 py-2"
                  >
                    {deliverable}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Integration seams"
        title="Provider boundaries"
        description="Operational truth stays internal while vendor touchpoints remain narrow and explicit."
      >
        <div className="grid gap-4 xl:grid-cols-2">
          {integrationBlueprint.map((integration) => (
            <div key={integration.provider} className="soft-panel p-4">
              <div className="flex items-center justify-between gap-4">
                <h3 className="text-lg font-semibold text-slate-900">
                  {integration.provider}
                </h3>
                <Link
                  href="/integrations"
                  className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--brand)]"
                >
                  View details
                </Link>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {integration.purpose}
              </p>
              <div className="mt-3 space-y-3 text-sm text-slate-700">
                <p>
                  <span className="font-semibold">Sync mode:</span>{" "}
                  {integration.syncMode}
                </p>
                <p>
                  <span className="font-semibold">System of record:</span>{" "}
                  {integration.systemOfRecord}
                </p>
                <p>
                  <span className="font-semibold">Boundary:</span>{" "}
                  {integration.boundary}
                </p>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </>
  );
}

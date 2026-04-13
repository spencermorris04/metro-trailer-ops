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
      <section className="panel overflow-hidden p-6 sm:p-8">
        <div className="grid gap-8 lg:grid-cols-[1.35fr_0.95fr]">
          <div className="space-y-5">
            <StatusPill label="Platform demo runtime live" tone="sky" />
            <div className="space-y-4">
              <h2 className="max-w-3xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
                A rental-management operating system built around state,
                auditability, and scale.
              </h2>
              <p className="max-w-3xl text-base leading-8 text-slate-600 sm:text-lg">
                The platform now spans the full implementation plan in demo
                runtime form: asset lifecycle, contracts, invoicing, payments,
                dispatch, inspections, maintenance, collections, documents,
                reporting, and provider integration jobs all run through a
                shared service layer and API surface.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/dispatch"
                className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Open dispatch board
              </Link>
              <Link
                href="/portal"
                className="rounded-full border border-[rgba(19,35,45,0.12)] bg-white/80 px-5 py-3 text-sm font-semibold text-slate-800 transition hover:bg-white"
              >
                Open customer portal
              </Link>
            </div>
          </div>

          <div className="soft-panel grid-lines p-6">
            <p className="eyebrow">Operating Posture</p>
            <div className="mt-5 space-y-5">
              <div>
                <p className="text-sm uppercase tracking-[0.18em] text-slate-500">
                  Runtime summary
                </p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                  {summary.assets} assets, {summary.contracts} contracts,{" "}
                  {summary.openWorkOrders} open work orders, and{" "}
                  {summary.pendingInspections} inspections in play.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-[rgba(19,35,45,0.08)] bg-white/80 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                    External specialists
                  </p>
                  <p className="mt-3 text-sm leading-7 text-slate-700">
                    Stripe for payments, QuickBooks for accounting, Record360
                    for inspections, and SkyBitz for telematics.
                  </p>
                </div>
                <div className="rounded-2xl border border-[rgba(19,35,45,0.08)] bg-white/80 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                    Runtime mode
                  </p>
                  <p className="mt-3 text-sm leading-7 text-slate-700">
                    The app currently runs in a fully linked demo store with
                    audit logging, route handlers, and provider adapters so the
                    workflows can be exercised without external credentials.
                  </p>
                </div>
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
        eyebrow="Phase 0"
        title="Core domain model"
        description="The implementation starts with entities and transitions that reflect the actual rental business, not the limitations of an off-the-shelf ERP."
      >
        <div className="grid gap-4 lg:grid-cols-3">
          {domainCards.map((card) => (
            <div key={card.name} className="soft-panel p-5">
              <h3 className="text-lg font-semibold text-slate-900">
                {card.name}
              </h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                {card.summary}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {card.fields.map((field) => (
                  <span
                    key={field}
                    className="mono rounded-full border border-[rgba(19,35,45,0.08)] bg-white/80 px-3 py-1 text-[0.72rem] text-slate-600"
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
        eyebrow="State Logic"
        title="Lifecycle transitions are explicit"
        description="Contract and asset state machines are encoded up front so downstream billing, dispatch, and maintenance logic have a stable backbone."
      >
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="soft-panel p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Contract Flow
            </p>
            <div className="mt-4 space-y-3">
              {Object.entries(contractTransitionMap).map(([status, nextStates]) => (
                <div
                  key={status}
                  className="flex flex-col gap-2 rounded-2xl border border-[rgba(19,35,45,0.08)] bg-white/80 p-4"
                >
                  <StatusPill label={titleize(status)} />
                  <p className="text-sm text-slate-500">Allowed next states</p>
                  <div className="flex flex-wrap gap-2">
                    {nextStates.length ? (
                      nextStates.map((nextState) => (
                        <span
                          key={nextState}
                          className="mono rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700"
                        >
                          {nextState}
                        </span>
                      ))
                    ) : (
                      <span className="mono rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
                        terminal
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="soft-panel p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Asset Flow
            </p>
            <div className="mt-4 space-y-3">
              {Object.entries(assetTransitionMap).map(([status, nextStates]) => (
                <div
                  key={status}
                  className="flex flex-col gap-2 rounded-2xl border border-[rgba(19,35,45,0.08)] bg-white/80 p-4"
                >
                  <StatusPill label={titleize(status)} />
                  <p className="text-sm text-slate-500">Allowed next states</p>
                  <div className="flex flex-wrap gap-2">
                    {nextStates.length ? (
                      nextStates.map((nextState) => (
                        <span
                          key={nextState}
                          className="mono rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700"
                        >
                          {nextState}
                        </span>
                      ))
                    ) : (
                      <span className="mono rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
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
        title="Phased delivery map"
        description="The scaffold is organized so the next phases can layer in without reshaping the app or rethinking the data model."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          {roadmapPhases.map((phase) => (
            <div key={phase.phase} className="soft-panel p-5">
              <div className="flex items-center justify-between gap-4">
                <p className="eyebrow">Phase {phase.phase}</p>
                <StatusPill
                  label={phase.phase === "0" ? "Foundation ready" : "Queued"}
                  tone={phase.phase === "0" ? "amber" : "slate"}
                />
              </div>
              <h3 className="mt-3 text-xl font-semibold text-slate-900">
                {phase.title}
              </h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                {phase.summary}
              </p>
              <ul className="mt-4 space-y-2 text-sm text-slate-700">
                {phase.deliverables.map((deliverable) => (
                  <li key={deliverable} className="rounded-xl bg-white/75 px-3 py-2">
                    {deliverable}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Integration Seams"
        title="Specialized vendors stay specialized"
        description="Each external provider has a narrow, intentional boundary so Metro Trailer remains the operational backbone instead of becoming a passive sync target."
      >
        <div className="grid gap-4 xl:grid-cols-2">
          {integrationBlueprint.map((integration) => (
            <div key={integration.provider} className="soft-panel p-5">
              <div className="flex items-center justify-between gap-4">
                <h3 className="text-xl font-semibold text-slate-900">
                  {integration.provider}
                </h3>
                <Link
                  href="/integrations"
                  className="text-sm font-semibold text-[var(--accent)]"
                >
                  View details
                </Link>
              </div>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                {integration.purpose}
              </p>
              <div className="mt-4 space-y-3 text-sm text-slate-700">
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

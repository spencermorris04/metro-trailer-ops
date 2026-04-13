import type { ReactNode } from "react";
import Link from "next/link";

import { PrimaryNav } from "@/components/primary-nav";
import { StatusPill } from "@/components/status-pill";
import { getRuntimeMode } from "@/lib/server/runtime";

const externalBoundaries = [
  "Stripe",
  "QuickBooks Online",
  "Record360",
  "SkyBitz",
];

export function AppShell({ children }: { children: ReactNode }) {
  const runtimeMode = getRuntimeMode();

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="grid min-h-screen lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="border-b border-[var(--line)] bg-white lg:border-b-0 lg:border-r">
          <div className="lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
            <div className="border-b border-[var(--line)] px-5 py-5">
              <Link href="/" className="block">
                <p className="eyebrow">Metro Trailer</p>
                <h1 className="mt-1 text-lg font-semibold tracking-tight text-slate-950">
                  Operations Console
                </h1>
                <p className="mt-2 text-xs leading-5 text-slate-600">
                  Fleet, rental, billing, inspections, maintenance, and recovery.
                </p>
              </Link>
            </div>

            <div className="flex-1 space-y-6 overflow-y-auto px-4 py-4">
              <div>
                <p className="mb-2 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Modules
                </p>
                <PrimaryNav />
              </div>

              <div className="soft-panel p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Runtime
                  </p>
                  <StatusPill
                    label={runtimeMode === "production" ? "Production" : "Demo"}
                    tone={runtimeMode === "production" ? "emerald" : "amber"}
                  />
                </div>
                <p className="mt-3 text-xs leading-5 text-slate-600">
                  Operational state stays internal. External systems are bounded integrations.
                </p>
              </div>

              <div className="soft-panel p-4">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Integration Boundaries
                </p>
                <ul className="mt-3 space-y-2 text-xs text-slate-700">
                  {externalBoundaries.map((provider) => (
                    <li
                      key={provider}
                      className="flex items-center justify-between rounded-md border border-[var(--line)] bg-white px-3 py-2"
                    >
                      <span>{provider}</span>
                      <span className="mono text-[0.68rem] text-slate-400">EXT</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </aside>

        <main className="min-w-0">
          <header className="sticky top-0 z-20 border-b border-[var(--line)] bg-[rgba(246,248,251,0.96)] backdrop-blur">
            <div className="flex flex-col gap-3 px-5 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="eyebrow">Rental Management Platform</p>
                <p className="mt-1 text-sm text-slate-600">
                  Operational dashboard for branch activity, dispatch, contracts, invoices, and compliance.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill
                  label={runtimeMode === "production" ? "DB runtime" : "Demo runtime"}
                  tone={runtimeMode === "production" ? "emerald" : "amber"}
                />
                <Link
                  href="/dispatch"
                  className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-700"
                >
                  Dispatch
                </Link>
                <Link
                  href="/reports"
                  className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-700"
                >
                  Reports
                </Link>
              </div>
            </div>
          </header>

          <div className="space-y-4 px-4 py-4 sm:px-6 sm:py-5">{children}</div>
        </main>
      </div>
    </div>
  );
}

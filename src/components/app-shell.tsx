import type { ReactNode } from "react";
import Link from "next/link";

import { PrimaryNav } from "@/components/primary-nav";

const externalBoundaries = [
  "Stripe",
  "QuickBooks Online",
  "Record360",
  "SkyBitz",
];

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <div className="mx-auto grid min-h-screen max-w-7xl gap-6 px-4 py-5 sm:px-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:px-8">
        <aside className="panel h-fit p-6 lg:sticky lg:top-5">
          <Link href="/" className="block">
            <p className="eyebrow">Metro Trailer</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
              Rental operations without the legacy sprawl.
            </h1>
            <p className="mt-4 text-sm leading-7 text-slate-600">
              A domain-first platform for fleet visibility, rental lifecycle,
              billing events, inspections, and maintenance across a large
              trailer network.
            </p>
          </Link>

          <div className="mt-8">
            <PrimaryNav />
          </div>

          <div className="soft-panel mt-8 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              External Boundaries
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {externalBoundaries.map((provider) => (
                <span
                  key={provider}
                  className="rounded-full border border-[rgba(19,35,45,0.08)] bg-white/80 px-3 py-1 text-xs font-medium text-slate-700"
                >
                  {provider}
                </span>
              ))}
            </div>
            <p className="mt-4 text-xs leading-6 text-slate-500">
              Metro Trailer owns operational truth. Specialized systems stay
              specialized.
            </p>
          </div>
        </aside>

        <main className="space-y-6 py-1">{children}</main>
      </div>
    </div>
  );
}

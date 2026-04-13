import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import {
  listDispatchTasks,
  listInspections,
  listTelematics,
  listWorkOrders,
} from "@/lib/server/platform";

export const dynamic = "force-dynamic";

const operationalLinks = [
  {
    href: "/dispatch",
    label: "Dispatch board",
    description: "Assignments, delivery confirmation, and pickup execution.",
  },
  {
    href: "/inspections",
    label: "Inspections",
    description: "Record360 requests, review, and damage-triggered work.",
  },
  {
    href: "/maintenance",
    label: "Maintenance",
    description: "Work orders, repair completion, and return-to-rentable state.",
  },
  {
    href: "/reports",
    label: "Operations reporting",
    description: "Utilization, audit history, and recovery visibility.",
  },
] as const;

export default async function OperationsPage() {
  const [dispatchTasks, inspections, workOrders, telematics] = await Promise.all([
    listDispatchTasks(),
    listInspections(),
    listWorkOrders(),
    listTelematics(),
  ]);
  const dispatchCount = dispatchTasks.length;
  const inspectionCount = inspections.length;
  const workOrderCount = workOrders.length;
  const telematicsCount = telematics.length;

  return (
    <>
      <PageHeader
        eyebrow="Phases 3 to 7"
        title="Operational execution across dispatch, inspections, maintenance, and telemetry"
        description="The later phases are now represented as dedicated modules, but this page keeps the cross-functional picture visible for dispatch, shop, and collections teams."
      />

      <SectionCard
        eyebrow="Operational Pulse"
        title="Current workload"
        description="These counts summarize the in-flight work that affects asset availability and revenue continuity."
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="soft-panel p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Dispatch tasks</p>
            <p className="mt-3 text-2xl font-semibold text-slate-900">{dispatchCount}</p>
          </div>
          <div className="soft-panel p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Inspections</p>
            <p className="mt-3 text-2xl font-semibold text-slate-900">{inspectionCount}</p>
          </div>
          <div className="soft-panel p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Work orders</p>
            <p className="mt-3 text-2xl font-semibold text-slate-900">{workOrderCount}</p>
          </div>
          <div className="soft-panel p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Telematics pings</p>
            <p className="mt-3 text-2xl font-semibold text-slate-900">{telematicsCount}</p>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Modules"
        title="Jump to the operational work areas"
        description="Each module owns a distinct part of the day-to-day rental execution flow."
      >
        <div className="grid gap-4 xl:grid-cols-2">
          {operationalLinks.map((item) => (
            <Link key={item.href} href={item.href} className="soft-panel p-5 transition hover:bg-white/85">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-xl font-semibold text-slate-900">{item.label}</h3>
                <StatusPill label="Open" tone="sky" />
              </div>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                {item.description}
              </p>
            </Link>
          ))}
        </div>
      </SectionCard>
    </>
  );
}

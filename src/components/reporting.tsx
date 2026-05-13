import type { ReactNode } from "react";

import { formatDate } from "@/lib/format";
import type { ReportPeriod } from "@/lib/server/platform";
import { WorkspaceLink } from "@/components/workspace-link";

export function PeriodSelector({
  basePath,
  period,
  extraParams = {},
}: {
  basePath: string;
  period: ReportPeriod;
  extraParams?: Record<string, string | undefined>;
}) {
  const options = [
    ["this_month", "This month"],
    ["last_month", "Last month"],
    ["quarter", "Quarter"],
    ["ytd", "YTD"],
    ["trailing_12", "Trailing 12"],
  ] as const;

  return (
    <div className="panel flex flex-wrap items-center justify-between gap-2 px-3 py-2">
      <div>
        <p className="workspace-metric-label">Selected period</p>
        <p className="text-sm font-semibold text-slate-900">
          {period.label}: {formatDate(period.start)} to {formatDate(previousDay(period.end))}
        </p>
      </div>
      <div className="flex flex-wrap gap-1">
        {options.map(([key, label]) => (
          <WorkspaceLink
            key={key}
            href={buildHref(basePath, { ...extraParams, period: key })}
            className={period.key === key ? "btn-primary" : "btn-secondary"}
          >
            {label}
          </WorkspaceLink>
        ))}
      </div>
    </div>
  );
}

export function ReportFilterBar({
  action,
  children,
}: {
  action: string;
  children: ReactNode;
}) {
  return (
    <form className="panel flex flex-wrap items-end gap-2 px-3 py-2" action={action}>
      {children}
      <button type="submit" className="btn-primary">
        Apply
      </button>
      <WorkspaceLink href={action} className="btn-secondary">
        Reset
      </WorkspaceLink>
    </form>
  );
}

export function ReportKpiGrid({
  columns = 4,
  metrics,
}: {
  columns?: 3 | 4;
  metrics: Array<{
    label: string;
    value: ReactNode;
    href?: string;
    helper?: ReactNode;
  }>;
}) {
  return (
    <div
      className={`grid gap-px border border-[var(--line)] bg-[var(--line)] ${
        columns === 3 ? "lg:grid-cols-3" : "lg:grid-cols-4"
      }`}
    >
      {metrics.map((metric) => {
        const content = (
          <>
            <p className="workspace-metric-label">{metric.label}</p>
            <p className="text-base font-semibold text-slate-900">{metric.value}</p>
            {metric.helper ? (
              <p className="mt-0.5 text-[0.65rem] text-slate-400">{metric.helper}</p>
            ) : null}
          </>
        );
        return (
          <div key={metric.label} className="bg-white px-3 py-2">
            {metric.href ? (
              <WorkspaceLink href={metric.href} className="block hover:text-[var(--brand)]">
                {content}
              </WorkspaceLink>
            ) : (
              content
            )}
          </div>
        );
      })}
    </div>
  );
}

export function SourceCoverageBadge({
  source,
  refreshState,
}: {
  source: string;
  refreshState?: {
    status?: string | null;
    finishedAt?: string | null;
    errorMessage?: string | null;
  } | null;
}) {
  const stale = refreshState?.status && refreshState.status !== "succeeded";
  return (
    <div
      className={`rounded-md border px-3 py-2 text-[0.75rem] ${
        stale
          ? "border-amber-200 bg-amber-50 text-amber-900"
          : "border-sky-200 bg-sky-50 text-sky-900"
      }`}
    >
      Source: {source}.{" "}
      {refreshState
        ? `Read model ${refreshState.status ?? "unknown"}${
            refreshState.finishedAt ? ` at ${formatDate(refreshState.finishedAt)}` : ""
          }.`
        : "No read-model refresh run was found."}
      {refreshState?.errorMessage ? ` ${refreshState.errorMessage}` : ""}
    </div>
  );
}

export function PaginationControls({
  basePath,
  page,
  pageSize,
  total,
  params = {},
}: {
  basePath: string;
  page: number;
  pageSize: number;
  total: number;
  params?: Record<string, string | undefined>;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="flex items-center justify-between border-b border-[var(--line)] px-3 py-1.5">
      <span className="text-[0.75rem] text-slate-500">
        {total === 0 ? 0 : (page - 1) * pageSize + 1}-{Math.min(page * pageSize, total)} of {total}
      </span>
      <div className="flex items-center gap-2">
        <WorkspaceLink
          href={buildHref(basePath, { ...params, page: String(Math.max(1, page - 1)) })}
          className="btn-secondary"
        >
          Previous
        </WorkspaceLink>
        <span className="text-[0.65rem] font-semibold uppercase tracking-[0.06em] text-slate-400">
          Page {page}/{totalPages}
        </span>
        <WorkspaceLink
          href={buildHref(basePath, { ...params, page: String(Math.min(totalPages, page + 1)) })}
          className="btn-secondary"
        >
          Next
        </WorkspaceLink>
      </div>
    </div>
  );
}

export function ExportPlaceholder() {
  return (
    <button type="button" className="btn-secondary" disabled title="Export wiring comes after report contracts stabilize.">
      Export
    </button>
  );
}

export function getSingleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function numberParam(value: string | string[] | undefined, fallback = 1) {
  const parsed = Number(getSingleParam(value) ?? "");
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function buildHref(path: string, params: Record<string, string | undefined>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) {
      query.set(key, value);
    }
  }
  const text = query.toString();
  return text ? `${path}?${text}` : path;
}

function previousDay(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

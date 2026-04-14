import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <section className="panel overflow-hidden">
      <div className="grid gap-4 border-b border-[var(--line)] px-5 py-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950 sm:text-2xl">
            {title}
          </h2>
          <p className="mt-2 max-w-3xl text-[0.8125rem] leading-6 text-slate-500">
            {description}
          </p>
        </div>
        {actions ? (
          <div className="flex flex-wrap gap-2 lg:justify-end">{actions}</div>
        ) : null}
      </div>
    </section>
  );
}

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
    <section className="panel overflow-hidden p-6 sm:p-8">
      <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr] lg:items-end">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">
            {title}
          </h2>
          <p className="mt-4 max-w-3xl text-base leading-8 text-slate-600">
            {description}
          </p>
        </div>
        {actions ? <div className="flex flex-wrap gap-3 lg:justify-end">{actions}</div> : null}
      </div>
    </section>
  );
}

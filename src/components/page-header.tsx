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
      <div className="flex items-center justify-between gap-4 px-3 py-2">
        <div className="flex items-center gap-3 min-w-0">
          <span className="eyebrow shrink-0">{eyebrow}</span>
          <h2 className="truncate text-[0.85rem] font-semibold text-slate-900">{title}</h2>
          <p className="hidden truncate text-[0.75rem] text-slate-400 xl:block">{description}</p>
        </div>
        {actions ? (
          <div className="flex shrink-0 gap-2">{actions}</div>
        ) : null}
      </div>
    </section>
  );
}

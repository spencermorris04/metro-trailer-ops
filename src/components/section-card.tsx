import type { ReactNode } from "react";

export function SectionCard({
  eyebrow,
  title,
  description,
  children,
  className = "",
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel overflow-hidden ${className}`}>
      <div className="flex items-baseline justify-between gap-4 border-b border-[var(--line)] px-3 py-2">
        <div className="flex items-baseline gap-3">
          {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
          <h2 className="text-[0.85rem] font-semibold text-slate-900">{title}</h2>
        </div>
        {description ? (
          <p className="hidden text-[0.75rem] text-slate-400 lg:block">{description}</p>
        ) : null}
      </div>
      <div className="p-3">{children}</div>
    </section>
  );
}

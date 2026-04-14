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
      <div className="border-b border-[var(--line)] px-5 py-4">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <div className="mt-1 flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
          <h2 className="text-lg font-semibold tracking-tight text-slate-900 sm:text-xl">
            {title}
          </h2>
          {description ? (
            <p className="max-w-3xl text-[0.8125rem] leading-6 text-slate-500">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

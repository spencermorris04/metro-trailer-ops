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
    <section className={`panel p-6 sm:p-8 ${className}`}>
      {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
      <div className="mb-6 space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
          {title}
        </h2>
        {description ? (
          <p className="max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">
            {description}
          </p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

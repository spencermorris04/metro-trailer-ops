export function ReportLoading({ title = "Loading report" }: { title?: string }) {
  return (
    <div className="space-y-2">
      <section className="panel px-3 py-2">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="eyebrow">Loading</p>
            <h2 className="text-[0.85rem] font-semibold text-slate-900">{title}</h2>
          </div>
          <div className="h-2 w-28 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-slate-300" />
          </div>
        </div>
      </section>
      <div className="grid gap-px border border-[var(--line)] bg-[var(--line)] lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="bg-white px-3 py-3">
            <div className="h-2 w-20 animate-pulse rounded bg-slate-100" />
            <div className="mt-2 h-4 w-28 animate-pulse rounded bg-slate-200" />
          </div>
        ))}
      </div>
      <section className="panel p-3">
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="grid grid-cols-5 gap-3">
              <div className="h-3 animate-pulse rounded bg-slate-100" />
              <div className="h-3 animate-pulse rounded bg-slate-100" />
              <div className="h-3 animate-pulse rounded bg-slate-100" />
              <div className="h-3 animate-pulse rounded bg-slate-100" />
              <div className="h-3 animate-pulse rounded bg-slate-100" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

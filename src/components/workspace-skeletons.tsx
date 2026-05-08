type SkeletonTableProps = {
  columns?: number;
  rows?: number;
};

export function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`workspace-skeleton ${className}`} />;
}

export function KpiSkeletonGrid({ count = 8 }: { count?: number }) {
  return (
    <div className="dashboard-kpi-grid">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="dashboard-kpi">
          <SkeletonBlock className="h-3 w-20" />
          <SkeletonBlock className="mt-3 h-6 w-24" />
          <SkeletonBlock className="mt-2 h-3 w-28" />
        </div>
      ))}
    </div>
  );
}

export function FilterSkeleton({ controls = 6 }: { controls?: number }) {
  return (
    <div className="panel px-3 py-2">
      <div className="flex flex-wrap items-end gap-2">
        {Array.from({ length: controls }).map((_, index) => (
          <SkeletonBlock key={index} className="h-8 w-32" />
        ))}
        <SkeletonBlock className="h-8 w-16" />
        <SkeletonBlock className="h-8 w-16" />
      </div>
    </div>
  );
}

export function DataTableSkeleton({ columns = 6, rows = 8 }: SkeletonTableProps) {
  return (
    <div className="panel overflow-hidden">
      <div className="flex items-center justify-between border-b border-[var(--line)] px-3 py-2">
        <SkeletonBlock className="h-3 w-36" />
        <SkeletonBlock className="h-3 w-20" />
      </div>
      <div className="data-table border-0">
        <table>
          <thead>
            <tr>
              {Array.from({ length: columns }).map((_, index) => (
                <th key={index}>
                  <SkeletonBlock className="h-3 w-20" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, rowIndex) => (
              <tr key={rowIndex}>
                {Array.from({ length: columns }).map((__, columnIndex) => (
                  <td key={columnIndex}>
                    <SkeletonBlock className="h-4 w-full max-w-36" />
                    <SkeletonBlock className="mt-2 h-3 w-20" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="dashboard-shell">
      <div className="dashboard-toolbar">
        <div>
          <SkeletonBlock className="h-3 w-24" />
          <SkeletonBlock className="mt-2 h-5 w-56" />
        </div>
        <SkeletonBlock className="h-8 w-36" />
      </div>
      <KpiSkeletonGrid />
      <div className="dashboard-grid">
        {Array.from({ length: 7 }).map((_, index) => (
          <section
            key={index}
            className={`dashboard-widget ${index < 2 ? "dashboard-widget-wide" : ""}`}
          >
            <div className="dashboard-widget-header">
              <SkeletonBlock className="h-4 w-40" />
              <SkeletonBlock className="h-3 w-10" />
            </div>
            <div className="dashboard-widget-body">
              <SkeletonBlock className="h-20 w-full" />
              <SkeletonBlock className="mt-3 h-4 w-5/6" />
              <SkeletonBlock className="mt-2 h-4 w-2/3" />
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

export function ListPageSkeleton({
  filters = 6,
  metrics = 8,
  columns = 6,
}: {
  filters?: number;
  metrics?: number;
  columns?: number;
}) {
  return (
    <div className="space-y-2">
      <div className="panel px-3 py-3">
        <SkeletonBlock className="h-3 w-24" />
        <SkeletonBlock className="mt-2 h-6 w-56" />
        <SkeletonBlock className="mt-2 h-3 w-96 max-w-full" />
      </div>
      <FilterSkeleton controls={filters} />
      <KpiSkeletonGrid count={metrics} />
      <DataTableSkeleton columns={columns} />
    </div>
  );
}

export function DetailPageSkeleton() {
  return (
    <div className="space-y-2">
      <div className="panel px-3 py-3">
        <SkeletonBlock className="h-3 w-24" />
        <SkeletonBlock className="mt-2 h-7 w-72 max-w-full" />
        <SkeletonBlock className="mt-2 h-3 w-96 max-w-full" />
      </div>
      <div className="grid gap-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="panel p-3">
            <SkeletonBlock className="h-4 w-32" />
            <SkeletonBlock className="mt-3 h-16 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

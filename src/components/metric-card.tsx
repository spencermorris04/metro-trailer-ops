export function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="panel p-2.5">
      <p className="workspace-metric-label">{label}</p>
      <p className="mt-1 text-xl font-semibold tracking-tight text-slate-950">
        {value}
      </p>
      <p className="mt-0.5 text-[0.7rem] leading-4 text-slate-400">{detail}</p>
    </div>
  );
}

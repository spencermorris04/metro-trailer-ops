type StatusTone = "slate" | "amber" | "emerald" | "sky" | "rose";

const toneClasses: Record<StatusTone, string> = {
  slate: "border-slate-300 bg-slate-100 text-slate-700",
  amber: "border-amber-300 bg-amber-50 text-amber-800",
  emerald: "border-emerald-300 bg-emerald-50 text-emerald-800",
  sky: "border-sky-300 bg-sky-50 text-sky-800",
  rose: "border-rose-300 bg-rose-50 text-rose-800",
};

export function statusToneFromValue(value: string): StatusTone {
  const normalized = value.toLowerCase();

  if (
    [
      "available",
      "active",
      "paid",
      "passed",
      "completed",
      "closed",
      "rentable",
      "clear",
      "success",
    ].some((token) => normalized.includes(token))
  ) {
    return "emerald";
  }

  if (
    [
      "reserved",
      "quoted",
      "sent",
      "assigned",
      "pending",
      "posted",
    ].some((token) => normalized.includes(token))
  ) {
    return "sky";
  }

  if (
    [
      "maintenance",
      "inspection",
      "overdue",
      "awaiting",
      "limited",
    ].some((token) => normalized.includes(token))
  ) {
    return "amber";
  }

  if (
    [
      "cancelled",
      "failed",
      "voided",
      "retired",
      "disputed",
      "escalated",
      "damaged",
    ].some((token) => normalized.includes(token))
  ) {
    return "rose";
  }

  return "slate";
}

export function StatusPill({
  label,
  tone,
}: {
  label: string;
  tone?: StatusTone;
}) {
  const resolvedTone = tone ?? statusToneFromValue(label);

  return (
    <span
      className={`inline-flex items-center rounded-md border px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.12em] ${toneClasses[resolvedTone]}`}
    >
      {label}
    </span>
  );
}

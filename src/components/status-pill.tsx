type StatusTone = "slate" | "amber" | "emerald" | "sky" | "rose";

const toneClasses: Record<StatusTone, string> = {
  slate: "border-slate-200 bg-slate-50 text-slate-600",
  amber: "border-amber-200 bg-amber-50 text-amber-700",
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
  sky: "border-sky-200 bg-sky-50 text-sky-700",
  rose: "border-rose-200 bg-rose-50 text-rose-700",
};

export function statusToneFromValue(value: string | null | undefined): StatusTone {
  const normalized = (value ?? "").toLowerCase();

  if (
    [
      "available",
      "active",
      "paid",
      "passed",
      "completed",
      "closed",
      "verified",
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
      "repair",
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
  label: string | null | undefined;
  tone?: StatusTone;
}) {
  const safeLabel = label?.trim() ? label : "unknown";
  const resolvedTone = tone ?? statusToneFromValue(safeLabel);

  return (
    <span
      className={`inline-flex items-center border px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.08em] ${toneClasses[resolvedTone]}`}
    >
      {safeLabel}
    </span>
  );
}

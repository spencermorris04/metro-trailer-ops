"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function JsonActionButton({
  endpoint,
  label,
  body,
  method = "POST",
  variant = "dark",
}: {
  endpoint: string;
  label: string;
  body?: Record<string, unknown>;
  method?: "POST" | "PATCH" | "DELETE";
  variant?: "dark" | "light";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const classes =
    variant === "dark"
      ? "border border-slate-900 bg-slate-900 text-white hover:bg-slate-800"
      : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50";

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        className={`rounded-none px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.06em] transition disabled:cursor-not-allowed disabled:opacity-60 ${classes}`}
        onClick={() =>
          startTransition(async () => {
            setMessage(null);
            const response = await fetch(endpoint, {
              method,
              headers: {
                "Content-Type": "application/json",
              },
              body: body ? JSON.stringify(body) : undefined,
            });
            const data = await response.json().catch(() => null);
            setMessage(
              response.ok
                ? (data?.message ?? "Action completed.")
                : (data?.error ?? "Action failed."),
            );
            router.refresh();
          })
        }
      >
        {pending ? "Working..." : label}
      </button>
      {message ? <span className="text-[0.65rem] text-slate-400">{message}</span> : null}
    </div>
  );
}

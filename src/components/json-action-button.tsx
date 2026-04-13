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
      ? "bg-slate-950 text-white hover:bg-slate-800"
      : "border border-[rgba(19,35,45,0.12)] bg-white text-slate-800 hover:bg-slate-50";

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={pending}
        className={`rounded-full px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${classes}`}
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
      {message ? <p className="text-xs text-slate-500">{message}</p> : null}
    </div>
  );
}

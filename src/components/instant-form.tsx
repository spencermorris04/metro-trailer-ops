"use client";

import type { FormHTMLAttributes, ReactNode } from "react";
import { useTransition } from "react";
import { useRouter } from "next/navigation";

import { useNavigationStore } from "@/lib/client/navigation-store";

type InstantFormProps = Omit<FormHTMLAttributes<HTMLFormElement>, "action"> & {
  action: string;
  children: ReactNode;
};

export function InstantForm({
  action,
  children,
  onSubmit,
  ...props
}: InstantFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const setPendingRoute = useNavigationStore((state) => state.setPendingRoute);

  return (
    <form
      {...props}
      action={action}
      data-pending={isPending ? "true" : undefined}
      onSubmit={(event) => {
        onSubmit?.(event);
        if (event.defaultPrevented) {
          return;
        }

        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const params = new URLSearchParams();
        for (const [key, value] of formData.entries()) {
          if (typeof value !== "string") {
            continue;
          }
          const trimmed = value.trim();
          if (trimmed) {
            params.set(key, trimmed);
          }
        }

        const query = params.toString();
        const href = query ? `${action}?${query}` : action;
        setPendingRoute(href);
        startTransition(() => {
          router.push(href);
        });
      }}
    >
      {children}
    </form>
  );
}

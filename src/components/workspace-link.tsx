"use client";

import type { AnchorHTMLAttributes, ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useNavigationStore } from "@/lib/client/navigation-store";

type WorkspaceLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: string;
  children: ReactNode;
  prefetch?: boolean | null;
};

export function WorkspaceLink({
  href,
  children,
  onClick,
  onFocus,
  onMouseEnter,
  prefetch,
  ...props
}: WorkspaceLinkProps) {
  const router = useRouter();
  const setPendingRoute = useNavigationStore((state) => state.setPendingRoute);

  function warmRoute() {
    router.prefetch(href);
  }

  return (
    <Link
      {...props}
      href={href}
      prefetch={prefetch}
      onMouseEnter={(event) => {
        warmRoute();
        onMouseEnter?.(event);
      }}
      onFocus={(event) => {
        warmRoute();
        onFocus?.(event);
      }}
      onClick={(event) => {
        if (
          event.defaultPrevented ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey ||
          props.target === "_blank"
        ) {
          onClick?.(event);
          return;
        }
        setPendingRoute(href);
        onClick?.(event);
      }}
    >
      {children}
    </Link>
  );
}

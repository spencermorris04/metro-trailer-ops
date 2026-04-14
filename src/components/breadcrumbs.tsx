"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { navigationItems } from "@/lib/navigation";

export function Breadcrumbs() {
  const pathname = usePathname();

  if (pathname === "/") {
    return (
      <nav className="flex items-center gap-1.5 text-sm">
        <span className="font-medium text-slate-900">Overview</span>
      </nav>
    );
  }

  const segments = pathname.split("/").filter(Boolean);
  const currentNav = navigationItems.find(
    (item) => item.href === `/${segments[0]}`,
  );
  const pageLabel = currentNav?.label ?? segments[0]?.replace(/-/g, " ") ?? "";

  return (
    <nav className="flex items-center gap-1.5 text-sm">
      <Link
        href="/"
        className="text-slate-400 transition hover:text-slate-700"
      >
        Home
      </Link>
      <span className="text-slate-300">/</span>
      {segments.length > 1 ? (
        <>
          <Link
            href={`/${segments[0]}`}
            className="text-slate-400 capitalize transition hover:text-slate-700"
          >
            {pageLabel}
          </Link>
          <span className="text-slate-300">/</span>
          <span className="font-medium capitalize text-slate-900">
            {segments.slice(1).join(" / ").replace(/-/g, " ")}
          </span>
        </>
      ) : (
        <span className="font-medium text-slate-900">{pageLabel}</span>
      )}
    </nav>
  );
}

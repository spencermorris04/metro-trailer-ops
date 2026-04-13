"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { navigationItems } from "@/lib/navigation";

export function PrimaryNav() {
  const pathname = usePathname();

  return (
    <nav className="space-y-2">
      {navigationItems.map((item) => {
        const isActive = pathname === item.href;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`block rounded-2xl border px-4 py-3 transition ${
              isActive
                ? "border-[rgba(13,109,122,0.28)] bg-[rgba(13,109,122,0.08)]"
                : "border-transparent bg-white/50 hover:border-[rgba(19,35,45,0.08)] hover:bg-white/80"
            }`}
          >
            <p className="text-sm font-semibold text-slate-900">{item.label}</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              {item.description}
            </p>
          </Link>
        );
      })}
    </nav>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { navigationItems } from "@/lib/navigation";

export function PrimaryNav() {
  const pathname = usePathname();

  return (
    <nav className="space-y-1.5">
      {navigationItems.map((item) => {
        const isActive = pathname === item.href;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`block rounded-lg border px-3 py-2.5 transition ${
              isActive
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-transparent bg-transparent hover:border-slate-200 hover:bg-slate-50"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p
                  className={`text-sm font-semibold ${
                    isActive ? "text-white" : "text-slate-900"
                  }`}
                >
                  {item.label}
                </p>
                <p
                  className={`mt-1 text-[0.72rem] leading-5 ${
                    isActive ? "text-slate-300" : "text-slate-500"
                  }`}
                >
                  {item.description}
                </p>
              </div>
              <span
                className={`mono text-[0.68rem] ${
                  isActive ? "text-slate-300" : "text-slate-400"
                }`}
              >
                {item.href === "/" ? "00" : item.href.slice(1).slice(0, 2).toUpperCase()}
              </span>
            </div>
          </Link>
        );
      })}
    </nav>
  );
}

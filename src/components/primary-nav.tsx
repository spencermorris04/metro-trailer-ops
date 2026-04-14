"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Icon } from "@/components/icons";
import { useSidebar } from "@/components/sidebar";
import { navigationGroups } from "@/lib/navigation";

export function PrimaryNav() {
  const pathname = usePathname();
  const { collapsed } = useSidebar();

  return (
    <nav className="flex flex-col gap-5">
      {navigationGroups.map((group) => (
        <div key={group.label}>
          {!collapsed && (
            <p className="mb-1.5 px-3 text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-slate-400">
              {group.label}
            </p>
          )}
          <div className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  className={`group relative flex items-center gap-3 rounded-lg transition-all duration-150 ${
                    collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2"
                  } ${
                    isActive
                      ? "bg-blue-50 text-blue-700"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  {isActive && (
                    <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-blue-600" />
                  )}
                  <Icon
                    name={item.icon}
                    size={18}
                    className={`shrink-0 ${
                      isActive ? "text-blue-600" : "text-slate-400 group-hover:text-slate-600"
                    }`}
                  />
                  {!collapsed && (
                    <span className="text-[0.8125rem] font-medium leading-tight">
                      {item.label}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

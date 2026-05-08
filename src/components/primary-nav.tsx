"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Icon } from "@/components/icons";
import { navigationGroups } from "@/lib/navigation";

export function PrimaryNav({ collapsed }: { collapsed: boolean }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col">
      {navigationGroups.map((group) => (
        <section key={group.label}>
          {!collapsed ? (
            <p className="px-3 pb-1 pt-3 text-[0.6rem] font-semibold uppercase tracking-[0.1em] text-slate-400">
              {group.label}
            </p>
          ) : (
            <div className="my-1 border-t border-[var(--line)]" />
          )}

          <div className="flex flex-col">
            {group.items.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  className={`group relative flex items-center gap-2.5 px-3 py-1.5 text-[0.8rem] transition ${
                    collapsed ? "justify-center px-2" : ""
                  } ${
                    active
                      ? "bg-[var(--surface-soft)] font-medium text-slate-900"
                      : "text-slate-500 hover:bg-[var(--surface-soft)] hover:text-slate-800"
                  }`}
                >
                  {active ? <span className="workspace-nav-active" /> : null}
                  <Icon
                    name={item.icon}
                    size={16}
                    className={active ? "text-slate-700" : "text-slate-400"}
                  />
                  {!collapsed ? (
                    <span className="truncate">{item.label}</span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </nav>
  );
}

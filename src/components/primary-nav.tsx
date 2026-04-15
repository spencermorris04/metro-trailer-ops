"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Icon } from "@/components/icons";
import { navigationGroups } from "@/lib/navigation";

export function PrimaryNav({ collapsed }: { collapsed: boolean }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-6">
      {navigationGroups.map((group) => (
        <section key={group.label}>
          {!collapsed ? (
            <p className="mb-2 px-3 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-slate-500">
              {group.label}
            </p>
          ) : null}

          <div className="flex flex-col gap-1.5">
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
                  className={`group relative flex items-center gap-3 rounded-xl border px-3 py-2.5 transition ${
                    collapsed ? "justify-center px-2.5" : ""
                  } ${
                    active
                      ? "border-[var(--line-strong)] bg-[var(--surface-soft)] text-slate-950"
                      : "border-transparent text-slate-500 hover:border-[var(--line)] hover:bg-[var(--surface-soft)] hover:text-slate-900"
                  }`}
                >
                  <Icon
                    name={item.icon}
                    size={18}
                    className={active ? "text-slate-950" : "text-slate-400"}
                  />

                  {!collapsed ? (
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{item.label}</p>
                      <p className="truncate text-[0.68rem] text-slate-500">
                        {item.description}
                      </p>
                    </div>
                  ) : null}

                  {active ? <span className="workspace-nav-active" /> : null}
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </nav>
  );
}

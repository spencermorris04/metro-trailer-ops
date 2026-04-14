"use client";

import type { ReactNode } from "react";
import Link from "next/link";

import { Breadcrumbs } from "@/components/breadcrumbs";
import { CommandBar } from "@/components/command-bar";
import { IconBell, IconPanelLeft, IconSettings, IconHelpCircle, IconActivity } from "@/components/icons";
import { PrimaryNav } from "@/components/primary-nav";
import { SidebarProvider, useSidebar } from "@/components/sidebar";
import { StatusPill } from "@/components/status-pill";

const externalBoundaries = [
  { name: "Stripe", status: "connected" },
  { name: "QuickBooks", status: "connected" },
  { name: "Record360", status: "connected" },
  { name: "SkyBitz", status: "connected" },
] as const;

function SidebarContent({ runtimeMode }: { runtimeMode: string }) {
  const { collapsed, toggle } = useSidebar();

  return (
    <aside
      className={`sidebar-aside flex flex-col border-r border-[var(--line)] bg-white transition-[width] duration-200 ${
        collapsed ? "w-16" : "w-60"
      }`}
    >
      {/* Brand area */}
      <div className="flex h-14 shrink-0 items-center border-b border-[var(--line)] px-4">
        {!collapsed ? (
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">
              MT
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">Metro Trailer</p>
              <p className="text-[0.625rem] text-slate-400">Operations Console</p>
            </div>
          </Link>
        ) : (
          <Link href="/" className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">
            MT
          </Link>
        )}
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-2.5 py-3 sidebar-scroll">
        <PrimaryNav />
      </div>

      {/* Bottom section */}
      <div className="shrink-0 border-t border-[var(--line)]">
        {/* Quick status */}
        {!collapsed && (
          <div className="border-b border-[var(--line)] px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-slate-400">
                Integrations
              </span>
              <span className={`h-2 w-2 rounded-full ${runtimeMode === "production" ? "bg-emerald-400" : "bg-amber-400"}`} />
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {externalBoundaries.map((b) => (
                <span
                  key={b.name}
                  className="inline-flex items-center gap-1 rounded bg-slate-50 px-1.5 py-0.5 text-[0.6rem] text-slate-500 border border-slate-100"
                >
                  <span className="h-1 w-1 rounded-full bg-emerald-500" />
                  {b.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Collapse toggle + utils */}
        <div className={`flex items-center gap-1 px-2 py-2 ${collapsed ? "flex-col" : ""}`}>
          <button
            type="button"
            onClick={toggle}
            className="rounded-md p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <IconPanelLeft size={16} className={`transition-transform ${collapsed ? "rotate-180" : ""}`} />
          </button>
          {!collapsed && (
            <>
              <Link
                href="/integrations"
                className="rounded-md p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                title="Settings"
              >
                <IconSettings size={16} />
              </Link>
              <Link
                href="/reports"
                className="rounded-md p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                title="Help"
              >
                <IconHelpCircle size={16} />
              </Link>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}

function TopBar({ runtimeMode }: { runtimeMode: string }) {
  return (
    <header className="flex h-14 shrink-0 items-center border-b border-[var(--line)] bg-white px-5">
      <div className="flex flex-1 items-center gap-6">
        <Breadcrumbs />
      </div>

      <div className="hidden flex-1 justify-center md:flex">
        <CommandBar />
      </div>

      <div className="flex flex-1 items-center justify-end gap-1">
        <StatusPill
          label={runtimeMode === "production" ? "Live" : "Demo"}
          tone={runtimeMode === "production" ? "emerald" : "amber"}
        />
        <button
          type="button"
          className="relative ml-2 rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          title="Activity"
        >
          <IconActivity size={18} />
        </button>
        <button
          type="button"
          className="relative rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          title="Notifications"
        >
          <IconBell size={18} />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-blue-500 ring-2 ring-white" />
        </button>
        <div className="ml-1 flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600 border border-slate-200">
          JD
        </div>
      </div>
    </header>
  );
}

function StatusBar({ runtimeMode }: { runtimeMode: string }) {
  return (
    <footer className="flex h-7 shrink-0 items-center justify-between border-t border-[var(--line)] bg-white px-4 text-[0.625rem] text-slate-400">
      <div className="flex items-center gap-4">
        <span className="flex items-center gap-1.5">
          <span className={`h-1.5 w-1.5 rounded-full ${runtimeMode === "production" ? "bg-emerald-500" : "bg-amber-500"}`} />
          {runtimeMode === "production" ? "Connected" : "Demo mode"}
        </span>
        <span className="text-slate-200">|</span>
        <span>Metro Trailer Operations Console v1.0</span>
      </div>
      <div className="flex items-center gap-4">
        <span>Ctrl+K to search</span>
      </div>
    </footer>
  );
}

function ShellLayout({
  runtimeMode,
  children,
}: {
  runtimeMode: string;
  children: ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-[var(--background)]">
      <SidebarContent runtimeMode={runtimeMode} />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar runtimeMode={runtimeMode} />

        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="mx-auto max-w-[1600px] space-y-4 px-5 py-5 sm:px-6">
            {children}
          </div>
        </main>

        <StatusBar runtimeMode={runtimeMode} />
      </div>
    </div>
  );
}

export function AppShellClient({
  runtimeMode,
  children,
}: {
  runtimeMode: string;
  children: ReactNode;
}) {
  return (
    <SidebarProvider>
      <ShellLayout runtimeMode={runtimeMode}>{children}</ShellLayout>
    </SidebarProvider>
  );
}

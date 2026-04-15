"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Breadcrumbs } from "@/components/breadcrumbs";
import { CommandBar } from "@/components/command-bar";
import { IconActivity, IconBell, IconSettings } from "@/components/icons";
import { PrimaryNav } from "@/components/primary-nav";
import { StatusPill } from "@/components/status-pill";
import { WorkspacePanels } from "@/components/workspace-panels";
import type { WorkspaceActorSummary } from "@/lib/server/workspace-layouts";

type ShellLayout = {
  left: number;
  right: number;
};

function ShellSidebar({
  collapsed,
  runtimeMode,
}: {
  collapsed: boolean;
  runtimeMode: string;
}) {
  return (
    <aside className="workspace-chrome-pane flex h-full min-h-0 flex-col">
      <div className="border-b border-[var(--line)] px-4 py-4">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950 text-sm font-semibold text-white">
            MT
          </div>
          {!collapsed ? (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-950">Metro Trailer</p>
              <p className="text-[0.68rem] uppercase tracking-[0.12em] text-slate-500">
                Fleet Desktop
              </p>
            </div>
          ) : null}
        </Link>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
        <PrimaryNav collapsed={collapsed} />
      </div>

      <div className="border-t border-[var(--line)] px-4 py-3">
        <div
          className={`rounded-xl border border-[var(--line)] bg-[var(--surface-soft)] px-3 py-3 ${
            collapsed ? "text-center" : ""
          }`}
        >
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-slate-500">
            Runtime
          </p>
          <p className="mt-2 text-sm font-medium text-slate-900">
            {runtimeMode === "production" ? "Live system" : "Demo system"}
          </p>
        </div>
      </div>
    </aside>
  );
}

function ShellTopBar({
  actor,
  runtimeMode,
  collapsed,
}: {
  actor: WorkspaceActorSummary;
  runtimeMode: string;
  collapsed: boolean;
}) {
  const router = useRouter();

  return (
    <header className="workspace-titlebar flex h-14 shrink-0 items-center gap-4 border-b border-[var(--line)] px-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-3">
          <div className="min-w-0">
            <Breadcrumbs />
          </div>
          <span className="hidden h-4 w-px bg-[var(--line)] xl:block" />
          <p className="hidden text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-slate-500 xl:block">
            {collapsed ? "Compact nav" : "Expanded nav"}
          </p>
        </div>
      </div>

      <div className="hidden max-w-xl flex-1 xl:block">
        <CommandBar
          actions={[
            {
              id: "workspace-refresh",
              label: "Refresh current workspace",
              description: "Refetch the current route and panel data",
              keywords: ["reload", "refresh", "workspace"],
              icon: "activity",
              run: () => router.refresh(),
            },
          ]}
        />
      </div>

      <div className="flex min-w-0 items-center gap-2">
        <StatusPill
          label={runtimeMode === "production" ? "Live" : "Demo"}
          tone={runtimeMode === "production" ? "emerald" : "amber"}
        />
        <button
          type="button"
          className="rounded-lg border border-transparent p-2 text-slate-500 transition hover:border-[var(--line)] hover:bg-[var(--surface-soft)] hover:text-slate-900"
        >
          <IconActivity size={17} />
        </button>
        <button
          type="button"
          className="rounded-lg border border-transparent p-2 text-slate-500 transition hover:border-[var(--line)] hover:bg-[var(--surface-soft)] hover:text-slate-900"
        >
          <IconBell size={17} />
        </button>
        <div className="ml-1 flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface-soft)] px-2 py-1.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-950 text-[0.72rem] font-semibold text-white">
            {actor.initials}
          </div>
          <div className="hidden min-w-0 xl:block">
            <p className="truncate text-sm font-medium text-slate-900">{actor.displayName}</p>
            <p className="truncate text-[0.68rem] uppercase tracking-[0.12em] text-slate-500">
              {actor.subtitle}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}

function ShellDock({
  actor,
  runtimeMode,
}: {
  actor: WorkspaceActorSummary;
  runtimeMode: string;
}) {
  return (
    <aside className="workspace-chrome-pane flex h-full min-h-0 flex-col">
      <div className="border-b border-[var(--line)] px-4 py-4">
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-slate-500">
          Workspace
        </p>
        <h2 className="mt-2 text-lg font-semibold text-slate-950">Operator dock</h2>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
        <section className="rounded-xl border border-[var(--line)] bg-[var(--surface-soft)] p-4">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-slate-500">
            Active user
          </p>
          <p className="mt-3 text-base font-semibold text-slate-950">{actor.displayName}</p>
          <p className="mt-1 text-sm text-slate-500">{actor.subtitle}</p>
        </section>

        <section className="rounded-xl border border-[var(--line)] bg-[var(--surface-soft)] p-4">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-slate-500">
            Workspace state
          </p>
          <div className="mt-3 space-y-2 text-sm text-slate-700">
            <div className="flex items-center justify-between gap-3">
              <span>Runtime</span>
              <span className="font-medium text-slate-950">
                {runtimeMode === "production" ? "Production" : "Demo"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Layout scope</span>
              <span className="font-medium text-slate-950">{actor.kind}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Persistence</span>
              <span className="font-medium text-slate-950">Database-backed</span>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-[var(--line)] bg-[var(--surface-soft)] p-4">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-slate-500">
            Fast paths
          </p>
          <div className="mt-3 grid gap-2">
            <Link href="/dispatch" className="workspace-dock-link">
              Dispatch board
            </Link>
            <Link href="/assets" className="workspace-dock-link">
              Inventory board
            </Link>
            <Link href="/customers" className="workspace-dock-link">
              Customer board
            </Link>
            <Link href="/reports" className="workspace-dock-link">
              Reporting
            </Link>
          </div>
        </section>

        <section className="rounded-xl border border-[var(--line)] bg-[var(--surface-soft)] p-4">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-slate-500">
            Shortcuts
          </p>
          <div className="mt-3 space-y-2 text-sm text-slate-700">
            <p className="flex items-center justify-between">
              <span>Command palette</span>
              <kbd className="workspace-kbd">Ctrl K</kbd>
            </p>
            <p className="flex items-center justify-between">
              <span>Resize boundaries</span>
              <kbd className="workspace-kbd">Drag</kbd>
            </p>
            <p className="flex items-center justify-between">
              <span>Workspace settings</span>
              <kbd className="workspace-kbd">Dock</kbd>
            </p>
          </div>
        </section>
      </div>

      <div className="border-t border-[var(--line)] px-4 py-3">
        <button
          type="button"
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-[var(--surface-soft)]"
        >
          <IconSettings size={16} />
          Workspace settings
        </button>
      </div>
    </aside>
  );
}

function ShellStatusBar({ actor }: { actor: WorkspaceActorSummary }) {
  return (
    <footer className="flex h-8 shrink-0 items-center justify-between border-t border-[var(--line)] px-4 text-[0.68rem] uppercase tracking-[0.08em] text-slate-500">
      <span>Workspace owner: {actor.ownerKey}</span>
      <span>Layout changes persist across clients</span>
    </footer>
  );
}

export function AppShellClient({
  runtimeMode,
  actor,
  shellLayout,
  children,
}: {
  runtimeMode: string;
  actor: WorkspaceActorSummary;
  shellLayout: ShellLayout;
  children: ReactNode;
}) {
  const collapsed = shellLayout.left < 170;

  return (
    <div className="workspace-root">
      <WorkspacePanels
        pageKey="shell"
        initialLayout={shellLayout}
        minLeft={92}
        maxLeft={320}
        minRight={260}
        maxRight={420}
        className="h-screen overflow-hidden bg-[var(--background)]"
        left={<ShellSidebar collapsed={collapsed} runtimeMode={runtimeMode} />}
        center={
          <div className="workspace-center flex h-screen min-h-0 flex-col overflow-hidden rounded-[1.25rem] border border-[var(--line)] bg-[var(--surface)]">
            <ShellTopBar actor={actor} runtimeMode={runtimeMode} collapsed={collapsed} />
            <main className="min-h-0 flex-1 overflow-y-auto bg-[var(--background)] px-4 py-4">
              {children}
            </main>
            <ShellStatusBar actor={actor} />
          </div>
        }
        right={<ShellDock actor={actor} runtimeMode={runtimeMode} />}
      />
    </div>
  );
}

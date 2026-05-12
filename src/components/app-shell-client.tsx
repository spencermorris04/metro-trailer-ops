"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import {
  Icon,
  IconActivity,
  IconBell,
  IconChevronDown,
  IconSearch,
  IconSettings,
  IconX,
  type IconName,
} from "@/components/icons";
import { WorkspaceLink } from "@/components/workspace-link";
import {
  getActiveDashboardPreset,
  type DashboardPreferences,
} from "@/lib/dashboard-preferences";
import { useNavigationStore } from "@/lib/client/navigation-store";
import type { GlobalSearchGroup } from "@/lib/search-core";
import type { WorkspaceActorSummary } from "@/lib/server/workspace-layouts";

type BranchSummary = {
  id: string;
  code: string;
  name: string;
};

type ShellLayout = {
  left: number;
  right: number;
  activeStore: string;
  density: "compact" | "comfortable";
  theme: "light" | "dark";
  hideCategoryRail: boolean;
};

type NotificationLayout = {
  dismissedIds: string[];
};

type WorkspaceNotification = {
  id: string;
  title: string;
  body: string;
  tone: "critical" | "warning" | "info" | "success";
  href: string;
  source: string;
  createdAt: string | null;
};

const railItems: Array<{
  href: string;
  label: string;
  icon: IconName;
}> = [
  { href: "/", label: "Favorites", icon: "home" },
  { href: "/equipment", label: "Equipment", icon: "truck" },
  { href: "/customers", label: "Customers", icon: "users" },
  { href: "/leases", label: "Leases", icon: "file-text" },
  { href: "/reports", label: "Tools", icon: "wrench" },
  { href: "/portal", label: "User Tools", icon: "user" },
  { href: "/cash", label: "End Of Day", icon: "clipboard" },
  { href: "/financial", label: "Accounting", icon: "dollar" },
  { href: "/ap/bills", label: "AP / Vendors", icon: "folder" },
];

const categoryItems = [
  { href: "/equipment", label: "Equipment" },
  { href: "/customers", label: "Customers" },
  { href: "/leases", label: "Leases" },
  { href: "/financial", label: "Revenue / Accounting" },
  { href: "/dispatch", label: "Logistics" },
  { href: "/maintenance", label: "Maintenance" },
  { href: "/reports", label: "Reports" },
  { href: "/integrations", label: "Configuration" },
];

function activeFor(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

async function saveWorkspaceLayout(pageKey: string, layout: Record<string, unknown>) {
  await fetch("/api/workspace/layouts", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ pageKey, layout }),
  });
}

function ModalBackdrop({
  children,
  onClose,
}: {
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/50" onMouseDown={onClose}>
      <div onMouseDown={(event) => event.stopPropagation()}>{children}</div>
    </div>
  );
}

function StoreSelector({
  branches,
  shellLayout,
  updateShellLayout,
  compact = false,
}: {
  branches: BranchSummary[];
  shellLayout: ShellLayout;
  updateShellLayout: (patch: Partial<ShellLayout>, refresh?: boolean) => void;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const activeBranch = branches.find(
    (branch) =>
      branch.id === shellLayout.activeStore ||
      branch.code === shellLayout.activeStore ||
      branch.name === shellLayout.activeStore,
  );
  const activeLabel = activeBranch ? activeBranch.code : "All";

  function chooseStore(value: string) {
    updateShellLayout({ activeStore: value }, true);
    setOpen(false);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={
          compact
            ? "metro-rail-button"
            : "flex h-9 min-w-48 items-center justify-between gap-2 border border-slate-700 bg-slate-950/40 px-3 text-left text-[0.78rem] text-slate-100 transition hover:border-slate-500"
        }
        title="Store selector"
      >
        <span className={compact ? "metro-rail-icon" : "font-semibold"}>{activeLabel}</span>
        {!compact ? <IconChevronDown size={14} /> : null}
        {compact ? <span className="metro-rail-label">Store</span> : null}
      </button>
      {open ? (
        <div className="absolute left-0 top-full z-50 mt-2 w-72 border border-slate-700 bg-slate-950 p-2 text-slate-100 shadow-xl">
          <button
            type="button"
            onClick={() => chooseStore("all")}
            className="w-full px-3 py-2 text-left text-[0.78rem] hover:bg-slate-800"
          >
            All Stores
          </button>
          <div className="my-1 border-t border-slate-800" />
          <div className="max-h-80 overflow-y-auto">
            {branches.map((branch) => (
              <button
                key={branch.id}
                type="button"
                onClick={() => chooseStore(branch.id)}
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-[0.78rem] hover:bg-slate-800"
              >
                <span>{branch.name}</span>
                <span className="mono text-[0.68rem] text-slate-400">{branch.code}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DashboardSwitcher({
  preferences,
  onPreferenceChange,
  compact = false,
}: {
  preferences: DashboardPreferences;
  onPreferenceChange: (next: DashboardPreferences) => void;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const activePreset = getActiveDashboardPreset(preferences);

  async function chooseDashboard(id: string) {
    const next = { ...preferences, activeDashboardId: id };
    onPreferenceChange(next);
    setOpen(false);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={compact ? "metro-rail-button" : "btn-secondary h-8 bg-white"}
        title="Saved dashboards"
      >
        {compact ? (
          <>
            <Icon name="bar-chart" size={20} className="metro-rail-icon" />
            <span className="metro-rail-label">Dashboards</span>
          </>
        ) : (
          <>
            <Icon name="bar-chart" size={14} />
            {activePreset.label}
          </>
        )}
      </button>
      {open ? (
        <div className="absolute left-0 top-full z-50 mt-2 w-80 border border-slate-200 bg-white p-2 shadow-xl">
          {preferences.presets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => void chooseDashboard(preset.id)}
              className={`w-full px-3 py-2 text-left hover:bg-slate-50 ${
                preset.id === preferences.activeDashboardId ? "bg-blue-50" : ""
              }`}
            >
              <div className="text-[0.82rem] font-semibold text-slate-900">{preset.label}</div>
              <div className="mt-0.5 text-[0.7rem] text-slate-500">{preset.description}</div>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function GlobalSearch({
  activeStore,
}: {
  activeStore: string;
}) {
  const router = useRouter();
  const open = useNavigationStore((state) => state.searchOpen);
  const setOpen = useNavigationStore((state) => state.setSearchOpen);
  const setPendingRoute = useNavigationStore((state) => state.setPendingRoute);
  const [query, setQuery] = useState("");
  const [groups, setGroups] = useState<GlobalSearchGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    function handleKeydown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [setOpen]);

  useEffect(() => {
    if (!open) {
      return;
    }
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          q: query,
          store: activeStore,
        });
        const response = await fetch(`/api/search?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          setGroups([]);
          return;
        }
        const payload = (await response.json()) as { groups: GlobalSearchGroup[] };
        setGroups(payload.groups ?? []);
      } catch {
        if (!controller.signal.aborted) {
          setGroups([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }, 180);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [activeStore, open, query]);

  function openResult(href: string) {
    setPendingRoute(href);
    router.push(href);
    setOpen(false);
    setQuery("");
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-10 min-w-0 flex-1 items-center gap-3 border border-slate-700 bg-white px-3 text-left text-sm text-slate-500 shadow-sm transition hover:border-slate-500 xl:max-w-2xl"
      >
        <IconSearch size={18} className="text-slate-400" />
        <span className="min-w-0 flex-1 truncate">
          Search pages, customers, accounts, trailers, VINs, work orders...
        </span>
        <kbd className="hidden border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[0.65rem] text-slate-400 sm:inline">
          Ctrl K
        </kbd>
      </button>

      {open ? (
        <ModalBackdrop onClose={() => setOpen(false)}>
          <div className="mx-auto mt-[8vh] w-[min(920px,calc(100vw-32px))] overflow-hidden border border-slate-700 bg-slate-950 text-slate-100 shadow-2xl">
            <div className="flex items-center gap-3 border-b border-slate-800 px-4 py-3">
              <IconSearch size={18} className="text-slate-500" />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by page, customer, account, asset, serial, registration, source document, or ledger key"
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-500"
              />
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1 text-slate-500 hover:text-slate-200"
              >
                <IconX size={18} />
              </button>
            </div>
            <div className="max-h-[68vh] overflow-y-auto p-3">
              {loading ? (
                <div className="px-3 py-10 text-center text-sm text-slate-500">Searching...</div>
              ) : groups.length === 0 ? (
                <div className="px-3 py-10 text-center text-sm text-slate-500">
                  No matching records.
                </div>
              ) : (
                <div className="grid gap-3">
                  {groups.map((group) => (
                    <section key={group.id}>
                      <div className="px-2 pb-1 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-slate-500">
                        {group.label}
                      </div>
                      <div className="overflow-hidden border border-slate-800">
                        {group.results.map((result) => (
                          <button
                            key={result.id}
                            type="button"
                            onClick={() => openResult(result.href)}
                            className="flex w-full items-center justify-between gap-4 border-b border-slate-800 px-3 py-2 text-left last:border-b-0 hover:bg-slate-900"
                          >
                            <div className="min-w-0">
                              <div className="truncate text-[0.86rem] font-semibold text-slate-100">
                                {result.title}
                              </div>
                              <div className="truncate text-[0.72rem] text-slate-500">
                                {result.type} / {result.subtitle}
                              </div>
                            </div>
                            <span className="shrink-0 border border-slate-700 px-2 py-1 text-[0.65rem] text-slate-400">
                              {result.badge ?? result.source ?? "Open"}
                            </span>
                          </button>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </div>
          </div>
        </ModalBackdrop>
      ) : null}
    </>
  );
}

function NotificationsButton({
  notificationLayout,
  onDismissedChange,
}: {
  notificationLayout: NotificationLayout;
  onDismissedChange: (next: NotificationLayout) => void;
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<WorkspaceNotification[]>([]);
  const [summary, setSummary] = useState({ total: 0, critical: 0, warning: 0 });
  const dismissed = notificationLayout.dismissedIds ?? [];
  const dismissedKey = dismissed.join(",");

  useEffect(() => {
    const params = new URLSearchParams();
    if (dismissedKey) {
      params.set("dismissed", dismissedKey);
    }

    void fetch(`/api/workspace/notifications?${params.toString()}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { items: WorkspaceNotification[]; summary: typeof summary } | null) => {
        setItems(payload?.items ?? []);
        setSummary(payload?.summary ?? { total: 0, critical: 0, warning: 0 });
      })
      .catch(() => {
        setItems([]);
        setSummary({ total: 0, critical: 0, warning: 0 });
      });
  }, [dismissedKey]);

  async function dismiss(id: string) {
    const next = {
      dismissedIds: [...new Set([...dismissed, id])],
    };
    onDismissedChange(next);
    setItems((current) => current.filter((item) => item.id !== id));
    await saveWorkspaceLayout("notifications", next);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="relative p-2 text-slate-300 transition hover:bg-slate-800 hover:text-white"
        title="Notifications"
      >
        <IconBell size={18} />
        {summary.total > 0 ? (
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-sky-400" />
        ) : null}
      </button>
      {open ? (
        <div className="absolute right-0 top-full z-50 mt-2 w-96 border border-slate-200 bg-white text-slate-900 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
            <div>
              <div className="text-[0.82rem] font-semibold">Notifications</div>
              <div className="text-[0.68rem] text-slate-500">
                {summary.critical} critical / {summary.warning} warnings
              </div>
            </div>
            <WorkspaceLink href="/integrations" className="text-[0.72rem] font-semibold text-[var(--brand)]">
              Open integrations
            </WorkspaceLink>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-3 py-8 text-center text-[0.78rem] text-slate-500">
                No active alerts.
              </div>
            ) : (
              items.map((item) => (
                <div key={item.id} className="border-b border-slate-100 px-3 py-2 last:border-b-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <WorkspaceLink href={item.href} className="text-[0.8rem] font-semibold text-slate-900">
                        {item.title}
                      </WorkspaceLink>
                      <p className="mt-1 text-[0.72rem] leading-5 text-slate-500">{item.body}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void dismiss(item.id)}
                      className="text-[0.68rem] text-slate-400 hover:text-slate-700"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SettingsDrawer({
  shellLayout,
  updateShellLayout,
  onClose,
}: {
  shellLayout: ShellLayout;
  updateShellLayout: (patch: Partial<ShellLayout>, refresh?: boolean) => void;
  onClose: () => void;
}) {
  return (
    <ModalBackdrop onClose={onClose}>
      <aside className="ml-auto h-screen w-[min(420px,100vw)] overflow-y-auto bg-white text-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div>
            <div className="text-sm font-semibold">Dashboard Settings</div>
            <div className="text-[0.72rem] text-slate-500">Saved to your workspace profile</div>
          </div>
          <button type="button" onClick={onClose} className="p-1 text-slate-400 hover:text-slate-900">
            <IconX size={18} />
          </button>
        </div>
        <div className="grid gap-4 p-4">
          <section>
            <div className="workspace-section-label">Density</div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {(["comfortable", "compact"] as const).map((density) => (
                <button
                  key={density}
                  type="button"
                  onClick={() => updateShellLayout({ density })}
                  className={`border px-3 py-2 text-left text-[0.78rem] ${
                    shellLayout.density === density
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-700"
                  }`}
                >
                  {density === "comfortable" ? "Comfortable" : "Compact"}
                </button>
              ))}
            </div>
          </section>
          <section>
            <div className="workspace-section-label">Theme</div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {(["light", "dark"] as const).map((theme) => (
                <button
                  key={theme}
                  type="button"
                  onClick={() => updateShellLayout({ theme })}
                  className={`border px-3 py-2 text-left text-[0.78rem] ${
                    shellLayout.theme === theme
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-700"
                  }`}
                >
                  {theme === "light" ? "Light workspace" : "Dark workspace"}
                </button>
              ))}
            </div>
          </section>
          <label className="flex items-center justify-between gap-3 border border-slate-200 px-3 py-2 text-[0.8rem]">
            <span>Show dashboard category rail</span>
            <input
              type="checkbox"
              checked={!shellLayout.hideCategoryRail}
              onChange={(event) =>
                updateShellLayout({ hideCategoryRail: !event.currentTarget.checked })
              }
            />
          </label>
          <section>
            <div className="workspace-section-label">Rail Width</div>
            <input
              type="range"
              min={92}
              max={132}
              value={shellLayout.left}
              onChange={(event) => updateShellLayout({ left: Number(event.currentTarget.value) })}
              className="mt-3 w-full"
            />
          </section>
        </div>
      </aside>
    </ModalBackdrop>
  );
}

function UserMenu({
  actor,
  runtimeMode,
}: {
  actor: WorkspaceActorSummary;
  runtimeMode: string;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex items-center gap-2 border-l border-slate-700 py-1 pl-3 text-left text-slate-100"
      >
        <span className="flex h-8 w-8 items-center justify-center bg-slate-950 text-[0.72rem] font-semibold">
          {actor.initials}
        </span>
        <span className="hidden min-w-0 xl:block">
          <span className="block truncate text-[0.8rem] font-semibold">{actor.displayName}</span>
          <span className="block truncate text-[0.68rem] text-slate-400">{actor.subtitle}</span>
        </span>
        <IconChevronDown size={14} className="hidden text-slate-400 xl:block" />
      </button>
      {open ? (
        <div className="absolute right-0 top-full z-50 mt-2 w-72 border border-slate-200 bg-white p-2 text-slate-900 shadow-xl">
          <div className="border-b border-slate-100 px-3 py-2">
            <div className="text-sm font-semibold">{actor.displayName}</div>
            <div className="text-[0.72rem] text-slate-500">{actor.ownerKey}</div>
          </div>
          <div className="grid gap-1 py-2">
            <WorkspaceLink href="/reports" className="px-3 py-2 text-[0.8rem] hover:bg-slate-50">
              Reporting workspace
            </WorkspaceLink>
            <WorkspaceLink href="/integrations" className="px-3 py-2 text-[0.8rem] hover:bg-slate-50">
              Integration status
            </WorkspaceLink>
            <button
              type="button"
              onClick={() => router.refresh()}
              className="px-3 py-2 text-left text-[0.8rem] hover:bg-slate-50"
            >
              Refresh workspace
            </button>
          </div>
          <div className="border-t border-slate-100 px-3 py-2 text-[0.7rem] text-slate-500">
            Runtime: {runtimeMode === "production" ? "Production" : "Demo"}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AppRail({
  branches,
  shellLayout,
  updateShellLayout,
  dashboardPreferences,
  setDashboardPreferences,
}: {
  branches: BranchSummary[];
  shellLayout: ShellLayout;
  updateShellLayout: (patch: Partial<ShellLayout>, refresh?: boolean) => void;
  dashboardPreferences: DashboardPreferences;
  setDashboardPreferences: (next: DashboardPreferences) => void;
}) {
  const pathname = usePathname();
  const optimisticPath = useNavigationStore((state) => state.optimisticPath);
  const activePath = optimisticPath ?? pathname;

  return (
    <aside className="flex h-full min-h-0 flex-col bg-[#151922] text-slate-100">
      <WorkspaceLink href="/" className="flex h-20 items-center justify-center border-b border-slate-800">
        <span className="text-[1.45rem] font-black">
          <span className="text-white">M</span>
          <span className="text-[#ff6b35]">T</span>
        </span>
      </WorkspaceLink>
      <div className="grid gap-1 px-2 py-3">
        <StoreSelector
          branches={branches}
          shellLayout={shellLayout}
          updateShellLayout={updateShellLayout}
          compact
        />
        <DashboardSwitcher
          preferences={dashboardPreferences}
          onPreferenceChange={setDashboardPreferences}
          compact
        />
        {railItems.map((item) => {
          const active = activeFor(activePath, item.href);
          return (
            <WorkspaceLink
              key={item.href}
              href={item.href}
              className={`metro-rail-button ${active ? "metro-rail-button-active" : ""}`}
              title={item.label}
            >
              <Icon name={item.icon} size={20} className="metro-rail-icon" />
              <span className="metro-rail-label">{item.label}</span>
            </WorkspaceLink>
          );
        })}
      </div>
    </aside>
  );
}

function CategoryRail({ hidden }: { hidden: boolean }) {
  const pathname = usePathname();
  const optimisticPath = useNavigationStore((state) => state.optimisticPath);
  const activePath = optimisticPath ?? pathname;
  if (hidden) {
    return null;
  }

  return (
    <nav className="flex h-11 shrink-0 items-center overflow-x-auto border-b border-[var(--line)] bg-[#e8e8ea] px-3">
      <div className="flex min-w-max items-center gap-7">
        {categoryItems.map((item) => (
          <WorkspaceLink
            key={item.href}
            href={item.href}
            className={`flex items-center gap-2 text-[0.78rem] font-semibold ${
              activeFor(activePath, item.href) ? "text-slate-950" : "text-slate-600 hover:text-slate-950"
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-sky-600" />
            {item.label}
          </WorkspaceLink>
        ))}
        <WorkspaceLink href="/reports" className="text-slate-500 hover:text-slate-900" title="Add dashboard">
          +
        </WorkspaceLink>
      </div>
    </nav>
  );
}

function TopBar({
  actor,
  runtimeMode,
  branches,
  shellLayout,
  updateShellLayout,
  dashboardPreferences,
  setDashboardPreferences,
  notificationLayout,
  setNotificationLayout,
  onOpenSettings,
}: {
  actor: WorkspaceActorSummary;
  runtimeMode: string;
  branches: BranchSummary[];
  shellLayout: ShellLayout;
  updateShellLayout: (patch: Partial<ShellLayout>, refresh?: boolean) => void;
  dashboardPreferences: DashboardPreferences;
  setDashboardPreferences: (next: DashboardPreferences) => void;
  notificationLayout: NotificationLayout;
  setNotificationLayout: (next: NotificationLayout) => void;
  onOpenSettings: () => void;
}) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-t-4 border-sky-700 bg-[#20212a] px-3 text-slate-100">
      <div className="hidden xl:block">
        <StoreSelector
          branches={branches}
          shellLayout={shellLayout}
          updateShellLayout={updateShellLayout}
        />
      </div>
      <GlobalSearch activeStore={shellLayout.activeStore} />
      <div className="hidden xl:block">
        <DashboardSwitcher
          preferences={dashboardPreferences}
          onPreferenceChange={setDashboardPreferences}
        />
      </div>
      <div className="ml-auto flex items-center gap-1">
        <NotificationsButton
          notificationLayout={notificationLayout}
          onDismissedChange={setNotificationLayout}
        />
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event("metro-workspace-refresh"))}
          className="p-2 text-slate-300 transition hover:bg-slate-800 hover:text-white"
          title="Activity"
        >
          <IconActivity size={18} />
        </button>
        <button
          type="button"
          onClick={onOpenSettings}
          className="p-2 text-slate-300 transition hover:bg-slate-800 hover:text-white"
          title="Settings"
        >
          <IconSettings size={18} />
        </button>
        <UserMenu actor={actor} runtimeMode={runtimeMode} />
      </div>
    </header>
  );
}

function ShellStatusBar({
  actor,
  shellLayout,
}: {
  actor: WorkspaceActorSummary;
  shellLayout: ShellLayout;
}) {
  return (
    <footer className="flex h-6 shrink-0 items-center justify-between border-t border-[var(--line)] bg-[var(--surface-soft)] px-3 text-[0.625rem] text-slate-400">
      <span>{actor.ownerKey}</span>
      <span>
        Store {shellLayout.activeStore === "all" ? "All" : shellLayout.activeStore} / Layout saved
      </span>
    </footer>
  );
}

export function AppShellClient({
  runtimeMode,
  actor,
  shellLayout,
  dashboardPreferences,
  notificationLayout,
  branches,
  children,
}: {
  runtimeMode: string;
  actor: WorkspaceActorSummary;
  shellLayout: ShellLayout;
  dashboardPreferences: DashboardPreferences;
  notificationLayout: NotificationLayout;
  branches: BranchSummary[];
  children: ReactNode;
}) {
  const router = useRouter();
  const [currentShellLayout, setCurrentShellLayout] = useState(shellLayout);
  const [currentDashboardPreferences, setCurrentDashboardPreferences] =
    useState(dashboardPreferences);
  const [currentNotificationLayout, setCurrentNotificationLayout] =
    useState(notificationLayout);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const pathname = usePathname();
  const pendingRoute = useNavigationStore((state) => state.pendingRoute);
  const clearPendingRoute = useNavigationStore((state) => state.clearPendingRoute);

  useEffect(() => {
    setCurrentShellLayout(shellLayout);
  }, [shellLayout]);

  useEffect(() => {
    setCurrentDashboardPreferences(dashboardPreferences);
  }, [dashboardPreferences]);

  useEffect(() => {
    setCurrentNotificationLayout(notificationLayout);
  }, [notificationLayout]);

  useEffect(() => {
    function refreshWorkspace() {
      router.refresh();
    }

    window.addEventListener("metro-workspace-refresh", refreshWorkspace);
    return () => window.removeEventListener("metro-workspace-refresh", refreshWorkspace);
  }, [router]);

  useEffect(() => {
    clearPendingRoute();
  }, [clearPendingRoute, pathname]);

  useEffect(() => {
    if (!pendingRoute) {
      return;
    }
    const timer = window.setTimeout(() => clearPendingRoute(), 4500);
    return () => window.clearTimeout(timer);
  }, [clearPendingRoute, pendingRoute]);

  const railWidth = Math.min(132, Math.max(92, currentShellLayout.left || 108));
  const mainPadding = currentShellLayout.density === "compact" ? "p-2" : "p-3";
  const rootClassName = useMemo(
    () =>
      [
        "workspace-root",
        currentShellLayout.theme === "dark" ? "metro-theme-dark" : "metro-theme-light",
        currentShellLayout.density === "compact"
          ? "metro-density-compact"
          : "metro-density-comfortable",
      ].join(" "),
    [currentShellLayout.density, currentShellLayout.theme],
  );

  async function updateShellLayout(patch: Partial<ShellLayout>, refresh = false) {
    const next = {
      ...currentShellLayout,
      ...patch,
    };
    setCurrentShellLayout(next);
    await saveWorkspaceLayout("shell", next);
    if (refresh) {
      router.refresh();
    }
  }

  async function updateDashboardPreferences(next: DashboardPreferences) {
    setCurrentDashboardPreferences(next);
    await saveWorkspaceLayout("dashboards", next);
    router.refresh();
  }

  return (
    <div className={rootClassName}>
      {pendingRoute ? <div className="workspace-route-progress" aria-hidden="true" /> : null}
      <div
        className="hidden h-screen overflow-hidden xl:grid"
        style={{
          gridTemplateColumns: `${railWidth}px minmax(0, 1fr)`,
        }}
      >
        <AppRail
          branches={branches}
          shellLayout={currentShellLayout}
          updateShellLayout={updateShellLayout}
          dashboardPreferences={currentDashboardPreferences}
          setDashboardPreferences={updateDashboardPreferences}
        />
        <div className="flex min-h-0 flex-col overflow-hidden">
          <TopBar
            actor={actor}
            runtimeMode={runtimeMode}
            branches={branches}
            shellLayout={currentShellLayout}
            updateShellLayout={updateShellLayout}
            dashboardPreferences={currentDashboardPreferences}
            setDashboardPreferences={updateDashboardPreferences}
            notificationLayout={currentNotificationLayout}
            setNotificationLayout={setCurrentNotificationLayout}
            onOpenSettings={() => setSettingsOpen(true)}
          />
          <CategoryRail hidden={currentShellLayout.hideCategoryRail} />
          <main className={`min-h-0 flex-1 overflow-y-auto bg-[var(--background)] ${mainPadding}`}>
            {children}
          </main>
          <ShellStatusBar actor={actor} shellLayout={currentShellLayout} />
        </div>
      </div>

      <div className="flex h-screen flex-col overflow-hidden xl:hidden">
        <TopBar
          actor={actor}
          runtimeMode={runtimeMode}
          branches={branches}
          shellLayout={currentShellLayout}
          updateShellLayout={updateShellLayout}
          dashboardPreferences={currentDashboardPreferences}
          setDashboardPreferences={updateDashboardPreferences}
          notificationLayout={currentNotificationLayout}
          setNotificationLayout={setCurrentNotificationLayout}
          onOpenSettings={() => setSettingsOpen(true)}
        />
        <CategoryRail hidden={currentShellLayout.hideCategoryRail} />
        <main className={`min-h-0 flex-1 overflow-y-auto bg-[var(--background)] ${mainPadding}`}>
          {children}
        </main>
        <ShellStatusBar actor={actor} shellLayout={currentShellLayout} />
      </div>

      {settingsOpen ? (
        <SettingsDrawer
          shellLayout={currentShellLayout}
          updateShellLayout={updateShellLayout}
          onClose={() => setSettingsOpen(false)}
        />
      ) : null}
    </div>
  );
}

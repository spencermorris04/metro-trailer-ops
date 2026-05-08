import type { ReactNode } from "react";
import { headers } from "next/headers";

import { AppShellClient } from "@/components/app-shell-client";
import { normalizeDashboardPreferences } from "@/lib/dashboard-preferences";
import { listBranches } from "@/lib/server/platform";
import { getRuntimeMode } from "@/lib/server/runtime";
import {
  getWorkspaceLayout,
  type WorkspaceActorSummary,
  type WorkspaceLayoutValue,
} from "@/lib/server/workspace-layouts";

const defaultShellLayout = {
  left: 108,
  right: 0,
  activeStore: "all",
  density: "comfortable" as const,
  theme: "light" as const,
  hideCategoryRail: false,
};

const defaultNotificationLayout = {
  dismissedIds: [] as string[],
};

const fallbackActor: WorkspaceActorSummary = {
  ownerKey: "anonymous:shared",
  displayName: "Local Console",
  subtitle: "Anonymous workspace",
  initials: "LC",
  roleKey: "anonymous",
  kind: "anonymous",
};

async function getShellWorkspaceLayout(
  inputHeaders: Headers,
  pageKey: string,
  defaults: WorkspaceLayoutValue,
) {
  try {
    return await getWorkspaceLayout(inputHeaders, pageKey, defaults);
  } catch (error) {
    console.error(`Failed to load workspace layout "${pageKey}".`, error);
    return {
      actor: fallbackActor,
      pageKey,
      layout: defaults,
    };
  }
}

async function listShellBranches() {
  try {
    return await listBranches();
  } catch (error) {
    console.error("Failed to load shell branches.", error);
    return [];
  }
}

export async function AppShell({ children }: { children: ReactNode }) {
  const runtimeMode = getRuntimeMode();
  const requestHeaders = new Headers(await headers());
  const [shell, dashboards, notifications, branches] = await Promise.all([
    getShellWorkspaceLayout(requestHeaders, "shell", defaultShellLayout),
    getShellWorkspaceLayout(requestHeaders, "dashboards", normalizeDashboardPreferences(null)),
    getShellWorkspaceLayout(requestHeaders, "notifications", defaultNotificationLayout),
    listShellBranches(),
  ]);

  return (
    <AppShellClient
      runtimeMode={runtimeMode}
      actor={shell.actor}
      shellLayout={shell.layout as typeof defaultShellLayout}
      dashboardPreferences={normalizeDashboardPreferences(dashboards.layout)}
      notificationLayout={notifications.layout as typeof defaultNotificationLayout}
      branches={branches.map((branch) => ({
        id: branch.id,
        code: branch.code,
        name: branch.name,
      }))}
    >
      {children}
    </AppShellClient>
  );
}

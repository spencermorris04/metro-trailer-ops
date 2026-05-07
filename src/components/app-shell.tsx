import type { ReactNode } from "react";
import { headers } from "next/headers";

import { AppShellClient } from "@/components/app-shell-client";
import { normalizeDashboardPreferences } from "@/lib/dashboard-preferences";
import { listBranches } from "@/lib/server/platform";
import { getRuntimeMode } from "@/lib/server/runtime";
import { getWorkspaceLayout } from "@/lib/server/workspace-layouts";

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

export async function AppShell({ children }: { children: ReactNode }) {
  const runtimeMode = getRuntimeMode();
  const requestHeaders = new Headers(await headers());
  const [shell, dashboards, notifications, branches] = await Promise.all([
    getWorkspaceLayout(requestHeaders, "shell", defaultShellLayout),
    getWorkspaceLayout(requestHeaders, "dashboards", normalizeDashboardPreferences(null)),
    getWorkspaceLayout(requestHeaders, "notifications", defaultNotificationLayout),
    listBranches(),
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

import type { ReactNode } from "react";
import { headers } from "next/headers";

import { AppShellClient } from "@/components/app-shell-client";
import { getRuntimeMode } from "@/lib/server/runtime";
import { getWorkspaceLayout } from "@/lib/server/workspace-layouts";

const defaultShellLayout = {
  left: 256,
  right: 304,
};

export async function AppShell({ children }: { children: ReactNode }) {
  const runtimeMode = getRuntimeMode();
  const shell = await getWorkspaceLayout(
    new Headers(await headers()),
    "shell",
    defaultShellLayout,
  );

  return (
    <AppShellClient
      runtimeMode={runtimeMode}
      actor={shell.actor}
      shellLayout={shell.layout as typeof defaultShellLayout}
    >
      {children}
    </AppShellClient>
  );
}

import type { ReactNode } from "react";

import { AppShellClient } from "@/components/app-shell-client";
import { getRuntimeMode } from "@/lib/server/runtime";

export function AppShell({ children }: { children: ReactNode }) {
  const runtimeMode = getRuntimeMode();

  return <AppShellClient runtimeMode={runtimeMode}>{children}</AppShellClient>;
}

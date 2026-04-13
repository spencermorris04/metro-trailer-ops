import { ok } from "@/lib/server/api";
import { getWorkflowFlags } from "@/lib/server/feature-flags";
import { getObservabilityConfig, getRequestTelemetry, logEvent } from "@/lib/server/observability";
import { getRuntimeMode } from "@/lib/server/runtime";

export async function GET(request: Request) {
  const telemetry = getRequestTelemetry(request);
  logEvent("info", "Health endpoint checked", { route: "/api/health" }, request);

  return ok(
    {
      status: "ok",
      service: "metro-trailer",
      runtimeMode: getRuntimeMode(),
      checkedAt: new Date().toISOString(),
      request: telemetry,
      featureFlags: getWorkflowFlags(),
      observability: getObservabilityConfig(),
    },
    undefined,
    request,
  );
}

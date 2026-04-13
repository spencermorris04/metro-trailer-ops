import { errorResponse, ok } from "@/lib/server/api";
import { buildReadinessSnapshot } from "@/lib/server/reporting";
import { logEvent } from "@/lib/server/observability";

export async function GET(request: Request) {
  try {
    const readiness = await buildReadinessSnapshot();
    logEvent("info", "Readiness endpoint checked", {
      route: "/api/ready",
      status: readiness.status,
    }, request);

    return ok(
      readiness,
      {
        status: readiness.status === "ready" ? 200 : 503,
      },
      request,
    );
  } catch (error) {
    return errorResponse(error, request);
  }
}

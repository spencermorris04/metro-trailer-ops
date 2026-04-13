import { errorResponse, ok } from "@/lib/server/api";
import { requireApiPermission } from "@/lib/server/authorization";
import { ensureWorkflowEnabled } from "@/lib/server/feature-flags";
import { logEvent } from "@/lib/server/observability";
import { exportRevenueReport, getReports } from "@/lib/server/platform";

export async function GET(request: Request) {
  try {
    await requireApiPermission(request, "reports.view");
    ensureWorkflowEnabled("reports");
    const data = await getReports();
    logEvent("info", "Operational reports retrieved", {
      route: "/api/reports",
    }, request);
    return ok(
      {
        data,
      },
      undefined,
      request,
    );
  } catch (error) {
    return errorResponse(error, request);
  }
}

export async function POST(request: Request) {
  try {
    await requireApiPermission(request, "reports.view");
    ensureWorkflowEnabled("reports");
    const exportResult = await exportRevenueReport();
    logEvent("info", "Revenue export prepared", {
      route: "/api/reports",
      exportType: "revenue",
    }, request);
    return ok({
      message: "Revenue report export prepared.",
      data: exportResult.data,
    }, undefined, request);
  } catch (error) {
    return errorResponse(error, request);
  }
}

import { errorResponse, ok } from "@/lib/server/api";
import { requireStaffApiPermission } from "@/lib/server/authorization";
import { replayIntegrationJob } from "@/lib/server/platform";

type ReplayIntegrationJobRouteParams = {
  params: Promise<{
    jobId: string;
  }>;
};

export async function POST(
  request: Request,
  { params }: ReplayIntegrationJobRouteParams,
) {
  try {
    await requireStaffApiPermission(request, "integrations.manage");
    const { jobId } = await params;
    const data = await replayIntegrationJob(jobId);

    return ok({
      message: "Integration job replay queued.",
      data,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

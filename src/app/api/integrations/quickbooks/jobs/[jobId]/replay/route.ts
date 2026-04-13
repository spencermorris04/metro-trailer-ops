import { errorResponse, ok } from "@/lib/server/api";
import { requireApiPermission } from "@/lib/server/authorization";
import { replayQuickBooksJob } from "@/lib/server/quickbooks-service";

export async function POST(
  request: Request,
  context: { params: Promise<{ jobId: string }> },
) {
  try {
    await requireApiPermission(request, "integrations.manage");
    const { jobId } = await context.params;

    return ok(await replayQuickBooksJob(jobId));
  } catch (error) {
    return errorResponse(error);
  }
}

import { errorResponse, ok } from "@/lib/server/api";
import { requireApiPermission } from "@/lib/server/authorization";
import { resolveAccountingSyncIssue } from "@/lib/server/quickbooks-service";

export async function POST(
  request: Request,
  context: { params: Promise<{ issueId: string }> },
) {
  try {
    const actor = await requireApiPermission(request, "accounting.manage");
    const { issueId } = await context.params;

    return ok(await resolveAccountingSyncIssue(issueId, actor.userId));
  } catch (error) {
    return errorResponse(error);
  }
}

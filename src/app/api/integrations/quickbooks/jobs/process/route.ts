import { errorResponse, ok } from "@/lib/server/api";
import { requireApiPermission } from "@/lib/server/authorization";
import { processPendingQuickBooksJobs } from "@/lib/server/quickbooks-service";

export async function POST(request: Request) {
  try {
    const actor = await requireApiPermission(request, "integrations.manage");
    const body = (await request.json().catch(() => ({}))) as {
      limit?: number;
    };

    return ok({
      data: await processPendingQuickBooksJobs(
        typeof body.limit === "number" ? body.limit : 10,
        actor.userId ?? "quickbooks-worker",
      ),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

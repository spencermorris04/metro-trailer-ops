import { errorResponse, ok } from "@/lib/server/api";
import { requireApiPermission } from "@/lib/server/authorization";
import { listAccountingSyncIssues } from "@/lib/server/quickbooks-service";

export async function GET(request: Request) {
  try {
    await requireApiPermission(request, "accounting.view");
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    return ok({
      data: await listAccountingSyncIssues(
        status === "open" || status === "resolved" || status === "ignored"
          ? { status }
          : undefined,
      ),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

import { errorResponse, ok } from "@/lib/server/api";
import { requireStaffApiPermission } from "@/lib/server/authorization";
import { listRecord360ReceiptReviewQueue } from "@/lib/server/platform";

export async function GET(request: Request) {
  try {
    await requireStaffApiPermission(request, "integrations.manage");
    const data = await listRecord360ReceiptReviewQueue();

    return ok({
      count: data.length,
      data,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

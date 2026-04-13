import { errorResponse, ok } from "@/lib/server/api";
import { requireApiPermission } from "@/lib/server/authorization";
import { disconnectQuickBooksConnection } from "@/lib/server/quickbooks-service";

export async function POST(request: Request) {
  try {
    await requireApiPermission(request, "integrations.manage");
    return ok(await disconnectQuickBooksConnection());
  } catch (error) {
    return errorResponse(error);
  }
}

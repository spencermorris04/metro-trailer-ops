import { errorResponse, ok } from "@/lib/server/api";
import { requireStaffApiPermission } from "@/lib/server/authorization";
import { listPortalAccessLogs } from "@/lib/server/portal-service";

export async function GET(request: Request) {
  try {
    await requireStaffApiPermission(request, "customers.view");
    const { searchParams } = new URL(request.url);
    const customerNumber = searchParams.get("customerNumber");

    if (!customerNumber) {
      return ok({ error: "customerNumber is required" }, { status: 400 });
    }

    const data = await listPortalAccessLogs(customerNumber);
    return ok({
      count: data.length,
      data,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

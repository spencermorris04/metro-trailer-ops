import { errorResponse, ok } from "@/lib/server/api";
import { requireStaffApiPermission } from "@/lib/server/authorization";
import { listCustomers } from "@/lib/server/platform";

export async function GET(request: Request) {
  try {
    await requireStaffApiPermission(request, "customers.view");

    const { searchParams } = new URL(request.url);
    const pageSize = Math.min(12, Math.max(1, Number(searchParams.get("pageSize") ?? "8")));
    const customers = await listCustomers({
      q: searchParams.get("q") ?? undefined,
    });

    return ok(
      {
        data: customers.slice(0, pageSize),
        count: customers.length,
      },
      undefined,
      request,
    );
  } catch (error) {
    return errorResponse(error, request);
  }
}

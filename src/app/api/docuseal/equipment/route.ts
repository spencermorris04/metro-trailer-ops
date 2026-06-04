import { errorResponse, ok } from "@/lib/server/api";
import { requireStaffApiPermission } from "@/lib/server/authorization";
import { getEquipmentListView } from "@/lib/server/platform";

export async function GET(request: Request) {
  try {
    await requireStaffApiPermission(request, "assets.view");

    const { searchParams } = new URL(request.url);
    const pageSize = Math.min(12, Math.max(1, Number(searchParams.get("pageSize") ?? "8")));
    const data = await getEquipmentListView({
      q: searchParams.get("q") ?? undefined,
      page: 1,
      pageSize,
    });

    return ok(
      {
        data: data.data,
        count: data.total,
      },
      undefined,
      request,
    );
  } catch (error) {
    return errorResponse(error, request);
  }
}

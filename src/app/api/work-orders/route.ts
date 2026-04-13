import { workOrderSchema } from "@/lib/domain/validators";
import { created, errorResponse, ok, readJson } from "@/lib/server/api";
import {
  requireApiPermission,
  requireStaffApiPermission,
  resolveAssetScope,
} from "@/lib/server/authorization";
import { createWorkOrder, listWorkOrders } from "@/lib/server/platform";

export async function GET(request: Request) {
  await requireStaffApiPermission(request, "maintenance.view");

  const { searchParams } = new URL(request.url);
  const data = await listWorkOrders({
    status: searchParams.get("status") ?? undefined,
    branch: searchParams.get("branch") ?? undefined,
    assetNumber: searchParams.get("assetNumber") ?? undefined,
  });

  return ok({
    count: data.length,
    data,
  });
}

export async function POST(request: Request) {
  try {
    const payload = await readJson(request);
    const parsed = workOrderSchema.parse(payload);
    const scope = await resolveAssetScope(parsed.assetNumber);

    if (!scope) {
      return ok({ error: "Asset not found" }, { status: 404 });
    }

    const actor = await requireApiPermission(request, "maintenance.manage", {
      branchId: scope.branchId ?? undefined,
    });
    const data = await createWorkOrder(parsed, actor.userId ?? undefined);
    return created({ message: "Work order created.", data });
  } catch (error) {
    return errorResponse(error);
  }
}

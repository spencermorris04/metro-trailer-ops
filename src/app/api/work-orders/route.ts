import { workOrderSchema } from "@/lib/domain/validators";
import {
  created,
  errorResponse,
  getIdempotencyKey,
  ok,
  readJson,
} from "@/lib/server/api";
import {
  requireApiPermission,
  requireStaffApiPermission,
  resolveAssetScope,
} from "@/lib/server/authorization";
import { createWorkOrder, listWorkOrders } from "@/lib/server/platform";

export async function GET(request: Request) {
  await requireStaffApiPermission(request, "maintenance.view");

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const pageSize = Math.min(
    100,
    Math.max(1, Number(searchParams.get("pageSize") ?? "25")),
  );
  const data = await listWorkOrders({
    status: searchParams.get("status") ?? undefined,
    branch: searchParams.get("branch") ?? undefined,
    assetNumber: searchParams.get("assetNumber") ?? undefined,
  });
  const start = (page - 1) * pageSize;
  const paged = data.slice(start, start + pageSize);

  return ok({
    count: data.length,
    page,
    pageSize,
    filters: {
      status: searchParams.get("status") ?? null,
      branch: searchParams.get("branch") ?? null,
      assetNumber: searchParams.get("assetNumber") ?? null,
    },
    data: paged,
  });
}

export async function POST(request: Request) {
  try {
    const payload = await readJson<Record<string, unknown>>(request);
    const parsed = workOrderSchema.parse({
      ...payload,
      idempotencyKey:
        typeof payload.idempotencyKey === "string"
          ? payload.idempotencyKey
          : getIdempotencyKey(request),
    });
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

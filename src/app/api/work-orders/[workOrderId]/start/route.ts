import { workOrderStartSchema } from "@/lib/domain/validators";
import {
  errorResponse,
  getIdempotencyKey,
  ok,
  readJson,
} from "@/lib/server/api";
import {
  requireApiPermission,
  resolveWorkOrderScope,
} from "@/lib/server/authorization";
import { startWorkOrder } from "@/lib/server/platform";

type WorkOrderStartRouteParams = {
  params: Promise<{
    workOrderId: string;
  }>;
};

export async function POST(
  request: Request,
  { params }: WorkOrderStartRouteParams,
) {
  try {
    const { workOrderId } = await params;
    const scope = await resolveWorkOrderScope(workOrderId);

    if (!scope) {
      return ok({ error: "Work order not found" }, { status: 404 });
    }

    const payload = await readJson<Record<string, unknown>>(request).catch(
      () => ({} as Record<string, unknown>),
    );
    const parsed = workOrderStartSchema.parse({
      ...payload,
      idempotencyKey:
        typeof payload.idempotencyKey === "string"
          ? payload.idempotencyKey
          : getIdempotencyKey(request),
    });
    const actor = await requireApiPermission(request, "maintenance.manage", {
      branchId: scope.branchId ?? undefined,
    });
    const data = await startWorkOrder(workOrderId, parsed, actor.userId ?? undefined);
    return ok({ message: "Work order started.", data });
  } catch (error) {
    return errorResponse(error, request);
  }
}

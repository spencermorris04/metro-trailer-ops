import { workOrderCloseSchema } from "@/lib/domain/validators";
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
import { closeWorkOrder } from "@/lib/server/platform";

type WorkOrderCloseRouteParams = {
  params: Promise<{
    workOrderId: string;
  }>;
};

export async function POST(
  request: Request,
  { params }: WorkOrderCloseRouteParams,
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
    const parsed = workOrderCloseSchema.parse({
      ...payload,
      idempotencyKey:
        typeof payload.idempotencyKey === "string"
          ? payload.idempotencyKey
          : getIdempotencyKey(request),
    });
    const actor = await requireApiPermission(request, "maintenance.manage", {
      branchId: scope.branchId ?? undefined,
    });
    const data = await closeWorkOrder(workOrderId, parsed, actor.userId ?? undefined);
    return ok({ message: "Work order closed.", data });
  } catch (error) {
    return errorResponse(error, request);
  }
}

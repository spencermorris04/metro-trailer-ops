import { workOrderRepairCompleteSchema } from "@/lib/domain/validators";
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
import { markWorkOrderRepairComplete } from "@/lib/server/platform";

type WorkOrderRepairCompleteRouteParams = {
  params: Promise<{
    workOrderId: string;
  }>;
};

export async function POST(
  request: Request,
  { params }: WorkOrderRepairCompleteRouteParams,
) {
  try {
    const { workOrderId } = await params;
    const scope = await resolveWorkOrderScope(workOrderId);

    if (!scope) {
      return ok({ error: "Work order not found" }, { status: 404 });
    }

    const payload = await readJson<Record<string, unknown>>(request);
    const parsed = workOrderRepairCompleteSchema.parse({
      ...payload,
      idempotencyKey:
        typeof payload.idempotencyKey === "string"
          ? payload.idempotencyKey
          : getIdempotencyKey(request),
    });
    const actor = await requireApiPermission(request, "maintenance.manage", {
      branchId: scope.branchId ?? undefined,
    });
    const data = await markWorkOrderRepairComplete(
      workOrderId,
      parsed,
      actor.userId ?? undefined,
    );
    return ok({ message: "Work order marked repair complete.", data });
  } catch (error) {
    return errorResponse(error, request);
  }
}

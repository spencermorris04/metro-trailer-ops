import { workOrderUpdateSchema } from "@/lib/domain/validators";
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
import { getWorkOrderDetail, updateWorkOrder } from "@/lib/server/platform";

type WorkOrderRouteParams = {
  params: Promise<{
    workOrderId: string;
  }>;
};

export async function GET(
  request: Request,
  { params }: WorkOrderRouteParams,
) {
  try {
    const { workOrderId } = await params;
    const scope = await resolveWorkOrderScope(workOrderId);

    if (!scope) {
      return ok({ error: "Work order not found" }, { status: 404 });
    }

    await requireApiPermission(request, "maintenance.view", {
      branchId: scope.branchId ?? undefined,
    });
    const data = await getWorkOrderDetail(workOrderId);
    return ok({ data });
  } catch (error) {
    return errorResponse(error, request);
  }
}

export async function PATCH(
  request: Request,
  { params }: WorkOrderRouteParams,
) {
  try {
    const { workOrderId } = await params;
    const scope = await resolveWorkOrderScope(workOrderId);

    if (!scope) {
      return ok({ error: "Work order not found" }, { status: 404 });
    }

    const payload = await readJson<Record<string, unknown>>(request);
    const parsed = workOrderUpdateSchema.parse({
      ...payload,
      idempotencyKey:
        typeof payload.idempotencyKey === "string"
          ? payload.idempotencyKey
          : getIdempotencyKey(request),
    });

    const actor = await requireApiPermission(request, "maintenance.manage", {
      branchId: scope.branchId ?? undefined,
    });

    if (parsed.billingApprovalStatus !== undefined) {
      await requireApiPermission(request, "accounting.manage", {
        branchId: scope.branchId ?? undefined,
      });
    }

    const data = await updateWorkOrder(workOrderId, parsed, actor.userId ?? undefined);
    return ok({ message: "Work order updated.", data });
  } catch (error) {
    return errorResponse(error, request);
  }
}

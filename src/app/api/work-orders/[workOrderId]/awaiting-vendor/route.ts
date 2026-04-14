import { workOrderAwaitingSchema } from "@/lib/domain/validators";
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
import { markWorkOrderAwaitingVendor } from "@/lib/server/platform";

type WorkOrderAwaitingVendorRouteParams = {
  params: Promise<{
    workOrderId: string;
  }>;
};

export async function POST(
  request: Request,
  { params }: WorkOrderAwaitingVendorRouteParams,
) {
  try {
    const { workOrderId } = await params;
    const scope = await resolveWorkOrderScope(workOrderId);

    if (!scope) {
      return ok({ error: "Work order not found" }, { status: 404 });
    }

    const payload = await readJson<Record<string, unknown>>(request);
    const parsed = workOrderAwaitingSchema.parse({
      ...payload,
      idempotencyKey:
        typeof payload.idempotencyKey === "string"
          ? payload.idempotencyKey
          : getIdempotencyKey(request),
    });
    const actor = await requireApiPermission(request, "maintenance.manage", {
      branchId: scope.branchId ?? undefined,
    });
    const data = await markWorkOrderAwaitingVendor(
      workOrderId,
      parsed,
      actor.userId ?? undefined,
    );
    return ok({ message: "Work order moved to awaiting vendor.", data });
  } catch (error) {
    return errorResponse(error, request);
  }
}

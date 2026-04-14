import { workOrderRepairCompleteSchema } from "@/lib/domain/validators";
import {
  errorResponse,
  getIdempotencyKey,
  ok,
  readJson,
} from "@/lib/server/api";
import { requireApiPermission, resolveWorkOrderScope } from "@/lib/server/authorization";
import { markWorkOrderRepairComplete } from "@/lib/server/platform";

type CompleteWorkOrderRouteParams = {
  params: Promise<{
    workOrderId: string;
  }>;
};

export async function POST(
  request: Request,
  { params }: CompleteWorkOrderRouteParams,
) {
  try {
    const { workOrderId } = await params;
    const scope = await resolveWorkOrderScope(workOrderId);

    if (!scope) {
      return ok({ error: "Work order not found" }, { status: 404 });
    }

    const actor = await requireApiPermission(request, "maintenance.manage", {
      branchId: scope.branchId ?? undefined,
    });
    const payload = await readJson<Record<string, unknown>>(request).catch(
      () => ({} as Record<string, unknown>),
    );
    const parsed = workOrderRepairCompleteSchema.parse({
      ...payload,
      repairSummary:
        typeof payload.repairSummary === "string"
          ? payload.repairSummary
          : typeof payload.notes === "string"
            ? payload.notes
            : "Repair completed and ready for verification.",
      idempotencyKey:
        typeof payload.idempotencyKey === "string"
          ? payload.idempotencyKey
          : getIdempotencyKey(request),
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

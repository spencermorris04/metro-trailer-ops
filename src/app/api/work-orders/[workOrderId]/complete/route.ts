import { workOrderCompletionSchema } from "@/lib/domain/validators";
import { errorResponse, ok, readJson } from "@/lib/server/api";
import { requireApiPermission, resolveWorkOrderScope } from "@/lib/server/authorization";
import { completeWorkOrder } from "@/lib/server/platform";

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
    const payload = await readJson<Record<string, unknown>>(request).catch(() => ({}));
    const parsed = workOrderCompletionSchema.parse(payload);
    const data = await completeWorkOrder(
      workOrderId,
      actor.userId ?? undefined,
      parsed as Parameters<typeof completeWorkOrder>[2],
    );
    return ok({ message: "Work order completed.", data });
  } catch (error) {
    return errorResponse(error);
  }
}

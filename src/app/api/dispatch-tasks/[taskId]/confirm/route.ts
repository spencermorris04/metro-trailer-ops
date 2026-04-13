import { dispatchConfirmationSchema } from "@/lib/domain/validators";
import { errorResponse, ok, readJson } from "@/lib/server/api";
import { requireApiPermission, resolveDispatchTaskScope } from "@/lib/server/authorization";
import { confirmDispatchTask } from "@/lib/server/platform";

type ConfirmDispatchRouteParams = {
  params: Promise<{
    taskId: string;
  }>;
};

export async function POST(
  request: Request,
  { params }: ConfirmDispatchRouteParams,
) {
  try {
    const { taskId } = await params;
    const scope = await resolveDispatchTaskScope(taskId);

    if (!scope) {
      return ok({ error: "Dispatch task not found" }, { status: 404 });
    }

    const actor = await requireApiPermission(request, "dispatch.manage", {
      branchId: scope.branchId ?? undefined,
      customerId: scope.customerId ?? undefined,
    });
    const payload = await readJson(request);
    const parsed = dispatchConfirmationSchema.parse(payload);
    const data = await confirmDispatchTask(taskId, parsed, actor.userId ?? undefined);
    return ok({ message: "Dispatch task confirmed.", data });
  } catch (error) {
    return errorResponse(error);
  }
}

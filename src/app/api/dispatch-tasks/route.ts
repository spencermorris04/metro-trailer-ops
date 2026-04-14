import {
  dispatchConfirmationSchema,
  dispatchTaskSchema,
} from "@/lib/domain/validators";
import { created, errorResponse, ok, readJson } from "@/lib/server/api";
import {
  confirmDispatchTask,
  createDispatchTask,
  listDispatchTasks,
} from "@/lib/server/platform";
import {
  requireApiPermission,
  requireStaffApiPermission,
  resolveAssetScope,
  resolveDispatchTaskScope,
} from "@/lib/server/authorization";

export async function GET(request: Request) {
  await requireStaffApiPermission(request, "dispatch.view");

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") ?? "25")));
  const data = await listDispatchTasks({
    status: searchParams.get("status") ?? undefined,
    branch: searchParams.get("branch") ?? undefined,
    type: searchParams.get("type") ?? undefined,
  });
  const start = (page - 1) * pageSize;
  const paged = data.slice(start, start + pageSize);

  return ok({
    count: data.length,
    page,
    pageSize,
    filters: {
      status: searchParams.get("status"),
      branch: searchParams.get("branch"),
      type: searchParams.get("type"),
    },
    data: paged,
  });
}

export async function POST(request: Request) {
  try {
    const payload = await readJson<Record<string, unknown>>(request);

    if ("outcome" in payload) {
      const parsedConfirm = dispatchConfirmationSchema.parse(payload);
      const taskId = String((payload as Record<string, unknown>).taskId ?? "");
      const scope = await resolveDispatchTaskScope(taskId);

      if (!scope) {
        return ok({ error: "Dispatch task not found" }, { status: 404 });
      }

      const actor = await requireApiPermission(request, "dispatch.manage", {
        branchId: scope.branchId ?? undefined,
        customerId: scope.customerId ?? undefined,
      });
      const data = await confirmDispatchTask(taskId, parsedConfirm, actor.userId ?? undefined);
      return ok({ message: "Dispatch task confirmed.", data });
    }

    const parsed = dispatchTaskSchema.parse(payload);
    const scope = await resolveAssetScope(parsed.assetNumber);

    if (!scope) {
      return ok({ error: "Asset not found" }, { status: 404 });
    }

    const actor = await requireApiPermission(request, "dispatch.manage", {
      branchId: scope.branchId ?? undefined,
    });
    const data = await createDispatchTask(parsed, actor.userId ?? undefined);
    return created({ message: "Dispatch task created.", data });
  } catch (error) {
    return errorResponse(error);
  }
}

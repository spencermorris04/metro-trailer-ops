import {
  dispatchConfirmationSchema,
  dispatchTaskSchema,
} from "@/lib/domain/validators";
import { created, errorResponse, ok, readJson } from "@/lib/server/api";
import {
  confirmDispatchTask,
  createDispatchTask,
  listDispatchTasks,
} from "@/lib/server/platform-service";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const data = listDispatchTasks({
    status: searchParams.get("status") ?? undefined,
    branch: searchParams.get("branch") ?? undefined,
    type: searchParams.get("type") ?? undefined,
  });

  return ok({
    count: data.length,
    data,
  });
}

export async function POST(request: Request) {
  try {
    const payload = await readJson<Record<string, unknown>>(request);

    if ("outcome" in payload) {
      const parsedConfirm = dispatchConfirmationSchema.parse(payload);
      const taskId = String((payload as Record<string, unknown>).taskId ?? "");
      const data = confirmDispatchTask(taskId, parsedConfirm);
      return ok({ message: "Dispatch task confirmed.", data });
    }

    const parsed = dispatchTaskSchema.parse(payload);
    const data = createDispatchTask(parsed);
    return created({ message: "Dispatch task created.", data });
  } catch (error) {
    return errorResponse(error);
  }
}

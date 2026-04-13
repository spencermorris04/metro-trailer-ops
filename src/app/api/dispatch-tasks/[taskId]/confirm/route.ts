import { dispatchConfirmationSchema } from "@/lib/domain/validators";
import { errorResponse, ok, readJson } from "@/lib/server/api";
import { confirmDispatchTask } from "@/lib/server/platform-service";

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
    const payload = await readJson(request);
    const parsed = dispatchConfirmationSchema.parse(payload);
    const data = confirmDispatchTask(taskId, parsed);
    return ok({ message: "Dispatch task confirmed.", data });
  } catch (error) {
    return errorResponse(error);
  }
}

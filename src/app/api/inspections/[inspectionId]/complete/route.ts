import { inspectionCompletionSchema } from "@/lib/domain/validators";
import { errorResponse, ok, readJson } from "@/lib/server/api";
import { completeInspection } from "@/lib/server/platform-service";

type CompleteInspectionRouteParams = {
  params: Promise<{
    inspectionId: string;
  }>;
};

export async function POST(
  request: Request,
  { params }: CompleteInspectionRouteParams,
) {
  try {
    const { inspectionId } = await params;
    const payload = await readJson(request);
    const parsed = inspectionCompletionSchema.parse(payload);
    const data = completeInspection(inspectionId, parsed);
    return ok({ message: "Inspection completed.", data });
  } catch (error) {
    return errorResponse(error);
  }
}

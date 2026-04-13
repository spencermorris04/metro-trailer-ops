import { inspectionCompletionSchema } from "@/lib/domain/validators";
import { errorResponse, ok, readJson } from "@/lib/server/api";
import { requireApiPermission, resolveInspectionScope } from "@/lib/server/authorization";
import { completeInspection } from "@/lib/server/platform";

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
    const scope = await resolveInspectionScope(inspectionId);

    if (!scope) {
      return ok({ error: "Inspection not found" }, { status: 404 });
    }

    const actor = await requireApiPermission(request, "inspections.manage", {
      branchId: scope.branchId ?? undefined,
      customerId: scope.customerId ?? undefined,
    });
    const payload = await readJson(request);
    const parsed = inspectionCompletionSchema.parse(payload);
    const data = await completeInspection(
      inspectionId,
      parsed,
      actor.userId ?? undefined,
    );
    return ok({ message: "Inspection completed.", data });
  } catch (error) {
    return errorResponse(error);
  }
}

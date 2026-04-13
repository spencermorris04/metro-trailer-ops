import {
  inspectionCompletionSchema,
  inspectionRequestSchema,
} from "@/lib/domain/validators";
import { created, errorResponse, ok, readJson } from "@/lib/server/api";
import {
  completeInspection,
  createInspection,
  listInspections,
} from "@/lib/server/platform-service";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const data = listInspections({
    status: searchParams.get("status") ?? undefined,
    assetNumber: searchParams.get("assetNumber") ?? undefined,
    contractNumber: searchParams.get("contractNumber") ?? undefined,
  });

  return ok({
    count: data.length,
    data,
  });
}

export async function POST(request: Request) {
  try {
    const payload = await readJson<Record<string, unknown>>(request);

    if ("damageSummary" in payload) {
      const parsedComplete = inspectionCompletionSchema.parse(payload);
      const inspectionId = String((payload as Record<string, unknown>).inspectionId ?? "");
      const data = completeInspection(inspectionId, parsedComplete);
      return ok({ message: "Inspection completed.", data });
    }

    const parsed = inspectionRequestSchema.parse(payload);
    const data = await createInspection(parsed);
    return created({ message: "Inspection requested.", data });
  } catch (error) {
    return errorResponse(error);
  }
}

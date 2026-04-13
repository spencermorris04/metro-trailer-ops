import { collectionsEvaluateSchema } from "@/lib/domain/validators";
import { errorResponse, ok, readJson } from "@/lib/server/api";
import { requireStaffApiPermission } from "@/lib/server/authorization";
import { evaluateCollectionsWorklist } from "@/lib/server/platform";

export async function POST(request: Request) {
  try {
    const actor = await requireStaffApiPermission(request, "collections.manage");
    const payload = collectionsEvaluateSchema.parse(await readJson(request).catch(() => ({})));
    const data = await evaluateCollectionsWorklist(
      payload.collectionCaseId,
      actor.userId ?? undefined,
    );

    return ok({
      message: "Collections cadence evaluated.",
      data,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

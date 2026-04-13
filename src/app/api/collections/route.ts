import { collectionUpdateSchema } from "@/lib/domain/validators";
import { errorResponse, ok, readJson } from "@/lib/server/api";
import {
  requireApiPermission,
  requireStaffApiPermission,
  resolveCollectionCaseScope,
} from "@/lib/server/authorization";
import { listCollectionCases, updateCollectionCase } from "@/lib/server/platform";

export async function GET(request: Request) {
  await requireStaffApiPermission(request, "collections.view");

  const { searchParams } = new URL(request.url);
  const data = await listCollectionCases({
    status: searchParams.get("status") ?? undefined,
    owner: searchParams.get("owner") ?? undefined,
  });

  return ok({
    count: data.length,
    data,
  });
}

export async function PATCH(request: Request) {
  try {
    const payload = await readJson(request);
    const collectionCaseId = String((payload as Record<string, unknown>).collectionCaseId ?? "");
    const scope = await resolveCollectionCaseScope(collectionCaseId);

    if (!scope) {
      return ok({ error: "Collection case not found" }, { status: 404 });
    }

    const actor = await requireApiPermission(request, "collections.manage", {
      branchId: scope.branchId ?? undefined,
      customerId: scope.customerId ?? undefined,
    });
    const parsed = collectionUpdateSchema.parse(payload);
    const data = await updateCollectionCase(
      collectionCaseId,
      parsed,
      actor.userId ?? undefined,
    );
    return ok({ message: "Collection case updated.", data });
  } catch (error) {
    return errorResponse(error);
  }
}

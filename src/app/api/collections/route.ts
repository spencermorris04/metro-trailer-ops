import { collectionUpdateSchema } from "@/lib/domain/validators";
import { errorResponse, ok, readJson } from "@/lib/server/api";
import { listCollectionCases, updateCollectionCase } from "@/lib/server/platform-service";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const data = listCollectionCases({
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
    const parsed = collectionUpdateSchema.parse(payload);
    const data = updateCollectionCase(collectionCaseId, parsed);
    return ok({ message: "Collection case updated.", data });
  } catch (error) {
    return errorResponse(error);
  }
}

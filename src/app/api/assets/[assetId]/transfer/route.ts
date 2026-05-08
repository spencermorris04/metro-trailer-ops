import { assetTransferSchema } from "@/lib/domain/validators";
import { errorResponse, getIdempotencyKey, ok, readJson } from "@/lib/server/api";
import { requireApiPermission, resolveAssetScope } from "@/lib/server/authorization";
import { assetInvalidationTags } from "@/lib/server/cache-tags";
import { transferAsset } from "@/lib/server/platform";
import { invalidateWorkspaceCache } from "@/lib/server/workspace-cache";

type AssetTransferRouteParams = {
  params: Promise<{
    assetId: string;
  }>;
};

export async function POST(
  request: Request,
  { params }: AssetTransferRouteParams,
) {
  try {
    const { assetId } = await params;
    const scope = await resolveAssetScope(assetId);

    if (!scope) {
      return ok({ error: "Asset not found" }, { status: 404 });
    }

    const actor = await requireApiPermission(request, "assets.manage", {
      branchId: scope.branchId ?? undefined,
    });
    const payload = await readJson<Record<string, unknown>>(request);
    const parsed = assetTransferSchema.parse({
      ...payload,
      idempotencyKey: payload?.idempotencyKey ?? getIdempotencyKey(request),
    });
    const data = await transferAsset(assetId, parsed, actor.userId ?? undefined);
    await invalidateWorkspaceCache(assetInvalidationTags(data.id));
    return ok({ message: "Asset transferred.", data });
  } catch (error) {
    return errorResponse(error);
  }
}

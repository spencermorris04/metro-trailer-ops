import { assetUpdateSchema } from "@/lib/domain/validators";
import {
  deleteAsset,
  listAssets,
  updateAsset,
} from "@/lib/server/platform";
import { errorResponse, noContent, ok, readJson } from "@/lib/server/api";
import {
  requireApiPermission,
  requireStaffApiPermission,
  resolveAssetScope,
} from "@/lib/server/authorization";

type AssetRouteParams = {
  params: Promise<{
    assetId: string;
  }>;
};

export async function GET(request: Request, { params }: AssetRouteParams) {
  const { assetId } = await params;
  const scope = await resolveAssetScope(assetId);

  if (!scope) {
    return ok({ error: "Asset not found" }, { status: 404 });
  }

  await requireStaffApiPermission(request, "assets.view", {
    branchId: scope.branchId ?? undefined,
  });
  const asset = (await listAssets()).find(
    (entry) => entry.id === assetId || entry.assetNumber === assetId,
  );

  return asset ? ok({ data: asset }) : ok({ error: "Asset not found" }, { status: 404 });
}

export async function PATCH(request: Request, { params }: AssetRouteParams) {
  try {
    const { assetId } = await params;
    const scope = await resolveAssetScope(assetId);

    if (!scope) {
      return ok({ error: "Asset not found" }, { status: 404 });
    }

    const actor = await requireApiPermission(request, "assets.manage", {
      branchId: scope.branchId ?? undefined,
    });
    const payload = await readJson(request);
    const parsed = assetUpdateSchema.parse(payload);
    const data = await updateAsset(assetId, parsed, actor.userId ?? undefined);
    return ok({ message: "Asset updated.", data });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request, { params }: AssetRouteParams) {
  try {
    const { assetId } = await params;
    const scope = await resolveAssetScope(assetId);

    if (!scope) {
      return ok({ error: "Asset not found" }, { status: 404 });
    }

    const actor = await requireApiPermission(request, "assets.manage", {
      branchId: scope.branchId ?? undefined,
    });
    await deleteAsset(assetId, actor.userId ?? undefined);
    return noContent();
  } catch (error) {
    return errorResponse(error);
  }
}

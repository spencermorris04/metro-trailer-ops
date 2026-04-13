import { assetUpdateSchema } from "@/lib/domain/validators";
import {
  deleteAsset,
  listAssets,
  updateAsset,
} from "@/lib/server/platform-service";
import { errorResponse, noContent, ok, readJson } from "@/lib/server/api";

type AssetRouteParams = {
  params: Promise<{
    assetId: string;
  }>;
};

export async function GET(_request: Request, { params }: AssetRouteParams) {
  const { assetId } = await params;
  const asset = listAssets().find(
    (entry) => entry.id === assetId || entry.assetNumber === assetId,
  );

  return asset ? ok({ data: asset }) : ok({ error: "Asset not found" }, { status: 404 });
}

export async function PATCH(request: Request, { params }: AssetRouteParams) {
  try {
    const { assetId } = await params;
    const payload = await readJson(request);
    const parsed = assetUpdateSchema.parse(payload);
    const data = updateAsset(assetId, parsed);
    return ok({ message: "Asset updated.", data });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: Request, { params }: AssetRouteParams) {
  try {
    const { assetId } = await params;
    deleteAsset(assetId);
    return noContent();
  } catch (error) {
    return errorResponse(error);
  }
}

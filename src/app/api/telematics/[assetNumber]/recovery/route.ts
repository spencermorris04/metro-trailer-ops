import { errorResponse, ok } from "@/lib/server/api";
import {
  requireApiPermission,
  resolveTelematicsScopeByAssetNumber,
} from "@/lib/server/authorization";
import { getCollectionsRecoverySnapshot } from "@/lib/server/platform";

type RecoveryRouteParams = {
  params: Promise<Record<string, string>>;
};

export async function GET(
  request: Request,
  { params }: RecoveryRouteParams,
) {
  try {
    const assetNumber = (await params).assetNumber;
    const scope = await resolveTelematicsScopeByAssetNumber(assetNumber);

    if (!scope) {
      return ok({ error: "Asset not found" }, { status: 404 });
    }

    await requireApiPermission(request, "collections.view", {
      branchId: scope.branchId ?? undefined,
    });

    const snapshot = await getCollectionsRecoverySnapshot(assetNumber);
    return ok({
      data: snapshot.data,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

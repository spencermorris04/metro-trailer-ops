import { errorResponse, ok } from "@/lib/server/api";
import { requireApiPermission, resolveTelematicsScopeByAssetNumber } from "@/lib/server/authorization";
import {
  getCollectionsRecoverySnapshot,
  syncTelematics,
} from "@/lib/server/platform";

type SyncTelematicsRouteParams = {
  params: Promise<{
    assetNumber: string;
  }>;
};

export async function POST(
  request: Request,
  { params }: SyncTelematicsRouteParams,
) {
  try {
    const { assetNumber } = await params;
    const scope = await resolveTelematicsScopeByAssetNumber(assetNumber);

    if (!scope) {
      return ok({ error: "Asset not found" }, { status: 404 });
    }

    const actor = await requireApiPermission(request, "integrations.manage", {
      branchId: scope.branchId ?? undefined,
    });
    const sync = await syncTelematics(assetNumber, actor.userId ?? undefined);
    const recovery = await getCollectionsRecoverySnapshot(assetNumber);

    return ok({
      message: "Telematics synced.",
      data: {
        sync,
        recovery: recovery.data,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

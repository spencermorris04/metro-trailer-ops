import { errorResponse, ok } from "@/lib/server/api";
import {
  getCollectionsRecoverySnapshot,
  syncTelematics,
} from "@/lib/server/platform-service";

type SyncTelematicsRouteParams = {
  params: Promise<{
    assetNumber: string;
  }>;
};

export async function POST(
  _request: Request,
  { params }: SyncTelematicsRouteParams,
) {
  try {
    const { assetNumber } = await params;
    const ping = await syncTelematics(assetNumber);
    const recovery = await getCollectionsRecoverySnapshot(assetNumber);

    return ok({
      message: "Telematics synced.",
      data: {
        ping,
        recovery: recovery.data,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

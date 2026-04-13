import { assetTransitionSchema } from "@/lib/domain/validators";
import { errorResponse, ok, readJson } from "@/lib/server/api";
import { transitionAsset } from "@/lib/server/platform-service";

type AssetTransitionRouteParams = {
  params: Promise<{
    assetId: string;
  }>;
};

export async function POST(
  request: Request,
  { params }: AssetTransitionRouteParams,
) {
  try {
    const { assetId } = await params;
    const payload = await readJson(request);
    const parsed = assetTransitionSchema.parse(payload);
    const data = transitionAsset(assetId, parsed.toStatus, "System", parsed.reason);
    return ok({ message: "Asset transitioned.", data });
  } catch (error) {
    return errorResponse(error);
  }
}

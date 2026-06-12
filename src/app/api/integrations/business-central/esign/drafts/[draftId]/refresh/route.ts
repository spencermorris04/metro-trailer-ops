import { errorResponse, ok } from "@/lib/server/api";
import {
  refreshBusinessCentralESignDraftStatus,
  requireBusinessCentralESignKey,
} from "@/lib/server/business-central-esign";

type RefreshRouteContext = {
  params: Promise<{ draftId: string }>;
};

export async function POST(request: Request, context: RefreshRouteContext) {
  try {
    requireBusinessCentralESignKey(request);

    const { draftId } = await context.params;
    const data = await refreshBusinessCentralESignDraftStatus(draftId);

    return ok(
      { message: "Business Central E-Sign draft status refreshed.", data },
      undefined,
      request,
    );
  } catch (error) {
    return errorResponse(error, request);
  }
}

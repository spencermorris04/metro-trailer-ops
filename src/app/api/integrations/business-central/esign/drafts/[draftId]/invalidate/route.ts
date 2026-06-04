import { errorResponse, ok } from "@/lib/server/api";
import {
  invalidateBusinessCentralESignDraft,
  requireBusinessCentralESignKey,
} from "@/lib/server/business-central-esign";

type InvalidateRouteContext = {
  params: Promise<{ draftId: string }>;
};

export async function POST(request: Request, context: InvalidateRouteContext) {
  try {
    requireBusinessCentralESignKey(request);

    const { draftId } = await context.params;
    const data = await invalidateBusinessCentralESignDraft(draftId);

    return ok({ message: "Business Central E-Sign draft invalidated.", data }, undefined, request);
  } catch (error) {
    return errorResponse(error, request);
  }
}

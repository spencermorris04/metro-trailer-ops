import { errorResponse, ok } from "@/lib/server/api";
import {
  prepareBusinessCentralESignDraftPreview,
  requireBusinessCentralESignKey,
} from "@/lib/server/business-central-esign";

type PrepareRouteContext = {
  params: Promise<{ draftId: string }>;
};

export async function POST(request: Request, context: PrepareRouteContext) {
  try {
    requireBusinessCentralESignKey(request);

    const { draftId } = await context.params;
    const data = await prepareBusinessCentralESignDraftPreview(draftId);

    return ok({ message: "Business Central E-Sign preview prepared.", data }, undefined, request);
  } catch (error) {
    return errorResponse(error, request);
  }
}

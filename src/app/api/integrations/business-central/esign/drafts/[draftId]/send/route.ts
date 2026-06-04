import { errorResponse, ok } from "@/lib/server/api";
import {
  requireBusinessCentralESignKey,
  sendBusinessCentralESignDraft,
} from "@/lib/server/business-central-esign";

type SendRouteContext = {
  params: Promise<{ draftId: string }>;
};

export async function POST(request: Request, context: SendRouteContext) {
  try {
    requireBusinessCentralESignKey(request);

    const { draftId } = await context.params;
    const data = await sendBusinessCentralESignDraft(draftId);

    return ok({ message: "Business Central E-Sign draft sent.", data }, undefined, request);
  } catch (error) {
    return errorResponse(error, request);
  }
}

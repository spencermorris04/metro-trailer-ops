import { errorResponse, ok, readJson } from "@/lib/server/api";
import {
  parseBusinessCentralDraftInput,
  requireBusinessCentralESignKey,
  updateBusinessCentralESignDraft,
} from "@/lib/server/business-central-esign";

type UpdateRouteContext = {
  params: Promise<{ draftId: string }>;
};

export async function POST(request: Request, context: UpdateRouteContext) {
  try {
    requireBusinessCentralESignKey(request);

    const { draftId } = await context.params;
    const input = parseBusinessCentralDraftInput(await readJson(request));
    const data = await updateBusinessCentralESignDraft(draftId, input);

    return ok({ message: "Business Central E-Sign draft updated.", data }, undefined, request);
  } catch (error) {
    return errorResponse(error, request);
  }
}

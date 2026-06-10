import { errorResponse, ok } from "@/lib/server/api";
import {
  createBusinessCentralESignPreviewUrl,
  requireBusinessCentralESignKey,
} from "@/lib/server/business-central-esign";

type PreviewUrlRouteContext = {
  params: Promise<{ draftId: string }>;
};

export async function POST(request: Request, context: PreviewUrlRouteContext) {
  try {
    requireBusinessCentralESignKey(request);

    const { draftId } = await context.params;
    const baseUrl = new URL(request.url).origin;
    const data = await createBusinessCentralESignPreviewUrl(draftId, baseUrl);

    return ok({ message: "Business Central E-Sign preview URL created.", data }, undefined, request);
  } catch (error) {
    return errorResponse(error, request);
  }
}

import { errorResponse, ok, readJson } from "@/lib/server/api";
import {
  createBusinessCentralESignEditorUrl,
  parseBusinessCentralEditorSessionRequest,
  requireBusinessCentralESignKey,
} from "@/lib/server/business-central-esign";

type EditorUrlRouteContext = {
  params: Promise<{ draftId: string }>;
};

export async function POST(request: Request, context: EditorUrlRouteContext) {
  try {
    requireBusinessCentralESignKey(request);

    const { draftId } = await context.params;
    const baseUrl = new URL(request.url).origin;
    const body = await readJson(request).catch(() => ({}));
    const data = await createBusinessCentralESignEditorUrl(
      draftId,
      baseUrl,
      parseBusinessCentralEditorSessionRequest(body),
    );

    return ok({ message: "Business Central E-Sign editor URL created.", data }, undefined, request);
  } catch (error) {
    return errorResponse(error, request);
  }
}

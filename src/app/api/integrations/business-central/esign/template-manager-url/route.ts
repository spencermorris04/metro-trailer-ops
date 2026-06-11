import { errorResponse, ok, readJson } from "@/lib/server/api";
import {
  createBusinessCentralESignTemplateManagerUrl,
  parseBusinessCentralEditorSessionRequest,
  requireBusinessCentralESignKey,
} from "@/lib/server/business-central-esign";

export async function POST(request: Request) {
  try {
    requireBusinessCentralESignKey(request);

    const baseUrl = new URL(request.url).origin;
    const body = await readJson(request).catch(() => ({}));
    const bodyObject = body && typeof body === "object" && !Array.isArray(body) ? body : {};
    const data = await createBusinessCentralESignTemplateManagerUrl(
      baseUrl,
      parseBusinessCentralEditorSessionRequest({
        ...bodyObject,
        canManageTemplates: true,
      }),
    );

    return ok(
      { message: "Business Central E-Sign template manager URL created.", data },
      undefined,
      request,
    );
  } catch (error) {
    return errorResponse(error, request);
  }
}

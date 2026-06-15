import { errorResponse, ok } from "@/lib/server/api";
import { detectDocusealTemplateFields } from "@/lib/server/docuseal-prefill";
import {
  parseDocusealTemplateId,
  requireDocusealTemplatePermission,
} from "@/lib/server/docuseal-template-routes";

type DetectFieldsRouteContext = {
  params: Promise<{ templateId: string }>;
};

export async function POST(request: Request, context: DetectFieldsRouteContext) {
  try {
    await requireDocusealTemplatePermission(request, "documents.manage");
    const { templateId } = await context.params;
    const docusealTemplateId = parseDocusealTemplateId(templateId);

    const data = await detectDocusealTemplateFields(docusealTemplateId);

    return ok({ message: "E-Sign fields detected.", data }, undefined, request);
  } catch (error) {
    return errorResponse(error, request);
  }
}

import { errorResponse, ok } from "@/lib/server/api";
import { requireStaffApiPermission } from "@/lib/server/authorization";
import { validateBusinessCentralTemplateManagerAuth } from "@/lib/server/business-central-esign";
import { detectDocusealTemplateFields } from "@/lib/server/docuseal-prefill";

type DetectFieldsRouteContext = {
  params: Promise<{ templateId: string }>;
};

export async function POST(request: Request, context: DetectFieldsRouteContext) {
  try {
    const searchParams = new URL(request.url).searchParams;
    if (searchParams.get("session") && searchParams.get("token")) {
      validateBusinessCentralTemplateManagerAuth({
        expires: searchParams.get("expires") ?? undefined,
        session: searchParams.get("session") ?? undefined,
        token: searchParams.get("token") ?? undefined,
      });
    } else {
      await requireStaffApiPermission(request, "documents.manage");
    }

    const { templateId } = await context.params;
    const docusealTemplateId = Number(templateId);

    if (!Number.isInteger(docusealTemplateId) || docusealTemplateId <= 0) {
      throw new Error("A valid E-Sign template ID is required.");
    }

    const data = await detectDocusealTemplateFields(docusealTemplateId);

    return ok({ message: "E-Sign fields detected.", data }, undefined, request);
  } catch (error) {
    return errorResponse(error, request);
  }
}

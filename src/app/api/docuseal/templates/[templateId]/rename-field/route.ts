import { z } from "zod";

import { errorResponse, ok } from "@/lib/server/api";
import { requireStaffApiPermission } from "@/lib/server/authorization";
import { validateBusinessCentralTemplateManagerAuth } from "@/lib/server/business-central-esign";
import { renameDocusealTemplateField } from "@/lib/server/docuseal-prefill";

const renameFieldSchema = z.object({
  fieldName: z.string().trim().min(1),
  newFieldName: z.string().trim().min(1).max(100),
  fieldUuid: z.string().trim().optional(),
});

type RenameFieldRouteContext = {
  params: Promise<{ templateId: string }>;
};

export async function POST(request: Request, context: RenameFieldRouteContext) {
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

    const body = renameFieldSchema.parse(await request.json());
    const data = await renameDocusealTemplateField({
      docusealTemplateId,
      fieldName: body.fieldName,
      newFieldName: body.newFieldName,
      fieldUuid: body.fieldUuid,
    });

    return ok({ message: "E-Sign field renamed.", data }, undefined, request);
  } catch (error) {
    return errorResponse(error, request);
  }
}

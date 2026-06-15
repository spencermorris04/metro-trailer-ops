import { z } from "zod";

import { errorResponse, ok } from "@/lib/server/api";
import { renameDocusealTemplateField } from "@/lib/server/docuseal-prefill";
import {
  parseDocusealTemplateId,
  requireDocusealTemplatePermission,
} from "@/lib/server/docuseal-template-routes";

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
    await requireDocusealTemplatePermission(request, "documents.manage");
    const { templateId } = await context.params;
    const docusealTemplateId = parseDocusealTemplateId(templateId);

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

import { z } from "zod";

import { errorResponse, ok, readJson } from "@/lib/server/api";
import { requireStaffApiPermission } from "@/lib/server/authorization";
import {
  getDocusealDraft,
  updateDocusealDraft,
} from "@/lib/server/docuseal-prefill";

const updateDraftSchema = z.object({
  location: z.string().optional(),
  customerName: z.string().optional(),
  customerEmail: z.string().email().or(z.literal("")).optional(),
  subject: z.string().optional(),
  message: z.string().optional(),
  values: z.record(z.string(), z.unknown()).optional(),
});

type DraftRouteContext = {
  params: Promise<{ draftId: string }>;
};

export async function GET(request: Request, context: DraftRouteContext) {
  try {
    await requireStaffApiPermission(request, "documents.view");

    const { draftId } = await context.params;
    return ok({ data: await getDocusealDraft(draftId) }, undefined, request);
  } catch (error) {
    return errorResponse(error, request);
  }
}

export async function PATCH(request: Request, context: DraftRouteContext) {
  try {
    await requireStaffApiPermission(request, "documents.manage");

    const { draftId } = await context.params;
    const payload = updateDraftSchema.parse(await readJson(request));
    const data = await updateDocusealDraft(draftId, payload);

    return ok({ message: "DocuSeal draft saved.", data }, undefined, request);
  } catch (error) {
    return errorResponse(error, request);
  }
}

import { z } from "zod";

import { created, errorResponse, ok, readJson } from "@/lib/server/api";
import { requireStaffApiPermission } from "@/lib/server/authorization";
import {
  createDocusealDraft,
  listDocusealDrafts,
} from "@/lib/server/docuseal-prefill";

const createDraftSchema = z.object({
  templateKey: z.string().min(1),
  location: z.string().optional(),
  customerName: z.string().optional(),
  customerEmail: z.string().email().or(z.literal("")).optional(),
  subject: z.string().optional(),
  message: z.string().optional(),
  values: z.record(z.string(), z.unknown()).optional(),
});

export async function GET(request: Request) {
  await requireStaffApiPermission(request, "documents.view");

  return ok({
    data: await listDocusealDrafts(),
  });
}

export async function POST(request: Request) {
  try {
    await requireStaffApiPermission(request, "documents.manage");

    const payload = createDraftSchema.parse(await readJson(request));
    const data = await createDocusealDraft(payload);

    return created({ message: "DocuSeal draft created.", data }, request);
  } catch (error) {
    return errorResponse(error, request);
  }
}

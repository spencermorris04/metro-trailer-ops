import { z } from "zod";

import { errorResponse, ok, readJson } from "@/lib/server/api";
import { requireStaffApiPermission } from "@/lib/server/authorization";
import {
  listDocusealPrefillDefaults,
  upsertDocusealPrefillDefault,
} from "@/lib/server/docuseal-prefill";

const saveDefaultSchema = z.object({
  templateKey: z.string().min(1),
  scopeType: z.enum(["global", "location", "trailer_type"]),
  scopeKey: z.string().optional(),
  values: z.record(z.string(), z.unknown()).optional(),
  merge: z.boolean().optional(),
});

export async function GET(request: Request) {
  try {
    await requireStaffApiPermission(request, "documents.view");

    return ok({ data: await listDocusealPrefillDefaults() }, undefined, request);
  } catch (error) {
    return errorResponse(error, request);
  }
}

export async function POST(request: Request) {
  try {
    await requireStaffApiPermission(request, "documents.manage");

    const payload = saveDefaultSchema.parse(await readJson(request));
    const data = await upsertDocusealPrefillDefault(payload);

    return ok({ message: "DocuSeal defaults saved.", data }, undefined, request);
  } catch (error) {
    return errorResponse(error, request);
  }
}

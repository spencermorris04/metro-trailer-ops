import { z } from "zod";

import { errorResponse, ok, readJson } from "@/lib/server/api";
import { updateBusinessCentralESignEditorDraft } from "@/lib/server/business-central-esign";

const editorSaveSchema = z.object({
  expires: z.union([z.string(), z.number()]),
  token: z.string().min(1),
  values: z.record(z.string(), z.unknown()),
});

type EditorSaveRouteContext = {
  params: Promise<{ draftId: string }>;
};

export async function POST(request: Request, context: EditorSaveRouteContext) {
  try {
    const { draftId } = await context.params;
    const input = editorSaveSchema.parse(await readJson(request));
    const data = await updateBusinessCentralESignEditorDraft(
      draftId,
      String(input.expires),
      input.token,
      input.values,
    );

    return ok({ message: "Metro E-Sign draft saved.", data }, undefined, request);
  } catch (error) {
    return errorResponse(error, request);
  }
}

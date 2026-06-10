import { z } from "zod";

import { errorResponse, ok, readJson } from "@/lib/server/api";
import { runBusinessCentralESignEditorAction } from "@/lib/server/business-central-esign";

const actionSchema = z.object({
  expires: z.union([z.string(), z.number()]),
  token: z.string().min(1),
  action: z.enum(["prepare", "send", "invalidate"]),
});

type EditorActionRouteContext = {
  params: Promise<{ draftId: string }>;
};

export async function POST(request: Request, context: EditorActionRouteContext) {
  try {
    const { draftId } = await context.params;
    const input = actionSchema.parse(await readJson(request));
    const data = await runBusinessCentralESignEditorAction(
      draftId,
      String(input.expires),
      input.token,
      input.action,
    );

    return ok({ message: "Metro E-Sign draft updated.", data }, undefined, request);
  } catch (error) {
    return errorResponse(error, request);
  }
}

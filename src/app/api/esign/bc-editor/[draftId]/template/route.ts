import { z } from "zod";

import { errorResponse, ok, readJson } from "@/lib/server/api";
import { switchBusinessCentralESignEditorTemplate } from "@/lib/server/business-central-esign";

const switchTemplateSchema = z.object({
  expires: z.union([z.string(), z.number()]),
  token: z.string().min(1),
  templateKey: z.string().min(1),
  location: z.string().optional(),
  values: z.record(z.string(), z.unknown()).optional(),
});

type SwitchTemplateRouteContext = {
  params: Promise<{ draftId: string }>;
};

export async function POST(request: Request, context: SwitchTemplateRouteContext) {
  try {
    const { draftId } = await context.params;
    const input = switchTemplateSchema.parse(await readJson(request));
    const data = await switchBusinessCentralESignEditorTemplate(
      draftId,
      String(input.expires),
      input.token,
      {
        templateKey: input.templateKey,
        location: input.location,
        values: input.values,
      },
    );

    return ok({ message: "Metro E-Sign template changed.", data }, undefined, request);
  } catch (error) {
    return errorResponse(error, request);
  }
}

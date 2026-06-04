import { created, errorResponse, readJson } from "@/lib/server/api";
import {
  createBusinessCentralESignDraft,
  parseBusinessCentralDraftInput,
  requireBusinessCentralESignKey,
} from "@/lib/server/business-central-esign";

export async function POST(request: Request) {
  try {
    requireBusinessCentralESignKey(request);

    const payload = parseBusinessCentralDraftInput(await readJson(request));
    const data = await createBusinessCentralESignDraft(payload);

    return created({ message: "Business Central E-Sign draft created.", data }, request);
  } catch (error) {
    return errorResponse(error, request);
  }
}

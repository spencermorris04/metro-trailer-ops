import { errorResponse, ok } from "@/lib/server/api";
import {
  listBusinessCentralESignTemplates,
  requireBusinessCentralESignKey,
} from "@/lib/server/business-central-esign";

export async function GET(request: Request) {
  try {
    requireBusinessCentralESignKey(request);

    return ok({ data: await listBusinessCentralESignTemplates() }, undefined, request);
  } catch (error) {
    return errorResponse(error, request);
  }
}

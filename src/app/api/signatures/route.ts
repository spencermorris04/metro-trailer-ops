import { signatureRequestSchema } from "@/lib/domain/validators";
import { created, errorResponse, ok, readJson } from "@/lib/server/api";
import { requireApiPermission } from "@/lib/server/authorization";
import {
  createSignatureRequestForContract,
  listSignatureRequests,
} from "@/lib/server/esign";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const contractNumber = searchParams.get("contractNumber") ?? undefined;
  const data = await listSignatureRequests(contractNumber);

  return ok({
    count: data.length,
    data,
  });
}

export async function POST(request: Request) {
  try {
    await requireApiPermission(request, "signatures.manage");
    const payload = await readJson(request);
    const parsed = signatureRequestSchema.parse(payload);
    const data = await createSignatureRequestForContract(parsed);
    return created({ message: "Signature request created.", data });
  } catch (error) {
    return errorResponse(error);
  }
}

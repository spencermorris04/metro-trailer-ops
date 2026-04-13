import { signatureRequestSchema } from "@/lib/domain/validators";
import { created, errorResponse, ok, readJson } from "@/lib/server/api";
import {
  requireApiPermission,
  requireStaffApiPermission,
  resolveContractScope,
} from "@/lib/server/authorization";
import {
  createSignatureRequestForContract,
  listSignatureRequests,
} from "@/lib/server/esign";

export async function GET(request: Request) {
  await requireStaffApiPermission(request, "signatures.view");

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
    const payload = await readJson(request);
    const parsed = signatureRequestSchema.parse(payload);
    const scope = await resolveContractScope(parsed.contractNumber);

    if (!scope) {
      return ok({ error: "Contract not found" }, { status: 404 });
    }

    const actor = await requireApiPermission(request, "signatures.manage", {
      branchId: scope.branchId ?? undefined,
      customerId: scope.customerId ?? undefined,
    });
    const data = await createSignatureRequestForContract(parsed, actor.userId ?? undefined);
    return created({ message: "Signature request created.", data });
  } catch (error) {
    return errorResponse(error);
  }
}

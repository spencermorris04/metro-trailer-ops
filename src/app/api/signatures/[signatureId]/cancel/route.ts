import { signatureCancelSchema } from "@/lib/domain/validators";
import { errorResponse, ok, readJson } from "@/lib/server/api";
import { requireApiPermission, resolveSignatureScope } from "@/lib/server/authorization";
import { cancelSignatureRequest } from "@/lib/server/esign";

type CancelRouteParams = {
  params: Promise<{
    signatureId: string;
  }>;
};

export async function POST(
  request: Request,
  { params }: CancelRouteParams,
) {
  try {
    const { signatureId } = await params;
    const scope = await resolveSignatureScope(signatureId);

    if (!scope) {
      return ok({ error: "Signature request not found" }, { status: 404 });
    }

    const actor = await requireApiPermission(request, "signatures.manage", {
      branchId: scope.branchId ?? undefined,
      customerId: scope.customerId ?? undefined,
    });
    const payload = signatureCancelSchema.parse(await readJson(request));
    const data = await cancelSignatureRequest(
      signatureId,
      payload.reason,
      actor.userId ?? undefined,
    );
    return ok({ message: "Signature request cancelled.", data });
  } catch (error) {
    return errorResponse(error);
  }
}

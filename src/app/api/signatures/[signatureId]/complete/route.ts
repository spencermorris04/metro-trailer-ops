import { errorResponse, ok } from "@/lib/server/api";
import { requireApiPermission, resolveSignatureScope } from "@/lib/server/authorization";
import { adminCompleteSignatureRequest } from "@/lib/server/esign";

type CompleteSignatureRouteParams = {
  params: Promise<{
    signatureId: string;
  }>;
};

export async function POST(
  request: Request,
  { params }: CompleteSignatureRouteParams,
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
    const data = await adminCompleteSignatureRequest(
      signatureId,
      actor.userId ?? undefined,
    );
    return ok({ message: "Signature request force-completed.", data });
  } catch (error) {
    return errorResponse(error);
  }
}

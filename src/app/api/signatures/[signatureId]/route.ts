import { errorResponse, ok } from "@/lib/server/api";
import { requireScopedResourceAccess, resolveSignatureScope } from "@/lib/server/authorization";
import { getSignatureRequest } from "@/lib/server/esign";

type SignatureRouteParams = {
  params: Promise<{
    signatureId: string;
  }>;
};

export async function GET(
  request: Request,
  { params }: SignatureRouteParams,
) {
  try {
    const { signatureId } = await params;
    const scope = await resolveSignatureScope(signatureId);

    if (!scope) {
      return ok({ error: "Signature request not found" }, { status: 404 });
    }

    await requireScopedResourceAccess(request, scope, {
      allowPortal: true,
      portalPermission: "signatures.view",
      staffPermissions: ["signatures.view", "contracts.view", "documents.view"],
    });
    const data = await getSignatureRequest(signatureId);
    return ok({ data });
  } catch (error) {
    return errorResponse(error);
  }
}

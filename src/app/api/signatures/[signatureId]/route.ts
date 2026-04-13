import { errorResponse, ok } from "@/lib/server/api";
import { getSignatureRequest } from "@/lib/server/esign-service";

type SignatureRouteParams = {
  params: Promise<{
    signatureId: string;
  }>;
};

export async function GET(
  _request: Request,
  { params }: SignatureRouteParams,
) {
  try {
    const { signatureId } = await params;
    const data = getSignatureRequest(signatureId);
    return ok({ data });
  } catch (error) {
    return errorResponse(error);
  }
}

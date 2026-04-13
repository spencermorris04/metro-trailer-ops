import { errorResponse, ok } from "@/lib/server/api";
import { adminCompleteSignatureRequest } from "@/lib/server/esign-service";

type CompleteSignatureRouteParams = {
  params: Promise<{
    signatureId: string;
  }>;
};

export async function POST(
  _request: Request,
  { params }: CompleteSignatureRouteParams,
) {
  try {
    const { signatureId } = await params;
    const data = await adminCompleteSignatureRequest(signatureId);
    return ok({ message: "Signature request force-completed.", data });
  } catch (error) {
    return errorResponse(error);
  }
}

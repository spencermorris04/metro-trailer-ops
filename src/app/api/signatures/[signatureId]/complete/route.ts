import { errorResponse, ok } from "@/lib/server/api";
import { completeSignatureRequest } from "@/lib/server/platform-service";

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
    const data = completeSignatureRequest(signatureId);
    return ok({ message: "Signature request completed.", data });
  } catch (error) {
    return errorResponse(error);
  }
}

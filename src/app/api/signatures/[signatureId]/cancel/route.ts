import { signatureCancelSchema } from "@/lib/domain/validators";
import { errorResponse, ok, readJson } from "@/lib/server/api";
import { cancelSignatureRequest } from "@/lib/server/esign-service";

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
    const payload = signatureCancelSchema.parse(await readJson(request));
    const data = cancelSignatureRequest(signatureId, payload.reason);
    return ok({ message: "Signature request cancelled.", data });
  } catch (error) {
    return errorResponse(error);
  }
}

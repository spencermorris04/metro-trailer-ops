import { signatureSignSchema } from "@/lib/domain/validators";
import { errorResponse, ok, readJson } from "@/lib/server/api";
import {
  getRequestMetadata,
  signSignatureRequest,
} from "@/lib/server/esign-service";

type SignRouteParams = {
  params: Promise<{
    signatureId: string;
  }>;
};

export async function POST(
  request: Request,
  { params }: SignRouteParams,
) {
  try {
    const { signatureId } = await params;
    const payload = signatureSignSchema.parse(await readJson(request));
    const data = await signSignatureRequest(
      signatureId,
      payload,
      getRequestMetadata(request),
    );

    return ok({ message: "Signature recorded.", data });
  } catch (error) {
    return errorResponse(error);
  }
}

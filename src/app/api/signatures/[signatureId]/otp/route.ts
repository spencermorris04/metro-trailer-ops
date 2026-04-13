import { signatureOtpRequestSchema } from "@/lib/domain/validators";
import { errorResponse, ok, readJson } from "@/lib/server/api";
import { requestSignatureOtp } from "@/lib/server/esign";

type OtpRouteParams = {
  params: Promise<{
    signatureId: string;
  }>;
};

export async function POST(
  request: Request,
  { params }: OtpRouteParams,
) {
  try {
    const { signatureId } = await params;
    const payload = signatureOtpRequestSchema.parse(await readJson(request));
    const data = await requestSignatureOtp(
      signatureId,
      payload.signerId,
      payload.token,
    );

    return ok({ message: "Verification code sent.", data });
  } catch (error) {
    return errorResponse(error);
  }
}

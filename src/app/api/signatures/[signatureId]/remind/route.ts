import { signatureReminderSchema } from "@/lib/domain/validators";
import { errorResponse, ok, readJson } from "@/lib/server/api";
import { sendSignatureReminder } from "@/lib/server/esign-service";

type ReminderRouteParams = {
  params: Promise<{
    signatureId: string;
  }>;
};

export async function POST(
  request: Request,
  { params }: ReminderRouteParams,
) {
  try {
    const { signatureId } = await params;
    const payload = signatureReminderSchema.parse(await readJson(request));
    const data = sendSignatureReminder(signatureId, payload.signerId);
    return ok({ message: "Signature reminder recorded.", data });
  } catch (error) {
    return errorResponse(error);
  }
}

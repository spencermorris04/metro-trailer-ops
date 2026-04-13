import { signatureReminderSchema } from "@/lib/domain/validators";
import { errorResponse, ok, readJson } from "@/lib/server/api";
import { requireApiPermission, resolveSignatureScope } from "@/lib/server/authorization";
import { sendSignatureReminder } from "@/lib/server/esign";

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
    const scope = await resolveSignatureScope(signatureId);

    if (!scope) {
      return ok({ error: "Signature request not found" }, { status: 404 });
    }

    const actor = await requireApiPermission(request, "signatures.manage", {
      branchId: scope.branchId ?? undefined,
      customerId: scope.customerId ?? undefined,
    });
    const payload = signatureReminderSchema.parse(await readJson(request));
    const data = await sendSignatureReminder(
      signatureId,
      payload.signerId,
      actor.userId ?? undefined,
    );
    return ok({ message: "Signature reminder recorded.", data });
  } catch (error) {
    return errorResponse(error);
  }
}

import { paymentRefundSchema } from "@/lib/domain/validators";
import { errorResponse, ok, readJson } from "@/lib/server/api";
import { requireApiPermission } from "@/lib/server/authorization";
import { refundCustomerPayment } from "@/lib/server/platform";

export async function POST(request: Request) {
  try {
    const actor = await requireApiPermission(request, "accounting.manage");
    const payload = await readJson(request);
    const parsed = paymentRefundSchema.parse(payload);

    const data = await refundCustomerPayment(
      parsed.transactionId,
      parsed.amount,
      actor.userId ?? undefined,
    );

    return ok({
      message: "Refund recorded.",
      data,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

import { paymentIntentSchema } from "@/lib/domain/validators";
import { errorResponse, ok, readJson } from "@/lib/server/api";
import { createPaymentIntentForInvoice } from "@/lib/server/platform-service";

export async function POST(request: Request) {
  try {
    const payload = await readJson(request);
    const parsed = paymentIntentSchema.parse(payload);
    const data = await createPaymentIntentForInvoice(parsed.invoiceId);

    return ok({
      message: "Payment intent created.",
      data,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

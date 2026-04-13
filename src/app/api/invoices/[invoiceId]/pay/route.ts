import { invoicePaymentSchema } from "@/lib/domain/validators";
import { errorResponse, ok, readJson } from "@/lib/server/api";
import { recordInvoicePayment } from "@/lib/server/platform-service";

type PayInvoiceRouteParams = {
  params: Promise<{
    invoiceId: string;
  }>;
};

export async function POST(
  request: Request,
  { params }: PayInvoiceRouteParams,
) {
  try {
    const { invoiceId } = await params;
    const payload = await readJson(request);
    const parsed = invoicePaymentSchema.parse(payload);
    const data = await recordInvoicePayment(invoiceId, parsed.amount);
    return ok({ message: "Payment recorded.", data });
  } catch (error) {
    return errorResponse(error);
  }
}

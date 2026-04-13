import { errorResponse, ok } from "@/lib/server/api";
import { sendInvoice } from "@/lib/server/platform-service";

type SendInvoiceRouteParams = {
  params: Promise<{
    invoiceId: string;
  }>;
};

export async function POST(
  _request: Request,
  { params }: SendInvoiceRouteParams,
) {
  try {
    const { invoiceId } = await params;
    const data = await sendInvoice(invoiceId);
    return ok({ message: "Invoice sent.", data });
  } catch (error) {
    return errorResponse(error);
  }
}

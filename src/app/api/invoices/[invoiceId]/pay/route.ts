import { invoicePaymentSchema } from "@/lib/domain/validators";
import { errorResponse, ok, readJson } from "@/lib/server/api";
import { requireApiPermission, resolveInvoiceScope } from "@/lib/server/authorization";
import { recordInvoicePayment } from "@/lib/server/platform";

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
    const scope = await resolveInvoiceScope(invoiceId);

    if (!scope) {
      return ok({ error: "Invoice not found" }, { status: 404 });
    }

    const actor = await requireApiPermission(request, "accounting.manage", {
      branchId: scope.branchId ?? undefined,
      customerId: scope.customerId ?? undefined,
    });
    const payload = await readJson(request);
    const parsed = invoicePaymentSchema.parse(payload);
    const data = await recordInvoicePayment(
      invoiceId,
      parsed.amount,
      actor.userId ?? undefined,
    );
    return ok({ message: "Payment recorded.", data });
  } catch (error) {
    return errorResponse(error);
  }
}

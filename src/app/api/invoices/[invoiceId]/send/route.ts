import { errorResponse, ok } from "@/lib/server/api";
import { requireApiPermission, resolveInvoiceScope } from "@/lib/server/authorization";
import { sendInvoice } from "@/lib/server/platform";

type SendInvoiceRouteParams = {
  params: Promise<{
    invoiceId: string;
  }>;
};

export async function POST(
  request: Request,
  { params }: SendInvoiceRouteParams,
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
    const data = await sendInvoice(invoiceId, actor.userId ?? undefined);
    return ok({ message: "Invoice sent.", data });
  } catch (error) {
    return errorResponse(error);
  }
}

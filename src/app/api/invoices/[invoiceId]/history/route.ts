import { ok } from "@/lib/server/api";
import { requireStaffApiPermission, resolveInvoiceScope } from "@/lib/server/authorization";
import { getInvoiceHistory } from "@/lib/server/platform";

type InvoiceHistoryRouteParams = {
  params: Promise<{
    invoiceId: string;
  }>;
};

export async function GET(
  request: Request,
  { params }: InvoiceHistoryRouteParams,
) {
  const { invoiceId } = await params;
  const scope = await resolveInvoiceScope(invoiceId);

  if (!scope) {
    return ok({ error: "Invoice not found" }, { status: 404 });
  }

  await requireStaffApiPermission(request, "accounting.view", {
    branchId: scope.branchId ?? undefined,
    customerId: scope.customerId ?? undefined,
  });
  const data = await getInvoiceHistory(invoiceId);

  return ok({
    count: data.length,
    data,
  });
}

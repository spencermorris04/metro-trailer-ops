import { listInvoices } from "@/lib/server/platform";
import { ok } from "@/lib/server/api";
import { requireStaffApiPermission, resolveInvoiceScope } from "@/lib/server/authorization";

type InvoiceRouteParams = {
  params: Promise<{
    invoiceId: string;
  }>;
};

export async function GET(request: Request, { params }: InvoiceRouteParams) {
  const { invoiceId } = await params;
  const scope = await resolveInvoiceScope(invoiceId);

  if (!scope) {
    return ok({ error: "Invoice not found" }, { status: 404 });
  }

  await requireStaffApiPermission(request, "accounting.view", {
    branchId: scope.branchId ?? undefined,
    customerId: scope.customerId ?? undefined,
  });
  const invoice = (await listInvoices()).find(
    (entry) => entry.id === invoiceId || entry.invoiceNumber === invoiceId,
  );

  return invoice
    ? ok({ data: invoice })
    : ok({ error: "Invoice not found" }, { status: 404 });
}

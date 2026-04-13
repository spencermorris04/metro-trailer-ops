import { listInvoices } from "@/lib/server/platform-service";
import { ok } from "@/lib/server/api";

type InvoiceRouteParams = {
  params: Promise<{
    invoiceId: string;
  }>;
};

export async function GET(_request: Request, { params }: InvoiceRouteParams) {
  const { invoiceId } = await params;
  const invoice = listInvoices().find(
    (entry) => entry.id === invoiceId || entry.invoiceNumber === invoiceId,
  );

  return invoice
    ? ok({ data: invoice })
    : ok({ error: "Invoice not found" }, { status: 404 });
}

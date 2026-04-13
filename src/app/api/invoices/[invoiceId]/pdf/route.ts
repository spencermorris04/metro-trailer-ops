import { errorResponse } from "@/lib/server/api";
import { listFinancialEvents, listInvoices } from "@/lib/server/platform-service";
import { renderInvoicePdf } from "@/lib/server/pdf";

type InvoicePdfRouteParams = {
  params: Promise<{
    invoiceId: string;
  }>;
};

export async function GET(_request: Request, { params }: InvoicePdfRouteParams) {
  try {
    const { invoiceId } = await params;
    const invoice = listInvoices().find(
      (entry) => entry.id === invoiceId || entry.invoiceNumber === invoiceId,
    );

    if (!invoice) {
      return Response.json({ error: "Invoice not found" }, { status: 404 });
    }

    const events = listFinancialEvents({
      contractNumber: invoice.contractNumber,
    });

    const pdf = await renderInvoicePdf({
      invoice,
      customerName: invoice.customerName,
      lineItems: events.map((event) => ({
        description: event.description,
        amount: event.amount,
      })),
    });

    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${invoice.invoiceNumber}.pdf"`,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

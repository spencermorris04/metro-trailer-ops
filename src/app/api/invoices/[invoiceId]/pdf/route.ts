import { errorResponse } from "@/lib/server/api";
import { getInvoicePdfArtifact } from "@/lib/server/invoice-artifacts";
import { listFinancialEvents, listInvoices } from "@/lib/server/platform-service";

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

    const artifact = await getInvoicePdfArtifact({
      invoice,
      lineItems: events.map((event) => ({
        description: event.description,
        amount: event.amount,
      })),
    });

    return new Response(new Uint8Array(artifact.body), {
      headers: {
        "Content-Type": artifact.contentType,
        "Content-Disposition": `inline; filename="${artifact.filename}"`,
        "X-Document-Hash": artifact.hash,
        "X-Storage-Provider": artifact.storageProvider,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

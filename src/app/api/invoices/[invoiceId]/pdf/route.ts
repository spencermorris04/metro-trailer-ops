import { errorResponse } from "@/lib/server/api";
import { getInvoicePdfArtifact } from "@/lib/server/invoice-artifacts";
import { listFinancialEvents, listInvoices } from "@/lib/server/platform";
import { requireScopedResourceAccess, resolveInvoiceScope } from "@/lib/server/authorization";

type InvoicePdfRouteParams = {
  params: Promise<{
    invoiceId: string;
  }>;
};

export async function GET(request: Request, { params }: InvoicePdfRouteParams) {
  try {
    const { invoiceId } = await params;
    const scope = await resolveInvoiceScope(invoiceId);

    if (!scope) {
      return Response.json({ error: "Invoice not found" }, { status: 404 });
    }

    await requireScopedResourceAccess(request, scope, {
      allowPortal: true,
      portalPermission: "documents.view",
      staffPermissions: ["accounting.view", "documents.view"],
    });
    const invoice = (await listInvoices()).find(
      (entry) => entry.id === invoiceId || entry.invoiceNumber === invoiceId,
    );

    if (!invoice) {
      return Response.json({ error: "Invoice not found" }, { status: 404 });
    }

    const events = await listFinancialEvents({
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

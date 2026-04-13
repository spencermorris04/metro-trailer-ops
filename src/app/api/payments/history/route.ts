import { paymentHistoryQuerySchema } from "@/lib/domain/validators";
import { errorResponse, ok } from "@/lib/server/api";
import {
  requireAuthenticatedApiActor,
  requireScopedResourceAccess,
  resolveCustomerScope,
  resolveInvoiceScope,
} from "@/lib/server/authorization";
import { getPortalCustomerNumberFromHeaders } from "@/lib/server/portal-service";
import { listCustomerPaymentHistory } from "@/lib/server/platform";

export async function GET(request: Request) {
  try {
    const actor = await requireAuthenticatedApiActor(request);
    const { searchParams } = new URL(request.url);
    let customerNumber = searchParams.get("customerNumber") ?? undefined;
    const invoiceId = searchParams.get("invoiceId") ?? undefined;

    if (actor.kind === "portal" && !customerNumber) {
      customerNumber = await getPortalCustomerNumberFromHeaders(
        new Headers(request.headers),
      );
    }

    const parsed = paymentHistoryQuerySchema.parse({
      customerNumber,
      invoiceId,
    });

    const scope =
      (parsed.invoiceId ? await resolveInvoiceScope(parsed.invoiceId) : null) ??
      (parsed.customerNumber ? await resolveCustomerScope(parsed.customerNumber) : null);

    if (scope) {
      await requireScopedResourceAccess(request, scope, {
        allowPortal: true,
        portalPermission: "accounting.view",
        staffPermissions: ["accounting.view"],
      });
    } else if (actor.kind !== "portal") {
      await requireScopedResourceAccess(
        request,
        { branchId: null, customerId: null },
        {
          allowPortal: false,
          staffPermissions: ["accounting.view"],
        },
      );
    }

    const data = await listCustomerPaymentHistory(parsed);

    return ok({
      count: data.length,
      data,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

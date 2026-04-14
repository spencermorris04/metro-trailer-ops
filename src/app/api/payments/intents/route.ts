import { paymentIntentSchema } from "@/lib/domain/validators";
import { errorResponse, ok, readJson } from "@/lib/server/api";
import { requireScopedResourceAccess, resolveInvoiceScope } from "@/lib/server/authorization";
import {
  getPortalContextFromHeaders,
  logPortalPaymentAttempt,
} from "@/lib/server/portal-service";
import { createPaymentIntentForInvoice } from "@/lib/server/platform";

export async function POST(request: Request) {
  try {
    const payload = await readJson(request);
    const parsed = paymentIntentSchema.parse(payload);
    const scope = await resolveInvoiceScope(parsed.invoiceId);

    if (!scope) {
      return ok({ error: "Invoice not found" }, { status: 404 });
    }

    await requireScopedResourceAccess(request, scope, {
      allowPortal: true,
      portalPermission: "portal.pay",
      staffPermissions: ["accounting.manage"],
    });
    const data = await createPaymentIntentForInvoice(
      parsed.invoiceId,
      parsed.paymentMethodId,
    );
    const portalContext = await getPortalContextFromHeaders(request.headers);
    if (portalContext && scope.customerId === portalContext.customerId) {
      await logPortalPaymentAttempt(portalContext.customerId, parsed.invoiceId, "attempted", {
        paymentMethodId: parsed.paymentMethodId ?? null,
      });
    }

    return ok({
      message: "Payment intent created.",
      data,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

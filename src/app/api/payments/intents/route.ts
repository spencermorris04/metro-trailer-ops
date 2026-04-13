import { paymentIntentSchema } from "@/lib/domain/validators";
import { errorResponse, ok, readJson } from "@/lib/server/api";
import { requireScopedResourceAccess, resolveInvoiceScope } from "@/lib/server/authorization";
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

    return ok({
      message: "Payment intent created.",
      data,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

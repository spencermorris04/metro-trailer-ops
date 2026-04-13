import { paymentSetupIntentSchema } from "@/lib/domain/validators";
import { errorResponse, ok, readJson } from "@/lib/server/api";
import {
  requireAuthenticatedApiActor,
  requireScopedResourceAccess,
  resolveCustomerScope,
} from "@/lib/server/authorization";
import { getPortalCustomerNumberFromHeaders } from "@/lib/server/portal-service";
import { createPaymentSetupIntent } from "@/lib/server/platform";

export async function POST(request: Request) {
  try {
    const actor = await requireAuthenticatedApiActor(request);
    const payload = (await readJson<{
      customerNumber?: string;
    }>(request).catch(() => undefined)) ?? {};
    const parsed = paymentSetupIntentSchema.parse({
      customerNumber:
        payload?.customerNumber ??
        (actor.kind === "portal"
          ? await getPortalCustomerNumberFromHeaders(new Headers(request.headers))
          : undefined),
    });
    const scope = await resolveCustomerScope(parsed.customerNumber);

    if (!scope) {
      return ok({ error: "Customer not found" }, { status: 404 });
    }

    await requireScopedResourceAccess(request, scope, {
      allowPortal: true,
      portalPermission: "payment_methods.manage",
      staffPermissions: ["payment_methods.manage", "accounting.manage"],
    });
    const data = await createPaymentSetupIntent(parsed.customerNumber);

    return ok({
      message: "Stripe setup intent created.",
      data,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

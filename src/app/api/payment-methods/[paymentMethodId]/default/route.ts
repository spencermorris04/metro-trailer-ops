import { errorResponse, ok } from "@/lib/server/api";
import {
  requireScopedResourceAccess,
  resolvePaymentMethodScope,
} from "@/lib/server/authorization";
import { setDefaultPaymentMethod } from "@/lib/server/platform";

type PaymentMethodDefaultRouteParams = {
  params: Promise<{
    paymentMethodId: string;
  }>;
};

export async function POST(
  request: Request,
  { params }: PaymentMethodDefaultRouteParams,
) {
  try {
    const { paymentMethodId } = await params;
    const scope = await resolvePaymentMethodScope(paymentMethodId);

    if (!scope) {
      return ok({ error: "Payment method not found" }, { status: 404 });
    }

    const actor = await requireScopedResourceAccess(request, scope, {
      allowPortal: true,
      portalPermission: "payment_methods.manage",
      staffPermissions: ["payment_methods.manage", "accounting.manage"],
    });
    const data = await setDefaultPaymentMethod(
      paymentMethodId,
      actor.userId ?? undefined,
    );

    return ok({
      message: "Default payment method updated.",
      data,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

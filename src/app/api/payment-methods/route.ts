import { paymentMethodSchema } from "@/lib/domain/validators";
import { created, errorResponse, ok, readJson } from "@/lib/server/api";
import {
  requireScopedResourceAccess,
  requireStaffApiPermission,
  resolveCustomerScope,
} from "@/lib/server/authorization";
import { addPaymentMethod, listPaymentMethods } from "@/lib/server/platform";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const customerNumber = searchParams.get("customerNumber") ?? undefined;
    if (customerNumber) {
      const scope = await resolveCustomerScope(customerNumber);

      if (!scope) {
        return ok({ error: "Customer not found" }, { status: 404 });
      }

      await requireScopedResourceAccess(request, scope, {
        allowPortal: true,
        portalPermission: "payment_methods.manage",
        staffPermissions: ["payment_methods.manage", "accounting.view"],
      });
    } else {
      await requireStaffApiPermission(request, "accounting.view");
    }
    const data = await listPaymentMethods(customerNumber);

    return ok({
      count: data.length,
      data,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const payload = await readJson(request);
    const parsed = paymentMethodSchema.parse(payload);
    const scope = await resolveCustomerScope(parsed.customerNumber);

    if (!scope) {
      return ok({ error: "Customer not found" }, { status: 404 });
    }

    const actor = await requireScopedResourceAccess(request, scope, {
      allowPortal: true,
      portalPermission: "payment_methods.manage",
      staffPermissions: ["payment_methods.manage", "accounting.manage"],
    });
    const data = await addPaymentMethod(parsed, actor.userId ?? undefined);

    return created({
      message: "Payment method created.",
      data,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

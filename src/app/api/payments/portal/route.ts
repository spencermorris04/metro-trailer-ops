import { errorResponse, ok } from "@/lib/server/api";
import {
  requireAuthenticatedApiActor,
  requireScopedResourceAccess,
  resolveCustomerScope,
} from "@/lib/server/authorization";
import { getPortalCustomerNumberFromHeaders } from "@/lib/server/portal-service";
import { getPortalOverview } from "@/lib/server/platform";

export async function GET(request: Request) {
  try {
    const actor = await requireAuthenticatedApiActor(request);
    const { searchParams } = new URL(request.url);
    const customerNumber =
      searchParams.get("customerNumber") ??
      (actor.kind === "portal"
        ? await getPortalCustomerNumberFromHeaders(new Headers(request.headers))
        : null);

    if (!customerNumber) {
      return ok(
        {
          error: "customerNumber is required.",
        },
        { status: 400 },
      );
    }

    const scope = await resolveCustomerScope(customerNumber);
    if (!scope) {
      return ok({ error: "Customer not found" }, { status: 404 });
    }

    await requireScopedResourceAccess(request, scope, {
      allowPortal: true,
      portalPermission: "portal.view",
      staffPermissions: ["accounting.view", "payment_methods.manage"],
    });
    const data = await getPortalOverview(customerNumber);

    return ok({
      data: data.portalSession,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

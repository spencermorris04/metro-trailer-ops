import { errorResponse, ok } from "@/lib/server/api";
import {
  getActorFromHeaders,
  requireScopedResourceAccess,
  resolveCustomerScope,
} from "@/lib/server/authorization";
import {
  getCurrentPortalOverview,
  getPortalOverviewForCustomer,
} from "@/lib/server/portal-service";

type PortalRouteParams = {
  params: Promise<{
    customerNumber: string;
  }>;
};

export async function GET(request: Request, { params }: PortalRouteParams) {
  try {
    const { customerNumber } = await params;
    const scope = await resolveCustomerScope(customerNumber);

    if (!scope) {
      return ok({ error: "Customer not found" }, { status: 404 });
    }

    await requireScopedResourceAccess(request, scope, {
      allowPortal: true,
      portalPermission: "portal.view",
      staffPermissions: ["customers.view", "contracts.view", "accounting.view"],
    });
    const actor = await getActorFromHeaders(new Headers(request.headers));
    const data =
      actor?.kind === "portal"
        ? await getCurrentPortalOverview(new Headers(request.headers))
        : await getPortalOverviewForCustomer(customerNumber);
    return ok({ data });
  } catch (error) {
    return errorResponse(error);
  }
}

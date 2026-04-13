import { errorResponse, ok } from "@/lib/server/api";
import { getPortalOverview } from "@/lib/server/platform-service";

type PortalRouteParams = {
  params: Promise<{
    customerNumber: string;
  }>;
};

export async function GET(_request: Request, { params }: PortalRouteParams) {
  try {
    const { customerNumber } = await params;
    const data = await getPortalOverview(customerNumber);
    return ok({ data });
  } catch (error) {
    return errorResponse(error);
  }
}

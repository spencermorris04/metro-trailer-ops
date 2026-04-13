import { errorResponse, ok } from "@/lib/server/api";
import { getCurrentPortalOverview } from "@/lib/server/portal-service";

export async function GET(request: Request) {
  try {
    const data = await getCurrentPortalOverview(new Headers(request.headers));

    return ok({ data });
  } catch (error) {
    return errorResponse(error);
  }
}

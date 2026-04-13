import { errorResponse, ok } from "@/lib/server/api";
import { completeWorkOrder } from "@/lib/server/platform-service";

type CompleteWorkOrderRouteParams = {
  params: Promise<{
    workOrderId: string;
  }>;
};

export async function POST(
  _request: Request,
  { params }: CompleteWorkOrderRouteParams,
) {
  try {
    const { workOrderId } = await params;
    const data = completeWorkOrder(workOrderId);
    return ok({ message: "Work order completed.", data });
  } catch (error) {
    return errorResponse(error);
  }
}

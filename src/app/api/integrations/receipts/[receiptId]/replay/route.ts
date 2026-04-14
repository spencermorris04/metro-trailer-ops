import { errorResponse, ok } from "@/lib/server/api";
import { requireStaffApiPermission } from "@/lib/server/authorization";
import { replayIntegrationReceipt } from "@/lib/server/platform";

type ReplayIntegrationReceiptRouteParams = {
  params: Promise<{
    receiptId: string;
  }>;
};

export async function POST(
  request: Request,
  { params }: ReplayIntegrationReceiptRouteParams,
) {
  try {
    await requireStaffApiPermission(request, "integrations.manage");
    const { receiptId } = await params;
    const data = await replayIntegrationReceipt(receiptId);

    return ok({
      message: "Webhook receipt replay queued.",
      data,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

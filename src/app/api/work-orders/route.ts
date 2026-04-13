import { workOrderSchema } from "@/lib/domain/validators";
import { created, errorResponse, ok, readJson } from "@/lib/server/api";
import { createWorkOrder, listWorkOrders } from "@/lib/server/platform-service";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const data = listWorkOrders({
    status: searchParams.get("status") ?? undefined,
    branch: searchParams.get("branch") ?? undefined,
    assetNumber: searchParams.get("assetNumber") ?? undefined,
  });

  return ok({
    count: data.length,
    data,
  });
}

export async function POST(request: Request) {
  try {
    const payload = await readJson(request);
    const parsed = workOrderSchema.parse(payload);
    const data = createWorkOrder(parsed);
    return created({ message: "Work order created.", data });
  } catch (error) {
    return errorResponse(error);
  }
}

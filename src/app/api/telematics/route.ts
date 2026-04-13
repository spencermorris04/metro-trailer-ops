import { ok } from "@/lib/server/api";
import { requireStaffApiPermission } from "@/lib/server/authorization";
import { listTelematics } from "@/lib/server/platform";

export async function GET(request: Request) {
  await requireStaffApiPermission(request, "dispatch.view");

  const { searchParams } = new URL(request.url);
  const assetNumber = searchParams.get("assetNumber") ?? undefined;
  const data = await listTelematics(assetNumber);

  return ok({
    count: data.length,
    data,
  });
}

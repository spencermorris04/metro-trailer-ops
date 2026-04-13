import { ok } from "@/lib/server/api";
import { listTelematics } from "@/lib/server/platform-service";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const assetNumber = searchParams.get("assetNumber") ?? undefined;
  const data = listTelematics(assetNumber);

  return ok({
    count: data.length,
    data,
  });
}

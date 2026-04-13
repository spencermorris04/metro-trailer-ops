import { assetSchema } from "@/lib/domain/validators";
import { created, errorResponse, ok, readJson } from "@/lib/server/api";
import { requireApiPermission, requireStaffApiPermission } from "@/lib/server/authorization";
import { createAsset, listAssets } from "@/lib/server/platform";

export async function GET(request: Request) {
  await requireStaffApiPermission(request, "assets.view");

  const { searchParams } = new URL(request.url);
  const data = await listAssets({
    q: searchParams.get("q") ?? undefined,
    branch: searchParams.get("branch") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    availability: searchParams.get("availability") ?? undefined,
  });

  return ok({
    count: data.length,
    data,
  });
}

export async function POST(request: Request) {
  try {
    const actor = await requireApiPermission(request, "assets.manage");
    const payload = await readJson(request);
    const parsed = assetSchema.parse(payload);
    const data = await createAsset(parsed, actor.userId ?? undefined);

    return created({
      message: "Asset created.",
      data,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

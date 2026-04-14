import { assetSchema } from "@/lib/domain/validators";
import { created, errorResponse, ok, readJson } from "@/lib/server/api";
import { requireApiPermission, requireStaffApiPermission } from "@/lib/server/authorization";
import { createAsset, listAssetsPage } from "@/lib/server/platform";

export async function GET(request: Request) {
  await requireStaffApiPermission(request, "assets.view");

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") ?? "25")));
  const result = await listAssetsPage({
    q: searchParams.get("q") ?? undefined,
    branch: searchParams.get("branch") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    availability: searchParams.get("availability") ?? undefined,
    maintenanceStatus: searchParams.get("maintenanceStatus") ?? undefined,
    type: searchParams.get("type") ?? undefined,
    page,
    pageSize,
  });

  return ok({
    count: result.total,
    page: result.page,
    pageSize: result.pageSize,
    filters: {
      q: searchParams.get("q"),
      branch: searchParams.get("branch"),
      status: searchParams.get("status"),
      availability: searchParams.get("availability"),
      maintenanceStatus: searchParams.get("maintenanceStatus"),
      type: searchParams.get("type"),
    },
    data: result.data,
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

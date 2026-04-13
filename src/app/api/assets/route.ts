import { assetSchema } from "@/lib/domain/validators";
import { created, errorResponse, ok, readJson } from "@/lib/server/api";
import { createAsset, listAssets } from "@/lib/server/platform-service";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const data = listAssets({
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
    const payload = await readJson(request);
    const parsed = assetSchema.parse(payload);
    const data = createAsset(parsed);

    return created({
      message: "Asset created.",
      data,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

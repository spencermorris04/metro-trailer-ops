import { ok } from "@/lib/server/api";
import { listIntegrationJobs } from "@/lib/server/platform-service";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const data = listIntegrationJobs({
    provider: searchParams.get("provider") ?? undefined,
    status: searchParams.get("status") ?? undefined,
  });

  return ok({
    count: data.length,
    data,
  });
}

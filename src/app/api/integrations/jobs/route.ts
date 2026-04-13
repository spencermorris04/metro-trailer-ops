import { ok } from "@/lib/server/api";
import { requireStaffApiPermission } from "@/lib/server/authorization";
import { listIntegrationJobs } from "@/lib/server/platform";

export async function GET(request: Request) {
  await requireStaffApiPermission(request, "integrations.manage");

  const { searchParams } = new URL(request.url);
  const data = await listIntegrationJobs({
    provider: searchParams.get("provider") ?? undefined,
    status: searchParams.get("status") ?? undefined,
  });

  return ok({
    count: data.length,
    data,
  });
}

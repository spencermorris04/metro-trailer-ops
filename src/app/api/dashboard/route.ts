import { ok } from "@/lib/server/api";
import { requireStaffApiPermission } from "@/lib/server/authorization";
import { getDashboardSummary, listBranches, listUsers } from "@/lib/server/platform";

export async function GET(request: Request) {
  await requireStaffApiPermission(request, "reports.view");

  return ok({
    summary: await getDashboardSummary(),
    branches: await listBranches(),
    users: await listUsers(),
  });
}

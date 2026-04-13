import { ok } from "@/lib/server/api";
import { getDashboardSummary, listBranches, listUsers } from "@/lib/server/platform";

export async function GET() {
  return ok({
    summary: await getDashboardSummary(),
    branches: await listBranches(),
    users: await listUsers(),
  });
}

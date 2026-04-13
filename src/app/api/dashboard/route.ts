import { ok } from "@/lib/server/api";
import { getDashboardSummary, listBranches, listUsers } from "@/lib/server/platform-service";

export async function GET() {
  return ok({
    summary: getDashboardSummary(),
    branches: listBranches(),
    users: listUsers(),
  });
}

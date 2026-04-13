import { ok } from "@/lib/server/api";
import { requireApiPermission } from "@/lib/server/authorization";
import { getQuickBooksStatus } from "@/lib/server/quickbooks-service";

export async function GET(request: Request) {
  await requireApiPermission(request, "integrations.manage");

  return ok(await getQuickBooksStatus());
}

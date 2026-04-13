import { errorResponse, ok } from "@/lib/server/api";
import { requireApiPermission } from "@/lib/server/authorization";
import {
  enqueueQuickBooksReconciliation,
  runQuickBooksReconciliation,
} from "@/lib/server/quickbooks-service";

export async function GET(request: Request) {
  try {
    await requireApiPermission(request, "accounting.view");
    const { searchParams } = new URL(request.url);
    const limitParam = Number(searchParams.get("limit") ?? "25");
    const limit = Number.isFinite(limitParam) ? limitParam : 25;

    return ok(await runQuickBooksReconciliation(limit));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireApiPermission(request, "integrations.manage");
    const body = (await request.json().catch(() => ({}))) as {
      limit?: number;
    };

    return ok({
      outboxJobId: await enqueueQuickBooksReconciliation(
        typeof body.limit === "number" ? body.limit : 25,
      ),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

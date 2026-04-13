import { created, errorResponse } from "@/lib/server/api";
import { requireApiPermission } from "@/lib/server/authorization";
import { beginQuickBooksOAuth } from "@/lib/server/quickbooks-service";

export async function POST(request: Request) {
  try {
    const actor = await requireApiPermission(request, "integrations.manage");
    const body = (await request.json().catch(() => ({}))) as {
      redirectPath?: string;
    };

    return created(
      await beginQuickBooksOAuth({
        userId: actor.userId,
        redirectPath: body.redirectPath ?? "/integrations",
      }),
    );
  } catch (error) {
    return errorResponse(error);
  }
}

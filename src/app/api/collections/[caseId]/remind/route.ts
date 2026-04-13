import { errorResponse, ok } from "@/lib/server/api";
import { requireApiPermission, resolveCollectionCaseScope } from "@/lib/server/authorization";
import { sendCollectionsReminder } from "@/lib/server/platform";

type ReminderRouteParams = {
  params: Promise<{
    caseId: string;
  }>;
};

export async function POST(request: Request, { params }: ReminderRouteParams) {
  try {
    const { caseId } = await params;
    const scope = await resolveCollectionCaseScope(caseId);

    if (!scope) {
      return ok({ error: "Collection case not found" }, { status: 404 });
    }

    const actor = await requireApiPermission(request, "collections.manage", {
      branchId: scope.branchId ?? undefined,
      customerId: scope.customerId ?? undefined,
    });
    const data = await sendCollectionsReminder(caseId, actor.userId ?? undefined);
    return ok({ message: "Collections reminder sent.", data });
  } catch (error) {
    return errorResponse(error);
  }
}

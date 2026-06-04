import { errorResponse, ok } from "@/lib/server/api";
import { requireStaffApiPermission } from "@/lib/server/authorization";
import { invalidateDocusealDraft } from "@/lib/server/docuseal-prefill";

type InvalidateDraftRouteContext = {
  params: Promise<{ draftId: string }>;
};

export async function POST(request: Request, context: InvalidateDraftRouteContext) {
  try {
    await requireStaffApiPermission(request, "documents.manage");

    const { draftId } = await context.params;
    const data = await invalidateDocusealDraft(draftId);

    return ok(
      {
        message:
          "Draft reopened for editing. If this older send did not store a DocuSeal id, verify the old submission in DocuSeal manually.",
        data,
      },
      undefined,
      request,
    );
  } catch (error) {
    return errorResponse(error, request);
  }
}

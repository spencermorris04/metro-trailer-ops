import { errorResponse, ok } from "@/lib/server/api";
import { getBusinessCentralESignEditorDraft } from "@/lib/server/business-central-esign";
import { listCustomers } from "@/lib/server/platform";

type EditorCustomerSearchRouteContext = {
  params: Promise<{ draftId: string }>;
};

export async function GET(request: Request, context: EditorCustomerSearchRouteContext) {
  try {
    const { draftId } = await context.params;
    const { searchParams } = new URL(request.url);
    await getBusinessCentralESignEditorDraft(
      draftId,
      searchParams.get("expires") ?? undefined,
      searchParams.get("token") ?? undefined,
    );

    const pageSize = Math.min(12, Math.max(1, Number(searchParams.get("pageSize") ?? "8")));
    const customers = await listCustomers({
      q: searchParams.get("q") ?? undefined,
    });

    return ok(
      {
        data: customers.slice(0, pageSize),
        count: customers.length,
      },
      undefined,
      request,
    );
  } catch (error) {
    return errorResponse(error, request);
  }
}

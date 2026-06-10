import { errorResponse, ok } from "@/lib/server/api";
import { getBusinessCentralESignEditorDraft } from "@/lib/server/business-central-esign";
import { getEquipmentListView } from "@/lib/server/platform";

type EditorEquipmentSearchRouteContext = {
  params: Promise<{ draftId: string }>;
};

export async function GET(request: Request, context: EditorEquipmentSearchRouteContext) {
  try {
    const { draftId } = await context.params;
    const { searchParams } = new URL(request.url);
    await getBusinessCentralESignEditorDraft(
      draftId,
      searchParams.get("expires") ?? undefined,
      searchParams.get("token") ?? undefined,
    );

    const pageSize = Math.min(12, Math.max(1, Number(searchParams.get("pageSize") ?? "8")));
    const rentableOnly = searchParams.get("rentableOnly") !== "false";
    const data = await getEquipmentListView({
      q: searchParams.get("q") ?? undefined,
      page: 1,
      pageSize,
      status: rentableOnly ? "available" : searchParams.get("status") ?? undefined,
      availability: rentableOnly ? "rentable" : searchParams.get("availability") ?? undefined,
      onRent: rentableOnly ? "false" : searchParams.get("onRent") ?? undefined,
      underMaintenance: rentableOnly ? "false" : searchParams.get("underMaintenance") ?? undefined,
      disposed: rentableOnly ? "false" : searchParams.get("disposed") ?? undefined,
      inactive: rentableOnly ? "false" : searchParams.get("inactive") ?? undefined,
      blocked: rentableOnly ? "false" : searchParams.get("blocked") ?? undefined,
    });

    return ok(
      {
        data: data.data,
        count: data.total,
      },
      undefined,
      request,
    );
  } catch (error) {
    return errorResponse(error, request);
  }
}

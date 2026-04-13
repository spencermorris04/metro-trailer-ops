import { errorResponse, ok } from "@/lib/server/api";
import { requireApiPermission, resolveDocumentScope } from "@/lib/server/authorization";
import { markDocumentArchived } from "@/lib/server/esign";

type ArchiveDocumentRouteParams = {
  params: Promise<{
    documentId: string;
  }>;
};

export async function POST(
  request: Request,
  { params }: ArchiveDocumentRouteParams,
) {
  try {
    const { documentId } = await params;
    const scope = await resolveDocumentScope(documentId);

    if (!scope) {
      return ok({ error: "Document not found" }, { status: 404 });
    }

    const actor = await requireApiPermission(request, "documents.manage", {
      branchId: scope.branchId ?? undefined,
      customerId: scope.customerId ?? undefined,
    });
    const data = await markDocumentArchived(documentId, actor.userId ?? undefined);
    return ok({ message: "Document archived.", data });
  } catch (error) {
    return errorResponse(error);
  }
}

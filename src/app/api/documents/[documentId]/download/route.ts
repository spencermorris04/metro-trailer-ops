import { errorResponse } from "@/lib/server/api";
import { requireScopedResourceAccess, resolveDocumentScope } from "@/lib/server/authorization";
import { getDocumentDownload } from "@/lib/server/esign";

type DownloadDocumentRouteParams = {
  params: Promise<{
    documentId: string;
  }>;
};

export async function GET(
  request: Request,
  { params }: DownloadDocumentRouteParams,
) {
  try {
    const { documentId } = await params;
    const scope = await resolveDocumentScope(documentId);

    if (!scope) {
      return Response.json({ error: "Document not found" }, { status: 404 });
    }

    await requireScopedResourceAccess(request, scope, {
      allowPortal: true,
      portalPermission: "documents.view",
      staffPermissions: ["documents.view", "contracts.view", "accounting.view"],
    });
    const { document, body } = await getDocumentDownload(documentId);

    return new Response(new Uint8Array(body), {
      status: 200,
      headers: {
        "Content-Type": document.contentType,
        "Content-Disposition": `attachment; filename="${document.filename}"`,
        "X-Document-Hash": document.hash,
        "X-Storage-Provider": document.storageProvider,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

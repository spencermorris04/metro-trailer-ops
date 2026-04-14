import { errorResponse } from "@/lib/server/api";
import { requireScopedResourceAccess, resolveDocumentScope } from "@/lib/server/authorization";
import { getDocumentDownload } from "@/lib/server/esign";
import {
  getPortalContextFromHeaders,
  logPortalDocumentDownload,
} from "@/lib/server/portal-service";

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
    const portalContext = await getPortalContextFromHeaders(request.headers);
    if (portalContext && portalContext.customerId === scope.customerId) {
      await logPortalDocumentDownload(portalContext.customerId, documentId);
    }
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

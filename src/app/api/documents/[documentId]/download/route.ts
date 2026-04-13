import { errorResponse } from "@/lib/server/api";
import { getDocumentDownload } from "@/lib/server/esign-service";

type DownloadDocumentRouteParams = {
  params: Promise<{
    documentId: string;
  }>;
};

export async function GET(
  _request: Request,
  { params }: DownloadDocumentRouteParams,
) {
  try {
    const { documentId } = await params;
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

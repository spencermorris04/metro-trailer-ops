import { errorResponse, ok } from "@/lib/server/api";
import { markDocumentArchived } from "@/lib/server/esign-service";

type ArchiveDocumentRouteParams = {
  params: Promise<{
    documentId: string;
  }>;
};

export async function POST(
  _request: Request,
  { params }: ArchiveDocumentRouteParams,
) {
  try {
    const { documentId } = await params;
    const data = markDocumentArchived(documentId);
    return ok({ message: "Document archived.", data });
  } catch (error) {
    return errorResponse(error);
  }
}

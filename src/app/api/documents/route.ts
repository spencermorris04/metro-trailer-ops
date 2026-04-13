import { documentSchema } from "@/lib/domain/validators";
import { created, errorResponse, ok, readJson } from "@/lib/server/api";
import { requireApiPermission } from "@/lib/server/authorization";
import { createDocument, listDocuments } from "@/lib/server/esign";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const contractNumber = searchParams.get("contractNumber") ?? undefined;
  const data = await listDocuments(contractNumber);

  return ok({
    count: data.length,
    data,
  });
}

export async function POST(request: Request) {
  try {
    await requireApiPermission(request, "documents.manage");
    const payload = await readJson(request);
    const parsed = documentSchema.parse(payload);
    const data = await createDocument(parsed);
    return created({ message: "Document created.", data });
  } catch (error) {
    return errorResponse(error);
  }
}

import { errorResponse, ok } from "@/lib/server/api";
import { requireApiPermission } from "@/lib/server/authorization";
import {
  getBillingPreview,
  validateBillingPreviewDocuments,
  validateBillingPreviewSample,
} from "@/lib/server/billing-preview";

function readLimit(searchParams: URLSearchParams, fallback: number) {
  const value = Number(searchParams.get("limit") ?? "");
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function readDocumentNos(searchParams: URLSearchParams) {
  const repeated = searchParams.getAll("documentNo");
  const commaSeparated = searchParams
    .getAll("documents")
    .flatMap((entry) => entry.split(","));
  return [...repeated, ...commaSeparated]
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export async function GET(request: Request) {
  try {
    await requireApiPermission(request, "accounting.view");

    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("mode") ?? "preview";

    if (mode === "validate") {
      const documentNos = readDocumentNos(searchParams);
      const data =
        documentNos.length > 0
          ? await validateBillingPreviewDocuments(documentNos)
          : await validateBillingPreviewSample(readLimit(searchParams, 25));
      return ok({ data }, undefined, request);
    }

    const data = await getBillingPreview({
      documentNo: searchParams.get("documentNo") ?? undefined,
      orderNo: searchParams.get("orderNo") ?? undefined,
      assetNumber: searchParams.get("assetNumber") ?? undefined,
      limit: readLimit(searchParams, 100),
    });

    return ok({ data }, undefined, request);
  } catch (error) {
    return errorResponse(error, request);
  }
}

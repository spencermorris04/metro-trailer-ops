import { documentSchema } from "@/lib/domain/validators";
import { created, errorResponse, ok, readJson } from "@/lib/server/api";
import {
  requireApiPermission,
  requireStaffApiPermission,
  resolveContractScope,
  resolveWorkOrderScope,
} from "@/lib/server/authorization";
import { createDocument, listDocuments } from "@/lib/server/esign";

export async function GET(request: Request) {
  await requireStaffApiPermission(request, "documents.view");

  const { searchParams } = new URL(request.url);
  const contractNumber = searchParams.get("contractNumber") ?? undefined;
  const workOrderId = searchParams.get("workOrderId") ?? undefined;
  const data = await listDocuments(contractNumber, workOrderId);

  return ok({
    count: data.length,
    data,
  });
}

export async function POST(request: Request) {
  try {
    const payload = await readJson<Record<string, unknown>>(request);
    const parsed = documentSchema.parse(payload);
    const scope = parsed.contractNumber
      ? await resolveContractScope(parsed.contractNumber)
      : parsed.workOrderId
        ? await resolveWorkOrderScope(parsed.workOrderId)
        : null;

    if (!scope) {
      return ok({ error: "Related entity not found" }, { status: 404 });
    }

    const actor = await requireApiPermission(request, "documents.manage", {
      branchId: scope.branchId ?? undefined,
      customerId: scope.customerId ?? undefined,
    });
    const data = await createDocument(parsed, actor.userId ?? undefined);
    return created({ message: "Document created.", data });
  } catch (error) {
    return errorResponse(error);
  }
}

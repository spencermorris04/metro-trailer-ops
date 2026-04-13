import {
  inspectionCompletionSchema,
  inspectionRequestSchema,
} from "@/lib/domain/validators";
import { created, errorResponse, ok, readJson } from "@/lib/server/api";
import {
  completeInspection,
  createInspection,
  listInspections,
} from "@/lib/server/platform";
import {
  requireApiPermission,
  requireStaffApiPermission,
  resolveContractScope,
  resolveInspectionScope,
} from "@/lib/server/authorization";

export async function GET(request: Request) {
  await requireStaffApiPermission(request, "inspections.view");

  const { searchParams } = new URL(request.url);
  const data = await listInspections({
    status: searchParams.get("status") ?? undefined,
    assetNumber: searchParams.get("assetNumber") ?? undefined,
    contractNumber: searchParams.get("contractNumber") ?? undefined,
  });

  return ok({
    count: data.length,
    data,
  });
}

export async function POST(request: Request) {
  try {
    const payload = await readJson<Record<string, unknown>>(request);

    if ("damageSummary" in payload) {
      const parsedComplete = inspectionCompletionSchema.parse(payload);
      const inspectionId = String((payload as Record<string, unknown>).inspectionId ?? "");
      const scope = await resolveInspectionScope(inspectionId);

      if (!scope) {
        return ok({ error: "Inspection not found" }, { status: 404 });
      }

      const actor = await requireApiPermission(request, "inspections.manage", {
        branchId: scope.branchId ?? undefined,
        customerId: scope.customerId ?? undefined,
      });
      const data = await completeInspection(
        inspectionId,
        parsedComplete,
        actor.userId ?? undefined,
      );
      return ok({ message: "Inspection completed.", data });
    }

    const parsed = inspectionRequestSchema.parse(payload);
    const scope = await resolveContractScope(parsed.contractNumber);

    if (!scope) {
      return ok({ error: "Contract not found" }, { status: 404 });
    }

    const actor = await requireApiPermission(request, "inspections.manage", {
      branchId: scope.branchId ?? undefined,
      customerId: scope.customerId ?? undefined,
    });
    const data = await createInspection(parsed, actor.userId ?? undefined);
    return created({ message: "Inspection requested.", data });
  } catch (error) {
    return errorResponse(error);
  }
}

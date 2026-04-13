import { contractAmendmentSchema } from "@/lib/domain/validators";
import { errorResponse, getIdempotencyKey, ok, readJson } from "@/lib/server/api";
import { requireApiPermission, resolveContractScope } from "@/lib/server/authorization";
import { amendContract } from "@/lib/server/platform";

type ContractAmendRouteParams = {
  params: Promise<{
    contractId: string;
  }>;
};

export async function POST(
  request: Request,
  { params }: ContractAmendRouteParams,
) {
  try {
    const { contractId } = await params;
    const scope = await resolveContractScope(contractId);

    if (!scope) {
      return ok({ error: "Contract not found" }, { status: 404 });
    }

    const actor = await requireApiPermission(request, "contracts.manage", {
      branchId: scope.branchId ?? undefined,
      customerId: scope.customerId ?? undefined,
    });
    const payload = await readJson<Record<string, unknown>>(request);
    const parsed = contractAmendmentSchema.parse({
      ...payload,
      idempotencyKey: payload?.idempotencyKey ?? getIdempotencyKey(request),
    });
    const data = await amendContract(contractId, parsed, actor.userId ?? undefined);
    return ok({ message: "Contract amended.", data });
  } catch (error) {
    return errorResponse(error);
  }
}

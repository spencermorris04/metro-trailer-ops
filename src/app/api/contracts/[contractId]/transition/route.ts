import { canTransitionContract, contractTransitionMap } from "@/lib/domain/lifecycle";
import { contractTransitionSchema } from "@/lib/domain/validators";
import { errorResponse, getIdempotencyKey, ok, readJson } from "@/lib/server/api";
import {
  requireApiPermission,
  requireStaffApiPermission,
  resolveContractScope,
} from "@/lib/server/authorization";
import { contractInvalidationTags } from "@/lib/server/cache-tags";
import { listContracts, transitionContract } from "@/lib/server/platform";
import { invalidateWorkspaceCache } from "@/lib/server/workspace-cache";

type TransitionRouteParams = {
  params: Promise<{
    contractId: string;
  }>;
};

export async function GET(
  request: Request,
  { params }: TransitionRouteParams,
) {
  const { contractId } = await params;
  const scope = await resolveContractScope(contractId);

  if (!scope) {
    return ok({ error: "Contract not found" }, { status: 404 });
  }

  await requireStaffApiPermission(request, "contracts.view", {
    branchId: scope.branchId ?? undefined,
    customerId: scope.customerId ?? undefined,
  });
  const contract = (await listContracts()).find(
    (entry) => entry.id === contractId || entry.contractNumber === contractId,
  );

  if (!contract) {
    return ok({ error: "Contract not found" }, { status: 404 });
  }

  return ok({
    contract,
    allowedNextStates: contractTransitionMap[contract.status],
  });
}

export async function POST(
  request: Request,
  { params }: TransitionRouteParams,
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
    const contract = (await listContracts()).find(
      (entry) => entry.id === contractId || entry.contractNumber === contractId,
    );

    if (!contract) {
      return ok({ error: "Contract not found" }, { status: 404 });
    }

    const payload = await readJson<Record<string, unknown>>(request);
    const parsed = contractTransitionSchema.parse({
      ...payload,
      idempotencyKey:
        (typeof payload.idempotencyKey === "string" ? payload.idempotencyKey : undefined) ??
        getIdempotencyKey(request),
    });

    if (contract.status !== parsed.fromStatus) {
      return ok(
        {
          error: "Contract state mismatch",
          expectedCurrentStatus: contract.status,
        },
        { status: 409 },
      );
    }

    if (!canTransitionContract(parsed.fromStatus, parsed.toStatus)) {
      return ok(
        {
          error: "Transition is not allowed",
          allowedNextStates: contractTransitionMap[parsed.fromStatus],
        },
        { status: 409 },
      );
    }

    const data = await transitionContract(
      contractId,
      parsed.toStatus,
      actor.userId ?? undefined,
      parsed.reason,
      {
        effectiveAt: parsed.effectiveAt,
        idempotencyKey: parsed.idempotencyKey,
      },
    );
    await invalidateWorkspaceCache(contractInvalidationTags(data.id));

    return ok({
      message: "Contract transitioned.",
      data,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

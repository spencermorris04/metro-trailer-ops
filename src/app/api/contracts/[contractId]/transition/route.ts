import { canTransitionContract, contractTransitionMap } from "@/lib/domain/lifecycle";
import { contractTransitionSchema } from "@/lib/domain/validators";
import { errorResponse, ok, readJson } from "@/lib/server/api";
import { listContracts, transitionContract } from "@/lib/server/platform-service";

type TransitionRouteParams = {
  params: Promise<{
    contractId: string;
  }>;
};

export async function GET(
  _request: Request,
  { params }: TransitionRouteParams,
) {
  const { contractId } = await params;
  const contract = listContracts().find(
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
    const contract = listContracts().find(
      (entry) => entry.id === contractId || entry.contractNumber === contractId,
    );

    if (!contract) {
      return ok({ error: "Contract not found" }, { status: 404 });
    }

    const payload = await readJson(request);
    const parsed = contractTransitionSchema.parse(payload);

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

    const data = transitionContract(contractId, parsed.toStatus, "System", parsed.reason);

    return ok({
      message: "Contract transitioned.",
      data,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

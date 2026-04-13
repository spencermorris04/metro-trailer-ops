import { listContracts } from "@/lib/server/platform";
import { ok } from "@/lib/server/api";
import { requireStaffApiPermission, resolveContractScope } from "@/lib/server/authorization";

type ContractRouteParams = {
  params: Promise<{
    contractId: string;
  }>;
};

export async function GET(request: Request, { params }: ContractRouteParams) {
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

  return contract
    ? ok({ data: contract })
    : ok({ error: "Contract not found" }, { status: 404 });
}

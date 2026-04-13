import { listContracts } from "@/lib/server/platform-service";
import { ok } from "@/lib/server/api";

type ContractRouteParams = {
  params: Promise<{
    contractId: string;
  }>;
};

export async function GET(_request: Request, { params }: ContractRouteParams) {
  const { contractId } = await params;
  const contract = listContracts().find(
    (entry) => entry.id === contractId || entry.contractNumber === contractId,
  );

  return contract
    ? ok({ data: contract })
    : ok({ error: "Contract not found" }, { status: 404 });
}

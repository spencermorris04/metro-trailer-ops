import { contractAmendmentSchema } from "@/lib/domain/validators";
import { errorResponse, ok, readJson } from "@/lib/server/api";
import { amendContract } from "@/lib/server/platform-service";

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
    const payload = await readJson(request);
    const parsed = contractAmendmentSchema.parse(payload);
    const data = amendContract(contractId, parsed);
    return ok({ message: "Contract amended.", data });
  } catch (error) {
    return errorResponse(error);
  }
}

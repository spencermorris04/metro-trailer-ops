import { contractSchema } from "@/lib/domain/validators";
import { created, errorResponse, ok, readJson } from "@/lib/server/api";
import {
  createContract,
  listContracts,
  listFinancialEvents,
} from "@/lib/server/platform-service";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const data = listContracts({
    q: searchParams.get("q") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    branch: searchParams.get("branch") ?? undefined,
  });

  return ok({
    count: data.length,
    data,
    relatedFinancialEvents: listFinancialEvents(),
  });
}

export async function POST(request: Request) {
  try {
    const payload = await readJson(request);
    const parsed = contractSchema.parse(payload);
    const data = createContract(parsed);

    return created({
      message: "Contract created.",
      data,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

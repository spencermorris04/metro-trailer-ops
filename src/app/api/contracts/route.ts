import { contractSchema } from "@/lib/domain/validators";
import { created, errorResponse, getIdempotencyKey, ok, readJson } from "@/lib/server/api";
import { requireApiPermission, requireStaffApiPermission } from "@/lib/server/authorization";
import {
  createContract,
  listContracts,
  listFinancialEvents,
} from "@/lib/server/platform";

export async function GET(request: Request) {
  const actor = await requireStaffApiPermission(request, "contracts.view");
  const { searchParams } = new URL(request.url);
  const data = await listContracts({
    q: searchParams.get("q") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    branch: searchParams.get("branch") ?? undefined,
  });

  return ok({
    count: data.length,
    data,
    relatedFinancialEvents: actor.permissionKeys.has("accounting.view")
      ? await listFinancialEvents()
      : [],
  });
}

export async function POST(request: Request) {
  try {
    const actor = await requireApiPermission(request, "contracts.manage");
    const payload = await readJson<Record<string, unknown>>(request);
    const parsed = contractSchema.parse({
      ...payload,
      idempotencyKey:
        (typeof payload.idempotencyKey === "string" ? payload.idempotencyKey : undefined) ??
        getIdempotencyKey(request),
    });
    const data = await createContract(parsed, actor.userId ?? undefined);

    return created({
      message: "Contract created.",
      data,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

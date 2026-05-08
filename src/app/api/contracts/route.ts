import { contractSchema } from "@/lib/domain/validators";
import { created, errorResponse, getIdempotencyKey, ok, readJson } from "@/lib/server/api";
import { requireApiPermission, requireStaffApiPermission } from "@/lib/server/authorization";
import { contractInvalidationTags } from "@/lib/server/cache-tags";
import {
  createContract,
  listContracts,
  listFinancialEvents,
} from "@/lib/server/platform";
import { invalidateWorkspaceCache } from "@/lib/server/workspace-cache";

export async function GET(request: Request) {
  const actor = await requireStaffApiPermission(request, "contracts.view");
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") ?? "25")));
  const data = await listContracts({
    q: searchParams.get("q") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    branch: searchParams.get("branch") ?? undefined,
  });
  const start = (page - 1) * pageSize;
  const paged = data.slice(start, start + pageSize);

  return ok({
    count: data.length,
    page,
    pageSize,
    filters: {
      q: searchParams.get("q"),
      status: searchParams.get("status"),
      branch: searchParams.get("branch"),
    },
    data: paged,
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
    await invalidateWorkspaceCache(contractInvalidationTags(data.id));

    return created({
      message: "Contract created.",
      data,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

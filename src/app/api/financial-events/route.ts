import { financialEventSchema } from "@/lib/domain/validators";
import { created, errorResponse, ok, readJson } from "@/lib/server/api";
import { requireApiPermission, requireStaffApiPermission } from "@/lib/server/authorization";
import { createFinancialEvent, listFinancialEvents } from "@/lib/server/platform";

export async function GET(request: Request) {
  await requireStaffApiPermission(request, "accounting.view");

  const { searchParams } = new URL(request.url);
  const data = await listFinancialEvents({
    contractNumber: searchParams.get("contractNumber") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    eventType: searchParams.get("eventType") ?? undefined,
  });

  return ok({
    count: data.length,
    data,
  });
}

export async function POST(request: Request) {
  try {
    const actor = await requireApiPermission(request, "accounting.manage");
    const payload = await readJson(request);
    const parsed = financialEventSchema.parse(payload);
    const data = await createFinancialEvent({
      contractId: parsed.contractId,
      eventType: parsed.eventType,
      description: parsed.description,
      amount: parsed.amount,
      eventDate: parsed.eventDate,
      status: parsed.status,
    }, actor.userId ?? undefined);

    return created({
      message: "Financial event created.",
      data,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

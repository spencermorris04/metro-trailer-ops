import { financialEventSchema } from "@/lib/domain/validators";
import { created, errorResponse, ok, readJson } from "@/lib/server/api";
import { createFinancialEvent, listFinancialEvents } from "@/lib/server/platform-service";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const data = listFinancialEvents({
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
    const payload = await readJson(request);
    const parsed = financialEventSchema.parse(payload);
    const data = createFinancialEvent({
      contractId: parsed.contractId,
      eventType: parsed.eventType,
      description: parsed.description,
      amount: parsed.amount,
      eventDate: parsed.eventDate,
      status: parsed.status,
    });

    return created({
      message: "Financial event created.",
      data,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

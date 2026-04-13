import { errorResponse, ok, readJson } from "@/lib/server/api";
import { listInvoices, generateInvoiceForContract } from "@/lib/server/platform-service";
import { z } from "zod";

const invoiceGenerationSchema = z.object({
  contractId: z.string().min(1),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const data = listInvoices({
    status: searchParams.get("status") ?? undefined,
    customerName: searchParams.get("customerName") ?? undefined,
    q: searchParams.get("q") ?? undefined,
  });

  return ok({
    count: data.length,
    data,
  });
}

export async function POST(request: Request) {
  try {
    const payload = await readJson(request);
    const parsed = invoiceGenerationSchema.parse(payload);
    const data = await generateInvoiceForContract(parsed.contractId);

    return ok(
      {
        message: "Invoice generated.",
        data,
      },
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}

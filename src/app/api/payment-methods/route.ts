import { paymentMethodSchema } from "@/lib/domain/validators";
import { created, errorResponse, ok, readJson } from "@/lib/server/api";
import { addPaymentMethod, listPaymentMethods } from "@/lib/server/platform-service";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const customerNumber = searchParams.get("customerNumber") ?? undefined;
  const data = listPaymentMethods(customerNumber);

  return ok({
    count: data.length,
    data,
  });
}

export async function POST(request: Request) {
  try {
    const payload = await readJson(request);
    const parsed = paymentMethodSchema.parse(payload);
    const data = await addPaymentMethod(parsed);

    return created({
      message: "Payment method created.",
      data,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

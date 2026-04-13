import { customerSchema } from "@/lib/domain/validators";
import { created, errorResponse, ok, readJson } from "@/lib/server/api";
import { createCustomer, listCustomers } from "@/lib/server/platform-service";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const data = listCustomers({
    q: searchParams.get("q") ?? undefined,
    customerType: searchParams.get("customerType") ?? undefined,
    portalEnabled: searchParams.get("portalEnabled") ?? undefined,
  });

  return ok({
    count: data.length,
    data,
  });
}

export async function POST(request: Request) {
  try {
    const payload = await readJson(request);
    const parsed = customerSchema.parse(payload);
    const data = createCustomer(parsed);

    return created({
      message: "Customer created.",
      data,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

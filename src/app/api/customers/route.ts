import { customerSchema } from "@/lib/domain/validators";
import { created, errorResponse, ok, readJson } from "@/lib/server/api";
import { requireApiPermission } from "@/lib/server/authorization";
import { createCustomer, listCustomers } from "@/lib/server/platform";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const data = await listCustomers({
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
    await requireApiPermission(request, "customers.manage");
    const payload = await readJson(request);
    const parsed = customerSchema.parse(payload);
    const data = await createCustomer(parsed);

    return created({
      message: "Customer created.",
      data,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

import { customerUpdateSchema } from "@/lib/domain/validators";
import {
  deleteCustomer,
  listCustomers,
  updateCustomer,
} from "@/lib/server/platform-service";
import { errorResponse, noContent, ok, readJson } from "@/lib/server/api";

type CustomerRouteParams = {
  params: Promise<{
    customerId: string;
  }>;
};

export async function GET(_request: Request, { params }: CustomerRouteParams) {
  const { customerId } = await params;
  const customer = listCustomers().find(
    (entry) =>
      entry.id === customerId ||
      entry.customerNumber === customerId ||
      entry.name === customerId,
  );

  return customer
    ? ok({ data: customer })
    : ok({ error: "Customer not found" }, { status: 404 });
}

export async function PATCH(request: Request, { params }: CustomerRouteParams) {
  try {
    const { customerId } = await params;
    const payload = await readJson(request);
    const parsed = customerUpdateSchema.parse(payload);
    const data = updateCustomer(customerId, parsed);
    return ok({ message: "Customer updated.", data });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: Request, { params }: CustomerRouteParams) {
  try {
    const { customerId } = await params;
    deleteCustomer(customerId);
    return noContent();
  } catch (error) {
    return errorResponse(error);
  }
}

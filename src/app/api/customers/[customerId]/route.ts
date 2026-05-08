import { customerUpdateSchema } from "@/lib/domain/validators";
import {
  deleteCustomer,
  listCustomers,
  updateCustomer,
} from "@/lib/server/platform";
import { errorResponse, noContent, ok, readJson } from "@/lib/server/api";
import {
  requireApiPermission,
  requireStaffApiPermission,
  resolveCustomerScope,
} from "@/lib/server/authorization";
import { customerInvalidationTags } from "@/lib/server/cache-tags";
import { invalidateWorkspaceCache } from "@/lib/server/workspace-cache";

type CustomerRouteParams = {
  params: Promise<{
    customerId: string;
  }>;
};

export async function GET(request: Request, { params }: CustomerRouteParams) {
  const { customerId } = await params;
  const scope = await resolveCustomerScope(customerId);

  if (!scope) {
    return ok({ error: "Customer not found" }, { status: 404 });
  }

  await requireStaffApiPermission(request, "customers.view", {
    customerId: scope.customerId ?? undefined,
  });
  const customer = (await listCustomers()).find(
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
    const scope = await resolveCustomerScope(customerId);

    if (!scope) {
      return ok({ error: "Customer not found" }, { status: 404 });
    }

    const actor = await requireApiPermission(request, "customers.manage", {
      customerId: scope.customerId ?? undefined,
    });
    const payload = await readJson(request);
    const parsed = customerUpdateSchema.parse(payload);
    const data = await updateCustomer(customerId, parsed, actor.userId ?? undefined);
    await invalidateWorkspaceCache(customerInvalidationTags(data.id));
    return ok({ message: "Customer updated.", data });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request, { params }: CustomerRouteParams) {
  try {
    const { customerId } = await params;
    const scope = await resolveCustomerScope(customerId);

    if (!scope) {
      return ok({ error: "Customer not found" }, { status: 404 });
    }

    const actor = await requireApiPermission(request, "customers.manage", {
      customerId: scope.customerId ?? undefined,
    });
    await deleteCustomer(customerId, actor.userId ?? undefined);
    await invalidateWorkspaceCache(customerInvalidationTags(customerId));
    return noContent();
  } catch (error) {
    return errorResponse(error);
  }
}

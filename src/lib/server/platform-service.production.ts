import { and, desc, eq, ilike, inArray, isNull, or } from "drizzle-orm";

import { db, schema } from "@/lib/db";
import {
  canTransitionAsset,
  canTransitionContract,
} from "@/lib/domain/lifecycle";
import type {
  AssetRecord,
  AssetStatusKey,
  ContractRecord,
  ContractStatusKey,
  CustomerLocationRecord,
  CustomerRecord,
  FinancialEventRecord,
  InvoiceRecord,
} from "@/lib/domain/models";
import type {
  AuditEventRecord,
  FleetUtilizationRecord,
  PaymentMethodRecord,
  RevenueSeriesPoint,
  UserRecord,
} from "@/lib/platform-types";
import { ApiError } from "@/lib/server/api";
import {
  buildRevenueExport,
  createStripePaymentIntent,
  createStripePortalSession,
} from "@/lib/server/integration-clients";
import { enqueueOutboxJob } from "@/lib/server/outbox";
import {
  createId,
  now,
  numericToNumber,
  toDate,
  toIso,
} from "@/lib/server/production-utils";

type AddressInput = {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country?: string;
};

type ContactInput = {
  name: string;
  email?: string;
  phone?: string;
};

type CustomerLocationInput = {
  name: string;
  address: AddressInput;
  contactPerson: ContactInput;
};

type CreateAssetInput = {
  assetNumber: string;
  type: AssetRecord["type"];
  branchId: string;
  status?: AssetRecord["status"];
  availability?: AssetRecord["availability"];
  maintenanceStatus?: AssetRecord["maintenanceStatus"];
  gpsDeviceId?: string;
  dimensions?: string;
  ageInMonths?: number;
  features?: string[];
};

type UpdateAssetInput = Partial<CreateAssetInput>;

type CreateCustomerInput = {
  customerNumber: string;
  name: string;
  customerType: CustomerRecord["customerType"];
  contactInfo?: ContactInput;
  billingAddress: AddressInput;
  locations?: CustomerLocationInput[];
};

type UpdateCustomerInput = {
  name?: string;
  customerType?: CustomerRecord["customerType"];
  portalEnabled?: boolean;
  branchCoverage?: string[];
};

type ContractLineInput = {
  assetId?: string;
  description?: string;
  unitPrice: number;
  unit: string;
  quantity: number;
  startDate: Date;
  endDate?: Date | null;
  adjustments?: string[];
};

type CreateContractInput = {
  contractNumber: string;
  customerId: string;
  locationId: string;
  branchId: string;
  startDate: Date;
  endDate?: Date | null;
  status?: ContractRecord["status"];
  lines: ContractLineInput[];
};

type AmendContractInput = {
  amendmentType: string;
  notes?: string;
  extendedEndDate?: string;
  assetNumbersToAdd?: string[];
  assetNumbersToRemove?: string[];
};

type CreateFinancialEventInput = {
  contractId: string;
  eventType: FinancialEventRecord["eventType"];
  description: string;
  amount: number;
  eventDate: Date | string;
  status?: FinancialEventRecord["status"];
};

type AddPaymentMethodInput = {
  customerNumber: string;
  methodType: string;
  label: string;
  last4: string;
};

function requireRecord<T>(value: T | undefined, message: string) {
  if (!value) {
    throw new ApiError(404, message);
  }

  return value;
}

function billingCity(address: Record<string, unknown>) {
  return typeof address.city === "string" ? address.city : "Unknown";
}

function locationAddress(address: Record<string, unknown>) {
  const line1 = typeof address.line1 === "string" ? address.line1 : "";
  const city = typeof address.city === "string" ? address.city : "";
  const state = typeof address.state === "string" ? address.state : "";
  return [line1, city, state].filter(Boolean).join(", ");
}

function contactName(contactInfo: Record<string, unknown> | null) {
  if (!contactInfo) {
    return "Unassigned";
  }

  return typeof contactInfo.name === "string" ? contactInfo.name : "Unassigned";
}

function assetAvailability(
  status: AssetStatusKey,
  maintenanceStatus: AssetRecord["maintenanceStatus"],
) {
  if (status === "available") {
    return {
      availability: "rentable" as const,
      maintenanceStatus:
        maintenanceStatus === "under_repair" ? "clear" : maintenanceStatus,
    };
  }

  if (status === "reserved" || status === "inspection_hold") {
    return {
      availability: "limited" as const,
      maintenanceStatus:
        status === "inspection_hold" ? "inspection_required" : maintenanceStatus,
    };
  }

  return {
    availability: "unavailable" as const,
    maintenanceStatus,
  };
}

async function pushAudit(event: {
  entityType: typeof schema.auditEvents.$inferInsert.entityType;
  entityId: string;
  eventType: string;
  userId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  await db.insert(schema.auditEvents).values({
    id: createId("audit"),
    entityType: event.entityType,
    entityId: event.entityId,
    eventType: event.eventType,
    userId: event.userId ?? null,
    metadata: event.metadata ?? {},
    createdAt: now(),
  });
}

async function getAssetByIdOrNumber(assetId: string) {
  const asset = await db.query.assets.findFirst({
    where: (table, { eq: localEq, or: localOr }) =>
      localOr(localEq(table.id, assetId), localEq(table.assetNumber, assetId)),
  });

  return requireRecord(asset, `Asset ${assetId} not found.`);
}

async function getCustomerByIdOrNumber(customerId: string) {
  const customer = await db.query.customers.findFirst({
    where: (table, { eq: localEq, or: localOr }) =>
      localOr(
        localEq(table.id, customerId),
        localEq(table.customerNumber, customerId),
        localEq(table.name, customerId),
      ),
  });

  return requireRecord(customer, `Customer ${customerId} not found.`);
}

async function getContractByIdOrNumber(contractId: string) {
  const contract = await db.query.contracts.findFirst({
    where: (table, { eq: localEq, or: localOr }) =>
      localOr(localEq(table.id, contractId), localEq(table.contractNumber, contractId)),
  });

  return requireRecord(contract, `Contract ${contractId} not found.`);
}

async function getInvoiceByIdOrNumber(invoiceId: string) {
  const invoice = await db.query.invoices.findFirst({
    where: (table, { eq: localEq, or: localOr }) =>
      localOr(localEq(table.id, invoiceId), localEq(table.invoiceNumber, invoiceId)),
  });

  return requireRecord(invoice, `Invoice ${invoiceId} not found.`);
}

async function customerRecords() {
  const [customers, locations] = await Promise.all([
    db.select().from(schema.customers).orderBy(schema.customers.name),
    db.select().from(schema.customerLocations).orderBy(schema.customerLocations.name),
  ]);

  const locationMap = new Map<string, CustomerLocationRecord[]>();
  locations.forEach((location) => {
    const current = locationMap.get(location.customerId) ?? [];
    current.push({
      id: location.id,
      name: location.name,
      address: locationAddress(location.address ?? {}),
      contactPerson: contactName(
        (location.contactPerson as Record<string, unknown> | null) ?? null,
      ),
    });
    locationMap.set(location.customerId, current);
  });

  return customers.map((customer) => ({
    id: customer.id,
    customerNumber: customer.customerNumber,
    name: customer.name,
    customerType: customer.customerType,
    billingCity: billingCity(customer.billingAddress ?? {}),
    portalEnabled: customer.portalEnabled,
    branchCoverage: customer.branchCoverage ?? [],
    locations: locationMap.get(customer.id) ?? [],
  })) satisfies CustomerRecord[];
}

async function contractRecords() {
  const contracts = await db
    .select({
      id: schema.contracts.id,
      contractNumber: schema.contracts.contractNumber,
      customerName: schema.customers.name,
      locationName: schema.customerLocations.name,
      branchName: schema.branches.name,
      status: schema.contracts.status,
      startDate: schema.contracts.startDate,
      endDate: schema.contracts.endDate,
    })
    .from(schema.contracts)
    .innerJoin(schema.customers, eq(schema.contracts.customerId, schema.customers.id))
    .innerJoin(
      schema.customerLocations,
      eq(schema.contracts.locationId, schema.customerLocations.id),
    )
    .innerJoin(schema.branches, eq(schema.contracts.branchId, schema.branches.id))
    .orderBy(desc(schema.contracts.startDate));

  const contractIds = contracts.map((contract) => contract.id);
  const [lines, amendments] = await Promise.all([
    contractIds.length === 0
      ? Promise.resolve([] as Array<{
          contractId: string;
          assetNumber: string | null;
          unitPrice: string;
          quantity: string;
        }>)
      : db
          .select({
            contractId: schema.contractLines.contractId,
            assetNumber: schema.assets.assetNumber,
            unitPrice: schema.contractLines.unitPrice,
            quantity: schema.contractLines.quantity,
          })
          .from(schema.contractLines)
          .leftJoin(schema.assets, eq(schema.contractLines.assetId, schema.assets.id))
          .where(inArray(schema.contractLines.contractId, contractIds)),
    contractIds.length === 0
      ? Promise.resolve([] as Array<{ contractId: string; amendmentType: string }>)
      : db
          .select({
            contractId: schema.contractAmendments.contractId,
            amendmentType: schema.contractAmendments.amendmentType,
          })
          .from(schema.contractAmendments)
          .where(inArray(schema.contractAmendments.contractId, contractIds)),
  ]);

  const linesByContract = new Map<string, typeof lines>();
  lines.forEach((line) => {
    const current = linesByContract.get(line.contractId) ?? [];
    current.push(line);
    linesByContract.set(line.contractId, current);
  });
  const amendmentsByContract = new Map<string, string[]>();
  amendments.forEach((amendment) => {
    const current = amendmentsByContract.get(amendment.contractId) ?? [];
    current.push(amendment.amendmentType);
    amendmentsByContract.set(amendment.contractId, current);
  });

  return contracts.map((contract) => {
    const contractLines = linesByContract.get(contract.id) ?? [];
    return {
      id: contract.id,
      contractNumber: contract.contractNumber,
      customerName: contract.customerName,
      locationName: contract.locationName,
      branch: contract.branchName,
      status: contract.status,
      startDate: toIso(contract.startDate) ?? new Date(0).toISOString(),
      endDate: toIso(contract.endDate),
      assets: contractLines
        .map((line) => line.assetNumber)
        .filter((value): value is string => Boolean(value)),
      value: contractLines.reduce((sum, line) => {
        return sum + numericToNumber(line.unitPrice) * numericToNumber(line.quantity, 1);
      }, 0),
      amendmentFlags: amendmentsByContract.get(contract.id) ?? [],
    } satisfies ContractRecord;
  });
}

export async function getDashboardSummary() {
  const [assets, customers, contracts, invoices] = await Promise.all([
    listAssets(),
    listCustomers(),
    listContracts(),
    listInvoices(),
  ]);

  return {
    runtimeMode: "production",
    assets: assets.length,
    customers: customers.length,
    contracts: contracts.length,
    activeContracts: contracts.filter((contract) => contract.status === "active").length,
    overdueInvoices: invoices.filter((invoice) => invoice.status === "overdue").length,
    openWorkOrders: 0,
    pendingInspections: 0,
  };
}

export async function listBranches() {
  const rows = await db.select().from(schema.branches).orderBy(schema.branches.name);
  return rows.map((branch) => ({
    id: branch.id,
    code: branch.code,
    name: branch.name,
    timezone: branch.timezone,
    address:
      typeof branch.address.line1 === "string"
        ? `${branch.address.line1}, ${branch.address.city ?? ""}, ${branch.address.state ?? ""}`
        : branch.name,
    phone: branch.phone ?? "",
  }));
}

export async function listUsers() {
  const rows = await db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
      role: schema.users.role,
      branch: schema.branches.name,
    })
    .from(schema.users)
    .leftJoin(schema.branches, eq(schema.users.branchId, schema.branches.id))
    .orderBy(schema.users.name);

  return rows.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    branch: user.branch ?? "Unassigned",
  })) satisfies UserRecord[];
}

export async function listAssets(filters?: {
  q?: string;
  branch?: string;
  status?: string;
  availability?: string;
}) {
  const clauses = [];
  if (filters?.q) {
    const pattern = `%${filters.q}%`;
    clauses.push(
      or(
        ilike(schema.assets.assetNumber, pattern),
        ilike(schema.assets.type, pattern),
        ilike(schema.branches.name, pattern),
      ),
    );
  }
  if (filters?.branch) {
    clauses.push(eq(schema.branches.name, filters.branch));
  }
  if (filters?.status) {
    clauses.push(eq(schema.assets.status, filters.status as AssetStatusKey));
  }
  if (filters?.availability) {
    clauses.push(
      eq(
        schema.assets.availability,
        filters.availability as AssetRecord["availability"],
      ),
    );
  }

  const rows = await db
    .select({
      id: schema.assets.id,
      assetNumber: schema.assets.assetNumber,
      type: schema.assets.type,
      dimensions: schema.assets.dimensions,
      status: schema.assets.status,
      availability: schema.assets.availability,
      maintenanceStatus: schema.assets.maintenanceStatus,
      gpsDeviceId: schema.assets.gpsDeviceId,
      ageInMonths: schema.assets.ageInMonths,
      features: schema.assets.features,
      branchName: schema.branches.name,
    })
    .from(schema.assets)
    .innerJoin(schema.branches, eq(schema.assets.branchId, schema.branches.id))
    .where(clauses.length > 0 ? and(...clauses) : undefined)
    .orderBy(schema.assets.assetNumber);

  return rows.map((asset) => ({
    id: asset.id,
    assetNumber: asset.assetNumber,
    type: asset.type,
    dimensions:
      typeof asset.dimensions?.summary === "string"
        ? asset.dimensions.summary
        : JSON.stringify(asset.dimensions ?? "Unspecified dimensions"),
    branch: asset.branchName,
    status: asset.status,
    availability: asset.availability,
    maintenanceStatus: asset.maintenanceStatus,
    gpsDeviceId: asset.gpsDeviceId ?? undefined,
    age:
      asset.ageInMonths !== null && asset.ageInMonths !== undefined
        ? `${asset.ageInMonths} months`
        : "Unknown",
    features: asset.features ?? [],
  })) satisfies AssetRecord[];
}

export async function createAsset(payload: CreateAssetInput, userId?: string) {
  const branch = requireRecord(
    await db.query.branches.findFirst({
      where: (table, { eq: localEq, or: localOr }) =>
        localOr(localEq(table.id, payload.branchId), localEq(table.name, payload.branchId)),
    }),
    `Branch ${payload.branchId} not found.`,
  );
  const id = createId("asset");
  const status = payload.status ?? "available";
  const derived = assetAvailability(status, payload.maintenanceStatus ?? "clear");

  await db.insert(schema.assets).values({
    id,
    assetNumber: payload.assetNumber,
    type: payload.type,
    branchId: branch.id,
    status,
    availability: payload.availability ?? derived.availability,
    maintenanceStatus: derived.maintenanceStatus,
    gpsDeviceId: payload.gpsDeviceId ?? null,
    dimensions: {
      summary: payload.dimensions ?? "Unspecified dimensions",
    },
    ageInMonths: payload.ageInMonths ?? null,
    features: payload.features ?? [],
    createdAt: now(),
    updatedAt: now(),
  });

  await pushAudit({
    entityType: "asset",
    entityId: id,
    eventType: "created",
    userId,
    metadata: {
      assetNumber: payload.assetNumber,
      branchId: branch.id,
    },
  });

  return requireRecord(
    (await listAssets()).find((asset) => asset.id === id),
    `Asset ${id} not found after creation.`,
  );
}

export async function updateAsset(assetId: string, payload: UpdateAssetInput, userId?: string) {
  const asset = await getAssetByIdOrNumber(assetId);
  const branchId = payload.branchId
    ? requireRecord(
        await db.query.branches.findFirst({
          where: (table, { eq: localEq, or: localOr }) =>
            localOr(
              localEq(table.id, payload.branchId ?? ""),
              localEq(table.name, payload.branchId ?? ""),
            ),
        }),
        `Branch ${payload.branchId} not found.`,
      ).id
    : asset.branchId;
  const status = payload.status ?? asset.status;
  const derived = assetAvailability(
    status,
    payload.maintenanceStatus ?? asset.maintenanceStatus,
  );

  await db
    .update(schema.assets)
    .set({
      branchId,
      status,
      availability: payload.availability ?? derived.availability,
      maintenanceStatus: derived.maintenanceStatus,
      gpsDeviceId: payload.gpsDeviceId ?? asset.gpsDeviceId,
      dimensions: payload.dimensions ? { summary: payload.dimensions } : asset.dimensions,
      features: payload.features ?? asset.features,
      updatedAt: now(),
    })
    .where(eq(schema.assets.id, asset.id));

  await pushAudit({
    entityType: "asset",
    entityId: asset.id,
    eventType: "updated",
    userId,
  });

  return requireRecord(
    (await listAssets()).find((entry) => entry.id === asset.id),
    `Asset ${asset.id} not found after update.`,
  );
}

export async function deleteAsset(assetId: string, userId?: string) {
  const asset = await getAssetByIdOrNumber(assetId);
  await db.delete(schema.assets).where(eq(schema.assets.id, asset.id));
  await pushAudit({
    entityType: "asset",
    entityId: asset.id,
    eventType: "deleted",
    userId,
  });
  return asset;
}

export async function transitionAsset(
  assetId: string,
  toStatus: AssetStatusKey,
  userId?: string,
  reason = "Manual lifecycle transition",
) {
  const asset = await getAssetByIdOrNumber(assetId);
  if (!canTransitionAsset(asset.status, toStatus)) {
    throw new ApiError(409, "Asset transition is not allowed.", {
      fromStatus: asset.status,
      toStatus,
    });
  }

  const derived = assetAvailability(toStatus, asset.maintenanceStatus);
  await db
    .update(schema.assets)
    .set({
      status: toStatus,
      availability: derived.availability,
      maintenanceStatus: derived.maintenanceStatus,
      updatedAt: now(),
    })
    .where(eq(schema.assets.id, asset.id));

  await pushAudit({
    entityType: "asset",
    entityId: asset.id,
    eventType: "status_changed",
    userId,
    metadata: {
      reason,
      toStatus,
    },
  });

  return requireRecord(
    (await listAssets()).find((entry) => entry.id === asset.id),
    `Asset ${asset.id} not found after transition.`,
  );
}

export async function listCustomers(filters?: {
  q?: string;
  customerType?: string;
  portalEnabled?: string;
}) {
  const customers = await customerRecords();
  return customers.filter((customer) => {
    if (filters?.q) {
      const q = filters.q.toLowerCase();
      const matches =
        customer.name.toLowerCase().includes(q) ||
        customer.customerNumber.toLowerCase().includes(q) ||
        customer.billingCity.toLowerCase().includes(q) ||
        customer.locations.some(
          (location) =>
            location.name.toLowerCase().includes(q) ||
            location.address.toLowerCase().includes(q),
        );
      if (!matches) {
        return false;
      }
    }
    if (filters?.customerType && customer.customerType !== filters.customerType) {
      return false;
    }
    if (filters?.portalEnabled) {
      const expected = filters.portalEnabled === "true";
      if (customer.portalEnabled !== expected) {
        return false;
      }
    }
    return true;
  });
}

export async function createCustomer(payload: CreateCustomerInput, userId?: string) {
  const customerId = createId("customer");
  await db.transaction(async (tx) => {
    await tx.insert(schema.customers).values({
      id: customerId,
      customerNumber: payload.customerNumber,
      name: payload.name,
      customerType: payload.customerType,
      contactInfo: payload.contactInfo ?? {},
      billingAddress: payload.billingAddress,
      portalEnabled: false,
      branchCoverage: [],
      createdAt: now(),
      updatedAt: now(),
    });

    if (payload.locations?.length) {
      await tx.insert(schema.customerLocations).values(
        payload.locations.map((location) => ({
          id: createId("loc"),
          customerId,
          name: location.name,
          address: location.address,
          contactPerson: location.contactPerson,
          createdAt: now(),
          updatedAt: now(),
        })),
      );
    }
  });

  await pushAudit({
    entityType: "customer",
    entityId: customerId,
    eventType: "created",
    userId,
  });

  return requireRecord(
    (await listCustomers()).find((customer) => customer.id === customerId),
    `Customer ${customerId} not found after creation.`,
  );
}

export async function updateCustomer(customerId: string, payload: UpdateCustomerInput, userId?: string) {
  const customer = await getCustomerByIdOrNumber(customerId);
  await db
    .update(schema.customers)
    .set({
      name: payload.name ?? customer.name,
      customerType: payload.customerType ?? customer.customerType,
      portalEnabled: payload.portalEnabled ?? customer.portalEnabled,
      branchCoverage: payload.branchCoverage ?? customer.branchCoverage,
      updatedAt: now(),
    })
    .where(eq(schema.customers.id, customer.id));

  await pushAudit({
    entityType: "customer",
    entityId: customer.id,
    eventType: "updated",
    userId,
  });

  return requireRecord(
    (await listCustomers()).find((entry) => entry.id === customer.id),
    `Customer ${customer.id} not found after update.`,
  );
}

export async function deleteCustomer(customerId: string, userId?: string) {
  const customer = await getCustomerByIdOrNumber(customerId);
  await db.delete(schema.customers).where(eq(schema.customers.id, customer.id));
  await pushAudit({
    entityType: "customer",
    entityId: customer.id,
    eventType: "deleted",
    userId,
  });
  return customer;
}

export async function listContracts(filters?: {
  q?: string;
  status?: string;
  branch?: string;
}) {
  const contracts = await contractRecords();
  return contracts.filter((contract) => {
    if (filters?.q) {
      const q = filters.q.toLowerCase();
      const matches =
        contract.contractNumber.toLowerCase().includes(q) ||
        contract.customerName.toLowerCase().includes(q) ||
        contract.locationName.toLowerCase().includes(q);
      if (!matches) {
        return false;
      }
    }
    if (filters?.status && contract.status !== filters.status) {
      return false;
    }
    if (filters?.branch && contract.branch !== filters.branch) {
      return false;
    }
    return true;
  });
}

export async function createContract(payload: CreateContractInput, userId?: string) {
  const contractId = createId("contract");
  const status = payload.status ?? "quoted";
  await db.transaction(async (tx) => {
    await tx.insert(schema.contracts).values({
      id: contractId,
      contractNumber: payload.contractNumber,
      customerId: payload.customerId,
      locationId: payload.locationId,
      branchId: payload.branchId,
      startDate: payload.startDate,
      endDate: payload.endDate ?? null,
      status,
      quotedAt: status === "quoted" ? now() : null,
      reservedAt: status === "reserved" ? now() : null,
      activatedAt: status === "active" ? now() : null,
      createdAt: now(),
      updatedAt: now(),
    });

    const lineRows = payload.lines.map((line) => ({
      id: createId("cline"),
      contractId,
      assetId: line.assetId ?? null,
      description: line.description ?? null,
      unitPrice: line.unitPrice.toFixed(2),
      unit: line.unit as typeof schema.contractLines.$inferInsert.unit,
      quantity: String(line.quantity),
      startDate: line.startDate,
      endDate: line.endDate ?? null,
      adjustments: { items: line.adjustments ?? [] },
      createdAt: now(),
      updatedAt: now(),
    }));

    await tx.insert(schema.contractLines).values(lineRows);

    if (status === "reserved" || status === "active") {
      const allocationType: "reservation" | "on_rent" =
        status === "reserved" ? "reservation" : "on_rent";
      const allocatableLines = lineRows.filter((line) => line.assetId);
      if (allocatableLines.length > 0) {
        await tx.insert(schema.assetAllocations).values(
          allocatableLines.map((line) => ({
            id: createId("alloc"),
            assetId: line.assetId as string,
            contractId,
            contractLineId: line.id,
            allocationType,
            startsAt: line.startDate,
            endsAt: line.endDate,
            sourceEvent: allocationType,
            active: true,
            createdAt: now(),
            updatedAt: now(),
          })),
        );
      }
    }
  });

  await pushAudit({
    entityType: "contract",
    entityId: contractId,
    eventType: "created",
    userId,
  });

  return requireRecord(
    (await listContracts()).find((contract) => contract.id === contractId),
    `Contract ${contractId} not found after creation.`,
  );
}

async function applyContractLifecycle(contract: typeof schema.contracts.$inferSelect, toStatus: ContractStatusKey) {
  const lines = await db
    .select()
    .from(schema.contractLines)
    .where(eq(schema.contractLines.contractId, contract.id));
  const assetIds = lines.map((line) => line.assetId).filter((value): value is string => Boolean(value));
  if (assetIds.length === 0) {
    return;
  }

  if (toStatus === "reserved" || toStatus === "active") {
    const assetStatus = toStatus === "reserved" ? "reserved" : "on_rent";
    const derived = assetAvailability(assetStatus, "clear");
    await db
      .update(schema.assets)
      .set({
        status: assetStatus,
        availability: derived.availability,
        maintenanceStatus: derived.maintenanceStatus,
        updatedAt: now(),
      })
      .where(inArray(schema.assets.id, assetIds));
  }

  if (toStatus === "completed") {
    await db
      .update(schema.assets)
      .set({
        status: "inspection_hold",
        availability: "limited",
        maintenanceStatus: "inspection_required",
        updatedAt: now(),
      })
      .where(inArray(schema.assets.id, assetIds));
  }

  if (toStatus === "closed" || toStatus === "cancelled") {
    await db
      .update(schema.assets)
      .set({
        status: "available",
        availability: "rentable",
        maintenanceStatus: "clear",
        updatedAt: now(),
      })
      .where(inArray(schema.assets.id, assetIds));
    await db
      .update(schema.assetAllocations)
      .set({
        active: false,
        endsAt: now(),
        updatedAt: now(),
      })
      .where(and(eq(schema.assetAllocations.contractId, contract.id), eq(schema.assetAllocations.active, true)));
  }
}

export async function transitionContract(
  contractId: string,
  toStatus: ContractStatusKey,
  userId?: string,
  reason = "Manual contract lifecycle transition",
) {
  const contract = await getContractByIdOrNumber(contractId);
  if (!canTransitionContract(contract.status, toStatus)) {
    throw new ApiError(409, "Contract transition is not allowed.", {
      fromStatus: contract.status,
      toStatus,
    });
  }

  await db
    .update(schema.contracts)
    .set({
      status: toStatus,
      reservedAt: toStatus === "reserved" ? now() : contract.reservedAt,
      activatedAt: toStatus === "active" ? now() : contract.activatedAt,
      completedAt: toStatus === "completed" ? now() : contract.completedAt,
      closedAt: toStatus === "closed" ? now() : contract.closedAt,
      cancelledAt: toStatus === "cancelled" ? now() : contract.cancelledAt,
      updatedAt: now(),
    })
    .where(eq(schema.contracts.id, contract.id));

  await applyContractLifecycle(contract, toStatus);
  await pushAudit({
    entityType: "contract",
    entityId: contract.id,
    eventType: "status_changed",
    userId,
    metadata: { reason, toStatus },
  });

  return requireRecord(
    (await listContracts()).find((entry) => entry.id === contract.id),
    `Contract ${contract.id} not found after transition.`,
  );
}

export async function amendContract(contractId: string, payload: AmendContractInput, userId?: string) {
  const contract = await getContractByIdOrNumber(contractId);
  await db.insert(schema.contractAmendments).values({
    id: createId("amd"),
    contractId: contract.id,
    amendmentType:
      payload.amendmentType as typeof schema.contractAmendments.$inferInsert.amendmentType,
    requestedByUserId: userId ?? null,
    notes: payload.notes ?? null,
    deltaPayload: {
      extendedEndDate: payload.extendedEndDate ?? null,
      assetNumbersToAdd: payload.assetNumbersToAdd ?? [],
      assetNumbersToRemove: payload.assetNumbersToRemove ?? [],
    },
    effectiveAt: payload.extendedEndDate ? toDate(payload.extendedEndDate) : null,
    createdAt: now(),
  });
  if (payload.extendedEndDate) {
    await db
      .update(schema.contracts)
      .set({
        endDate: toDate(payload.extendedEndDate),
        updatedAt: now(),
      })
      .where(eq(schema.contracts.id, contract.id));
  }
  await pushAudit({
    entityType: "contract",
    entityId: contract.id,
    eventType: "amended",
    userId,
  });

  return requireRecord(
    (await listContracts()).find((entry) => entry.id === contract.id),
    `Contract ${contract.id} not found after amendment.`,
  );
}

export async function listFinancialEvents(filters?: {
  contractNumber?: string;
  eventType?: string;
  status?: string;
}) {
  const rows = await db
    .select({
      id: schema.financialEvents.id,
      contractNumber: schema.contracts.contractNumber,
      eventType: schema.financialEvents.eventType,
      description: schema.financialEvents.description,
      amount: schema.financialEvents.amount,
      eventDate: schema.financialEvents.eventDate,
      status: schema.financialEvents.status,
    })
    .from(schema.financialEvents)
    .leftJoin(schema.contracts, eq(schema.financialEvents.contractId, schema.contracts.id))
    .where(
      filters?.contractNumber
        ? eq(schema.contracts.contractNumber, filters.contractNumber)
        : undefined,
    )
    .orderBy(desc(schema.financialEvents.eventDate));

  return rows
    .map((row) => ({
      id: row.id,
      contractNumber: row.contractNumber ?? "Unassigned",
      eventType: row.eventType,
      description: row.description,
      amount: numericToNumber(row.amount),
      eventDate: toIso(row.eventDate) ?? new Date(0).toISOString(),
      status: row.status,
    }))
    .filter((event) => {
      if (filters?.eventType && event.eventType !== filters.eventType) {
        return false;
      }
      if (filters?.status && event.status !== filters.status) {
        return false;
      }
      return true;
    }) satisfies FinancialEventRecord[];
}

export async function createFinancialEvent(payload: CreateFinancialEventInput, userId?: string) {
  const contract = await getContractByIdOrNumber(payload.contractId);
  const id = createId("fe");
  await db.insert(schema.financialEvents).values({
    id,
    contractId: contract.id,
    eventType: payload.eventType,
    description: payload.description,
    amount: payload.amount.toFixed(2),
    eventDate: toDate(payload.eventDate) ?? now(),
    status: payload.status ?? "pending",
    createdAt: now(),
    updatedAt: now(),
  });
  await pushAudit({
    entityType: "financial_event",
    entityId: id,
    eventType: "created",
    userId,
  });
  return requireRecord(
    (await listFinancialEvents()).find((entry) => entry.id === id),
    `Financial event ${id} not found after creation.`,
  );
}

export async function listInvoices(filters?: {
  customerNumber?: string;
  status?: string;
  contractNumber?: string;
}) {
  const rows = await db
    .select({
      id: schema.invoices.id,
      invoiceNumber: schema.invoices.invoiceNumber,
      customerNumber: schema.customers.customerNumber,
      customerName: schema.customers.name,
      contractNumber: schema.contracts.contractNumber,
      status: schema.invoices.status,
      invoiceDate: schema.invoices.invoiceDate,
      dueDate: schema.invoices.dueDate,
      totalAmount: schema.invoices.totalAmount,
      balanceAmount: schema.invoices.balanceAmount,
    })
    .from(schema.invoices)
    .innerJoin(schema.customers, eq(schema.invoices.customerId, schema.customers.id))
    .leftJoin(schema.contracts, eq(schema.invoices.contractId, schema.contracts.id))
    .orderBy(desc(schema.invoices.invoiceDate));

  return rows
    .filter((row) => {
      if (filters?.status && row.status !== filters.status) {
        return false;
      }
      if (
        filters?.contractNumber &&
        (row.contractNumber ?? "Unassigned") !== filters.contractNumber
      ) {
        return false;
      }
      if (filters?.customerNumber && row.customerNumber !== filters.customerNumber) {
        return false;
      }
      return true;
    })
    .map((row) => ({
      id: row.id,
      invoiceNumber: row.invoiceNumber,
      customerName: row.customerName,
      contractNumber: row.contractNumber ?? "Unassigned",
      status: row.status,
      invoiceDate: toIso(row.invoiceDate) ?? new Date(0).toISOString(),
      dueDate: toIso(row.dueDate) ?? new Date(0).toISOString(),
      totalAmount: numericToNumber(row.totalAmount),
      balanceAmount: numericToNumber(row.balanceAmount),
    })) satisfies InvoiceRecord[];
}

export async function generateInvoiceForContract(contractId: string, userId?: string) {
  const contract = await getContractByIdOrNumber(contractId);
  const customer = requireRecord(
    await db.query.customers.findFirst({
      where: (table, { eq: localEq }) => localEq(table.id, contract.customerId),
    }),
    `Customer for contract ${contract.contractNumber} not found.`,
  );
  const uninvoicedEvents = await db
    .select()
    .from(schema.financialEvents)
    .where(
      and(
        eq(schema.financialEvents.contractId, contract.id),
        isNull(schema.financialEvents.invoiceId),
      ),
    );

  const subtotal = uninvoicedEvents.reduce((sum, event) => {
    return sum + numericToNumber(event.amount);
  }, 0);
  const invoiceId = createId("invoice");
  const invoiceNumber = `INV-${new Date().toISOString().slice(2, 10).replace(/-/g, "")}-${invoiceId.slice(-4)}`;

  await db.transaction(async (tx) => {
    await tx.insert(schema.invoices).values({
      id: invoiceId,
      invoiceNumber,
      customerId: customer.id,
      contractId: contract.id,
      invoiceDate: now(),
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      status: "draft",
      subtotalAmount: subtotal.toFixed(2),
      taxAmount: "0.00",
      totalAmount: subtotal.toFixed(2),
      balanceAmount: subtotal.toFixed(2),
      createdAt: now(),
      updatedAt: now(),
    });

    if (uninvoicedEvents.length > 0) {
      await tx.insert(schema.invoiceLines).values(
        uninvoicedEvents.map((event) => ({
          id: createId("iline"),
          invoiceId,
          description: event.description,
          quantity: "1",
          unitPrice: event.amount,
          totalAmount: event.amount,
          sourceFinancialEventId: event.id,
          createdAt: now(),
          updatedAt: now(),
        })),
      );
      await tx
        .update(schema.financialEvents)
        .set({
          invoiceId,
          status: "invoiced",
          updatedAt: now(),
        })
        .where(inArray(schema.financialEvents.id, uninvoicedEvents.map((event) => event.id)));
    }
  });

  await pushAudit({
    entityType: "invoice",
    entityId: invoiceId,
    eventType: "created",
    userId,
  });
  await enqueueOutboxJob({
    jobType: "invoice.sync.quickbooks",
    aggregateType: "invoice",
    aggregateId: invoiceId,
    provider: "quickbooks",
    payload: {
      invoiceNumber,
      contractNumber: contract.contractNumber,
    },
  });

  return requireRecord(
    (await listInvoices()).find((invoice) => invoice.id === invoiceId),
    `Invoice ${invoiceId} not found after generation.`,
  );
}

export async function sendInvoice(invoiceId: string, userId?: string) {
  const invoice = await getInvoiceByIdOrNumber(invoiceId);
  const nextStatus = numericToNumber(invoice.balanceAmount) > 0 ? "sent" : "paid";
  await db
    .update(schema.invoices)
    .set({
      status: nextStatus,
      updatedAt: now(),
    })
    .where(eq(schema.invoices.id, invoice.id));
  await enqueueOutboxJob({
    jobType: "invoice.sync.quickbooks",
    aggregateType: "invoice",
    aggregateId: invoice.id,
    provider: "quickbooks",
    payload: {
      invoiceNumber: invoice.invoiceNumber,
    },
  });
  await pushAudit({
    entityType: "invoice",
    entityId: invoice.id,
    eventType: "sent",
    userId,
  });
  return requireRecord(
    (await listInvoices()).find((entry) => entry.id === invoice.id),
    `Invoice ${invoice.id} not found after send.`,
  );
}

export async function recordInvoicePayment(invoiceId: string, amount: number, userId?: string) {
  const invoice = await getInvoiceByIdOrNumber(invoiceId);
  const nextBalance = Math.max(numericToNumber(invoice.balanceAmount) - amount, 0);
  const nextStatus =
    nextBalance === 0
      ? "paid"
      : nextBalance < numericToNumber(invoice.totalAmount)
        ? "partially_paid"
        : invoice.status;

  await db.transaction(async (tx) => {
    await tx
      .update(schema.invoices)
      .set({
        balanceAmount: nextBalance.toFixed(2),
        status: nextStatus,
        updatedAt: now(),
      })
      .where(eq(schema.invoices.id, invoice.id));

    await tx.insert(schema.paymentTransactions).values({
      id: createId("pay"),
      invoiceId: invoice.id,
      customerId: invoice.customerId,
      provider: "stripe",
      transactionType: "payment_application",
      status: "succeeded",
      amount: amount.toFixed(2),
      currency: "usd",
      payload: {
        invoiceNumber: invoice.invoiceNumber,
      },
      createdAt: now(),
      settledAt: now(),
    });
  });

  await enqueueOutboxJob({
    jobType: "payment.sync.quickbooks",
    aggregateType: "invoice",
    aggregateId: invoice.id,
    provider: "quickbooks",
    payload: {
      invoiceNumber: invoice.invoiceNumber,
      amount,
    },
  });
  await pushAudit({
    entityType: "invoice",
    entityId: invoice.id,
    eventType: "payment_recorded",
    userId,
  });
  return requireRecord(
    (await listInvoices()).find((entry) => entry.id === invoice.id),
    `Invoice ${invoice.id} not found after payment.`,
  );
}

export async function createPaymentIntentForInvoice(invoiceId: string) {
  const invoice = requireRecord(
    (await listInvoices()).find((entry) => entry.id === invoiceId),
    `Invoice ${invoiceId} not found.`,
  );

  return createStripePaymentIntent({
    invoice,
    customerName: invoice.customerName,
  });
}

export async function addPaymentMethod(payload: AddPaymentMethodInput, userId?: string) {
  const customer = await getCustomerByIdOrNumber(payload.customerNumber);
  const id = createId("pm");
  await db.insert(schema.paymentMethods).values({
    id,
    customerId: customer.id,
    provider: "stripe",
    methodType:
      payload.methodType as typeof schema.paymentMethods.$inferInsert.methodType,
    last4: payload.last4,
    brand: payload.label,
    isDefault: false,
    createdAt: now(),
    updatedAt: now(),
  });
  await pushAudit({
    entityType: "payment_method",
    entityId: id,
    eventType: "created",
    userId,
  });
  return requireRecord(
    (await listPaymentMethods(customer.customerNumber)).find((entry) => entry.id === id),
    `Payment method ${id} not found after creation.`,
  );
}

export async function listPaymentMethods(customerNumber?: string) {
  const rows = await db
    .select({
      id: schema.paymentMethods.id,
      customerNumber: schema.customers.customerNumber,
      provider: schema.paymentMethods.provider,
      methodType: schema.paymentMethods.methodType,
      label: schema.paymentMethods.brand,
      last4: schema.paymentMethods.last4,
      isDefault: schema.paymentMethods.isDefault,
    })
    .from(schema.paymentMethods)
    .innerJoin(schema.customers, eq(schema.paymentMethods.customerId, schema.customers.id))
    .orderBy(desc(schema.paymentMethods.isDefault));

  return rows
    .map((row) => ({
      id: row.id,
      customerNumber: row.customerNumber,
      provider: row.provider,
      methodType: row.methodType,
      label: row.label ?? "Payment method",
      last4: row.last4 ?? "0000",
      isDefault: row.isDefault,
    }))
    .filter((method) =>
      customerNumber ? method.customerNumber === customerNumber : true,
    ) satisfies PaymentMethodRecord[];
}

export async function getPortalOverview(customerNumber: string) {
  const customer = requireRecord(
    (await listCustomers()).find(
      (entry) => entry.customerNumber === customerNumber || entry.id === customerNumber,
    ),
    `Customer ${customerNumber} not found.`,
  );
  const [contracts, invoices, paymentMethods] = await Promise.all([
    listContracts(),
    listInvoices({ customerNumber: customer.customerNumber }),
    listPaymentMethods(customer.customerNumber),
  ]);
  const customerContracts = contracts.filter((contract) => contract.customerName === customer.name);
  const portalSession = await createStripePortalSession({
    customerName: customer.name,
    returnUrl: process.env.APP_URL ?? "http://localhost:3000/portal",
  });

  return {
    customer,
    contracts: customerContracts,
    invoices,
    paymentMethods,
    inspections: [],
    portalSession: portalSession.data,
  };
}

export async function getReports() {
  const [branches, assets, events, invoices] = await Promise.all([
    listBranches(),
    listAssets(),
    listFinancialEvents(),
    listInvoices(),
  ]);

  const utilization: FleetUtilizationRecord[] = branches.map((branch) => {
    const branchAssets = assets.filter((asset) => asset.branch === branch.name);
    const onRentCount = branchAssets.filter((asset) => asset.status === "on_rent").length;
    const fleetCount = branchAssets.length;
    return {
      branch: branch.name,
      fleetCount,
      onRentCount,
      utilizationRate:
        fleetCount === 0 ? 0 : Number(((onRentCount / fleetCount) * 100).toFixed(1)),
    };
  });

  const revenueByType = events.reduce<Record<string, number>>((acc, event) => {
    acc[event.eventType] = (acc[event.eventType] ?? 0) + event.amount;
    return acc;
  }, {});
  const revenueSeries: RevenueSeriesPoint[] = Object.entries(revenueByType).map(
    ([label, revenue]) => ({
      label,
      revenue,
    }),
  );

  const auditRows = await db
    .select()
    .from(schema.auditEvents)
    .orderBy(desc(schema.auditEvents.createdAt))
    .limit(12);
  const auditTrail: AuditEventRecord[] = auditRows.map((row) => ({
    id: row.id,
    entityType: row.entityType,
    entityId: row.entityId,
    eventType: row.eventType,
    userName: row.userId ?? "system",
    timestamp: toIso(row.createdAt) ?? new Date(0).toISOString(),
    metadata: (row.metadata ?? {}) as Record<string, string | number | boolean | null>,
  }));

  return {
    utilization,
    revenueSeries,
    overdueInvoices: invoices.filter((invoice) =>
      ["overdue", "sent", "partially_paid"].includes(invoice.status),
    ),
    auditTrail,
  };
}

export async function exportRevenueReport() {
  return buildRevenueExport(await listFinancialEvents());
}

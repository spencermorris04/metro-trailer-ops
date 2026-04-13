import { createHash } from "node:crypto";

import { and, desc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";

import { db, schema } from "@/lib/db";
import {
  canTransitionAsset,
  canTransitionContract,
} from "@/lib/domain/lifecycle";
import type {
  AssetRecord,
  AssetStatusKey,
  BillingUnitKey,
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
  RevenueSeriesPoint,
  UserRecord,
} from "@/lib/platform-types";
import { ApiError } from "@/lib/server/api";
import { appendAuditEvent } from "@/lib/server/audit";
import {
  buildRevenueExport,
} from "@/lib/server/integration-clients";
import { enqueueOutboxJob } from "@/lib/server/outbox";
import {
  addPaymentMethod as addPaymentMethodRecord,
  createCustomerPortalSession,
  createSetupIntentForCustomer,
  createPaymentIntentForInvoice as createStripePaymentIntentForInvoice,
  listPaymentMethods as listStripePaymentMethods,
  listPaymentTransactions,
  refundPaymentTransaction,
  processStripeWebhookReceipt,
  setDefaultPaymentMethod as setDefaultStripePaymentMethod,
  type CreatePaymentIntentInput,
} from "@/lib/server/payments.production";
import {
  applyPaymentToInvoice,
  buildInvoiceLinesFromFinancialEvents,
  buildReversalEvent,
  calculateInvoiceTotals,
  createOneTimeChargeEvents,
  createRecurringRentEvents,
  deriveInvoiceStatus,
  normalizeInvoiceDate,
  parsePricingAdjustments,
  selectInvoiceableFinancialEvents,
  type BillingCadence,
  type RateCardInput,
} from "@/lib/server/pricing-engine";
import {
  createId,
  now,
  numericToNumber,
  toDate,
  toIso,
} from "@/lib/server/production-utils";

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

type AllocationType = typeof schema.assetAllocations.$inferInsert.allocationType;

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

export type CreateAssetInput = {
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
  idempotencyKey?: string;
};

export type UpdateAssetInput = Partial<CreateAssetInput>;

export type CreateCustomerInput = {
  customerNumber: string;
  name: string;
  customerType: CustomerRecord["customerType"];
  contactInfo?: ContactInput;
  billingAddress: AddressInput;
  locations?: CustomerLocationInput[];
  idempotencyKey?: string;
};

export type UpdateCustomerInput = {
  name?: string;
  customerType?: CustomerRecord["customerType"];
  portalEnabled?: boolean;
  branchCoverage?: string[];
};

export type ContractLineInput = {
  assetId?: string;
  description?: string;
  unitPrice: number;
  unit: string;
  quantity: number;
  startDate: Date;
  endDate?: Date | null;
  adjustments?: string[];
  lineId?: string;
};

export type CreateContractInput = {
  contractNumber: string;
  customerId: string;
  locationId: string;
  branchId: string;
  startDate: Date;
  endDate?: Date | null;
  billingCadence?: BillingCadence;
  paymentTermsDays?: number;
  status?: ContractRecord["status"];
  lines: ContractLineInput[];
  idempotencyKey?: string;
};

export type AmendContractInput = {
  amendmentType: string;
  notes?: string;
  extendedEndDate?: string;
  assetNumbersToAdd?: string[];
  assetNumbersToRemove?: string[];
  effectiveAt?: string | Date;
  idempotencyKey?: string;
};

export type CreateFinancialEventInput = {
  contractId: string;
  eventType: FinancialEventRecord["eventType"];
  description: string;
  amount: number;
  eventDate: Date | string;
  contractLineId?: string;
  assetId?: string;
  externalReference?: string;
  metadata?: Record<string, unknown>;
  reversalForEventId?: string;
  status?: FinancialEventRecord["status"];
  idempotencyKey?: string;
};

export type AddPaymentMethodInput = {
  customerNumber: string;
  stripePaymentMethodId?: string;
  methodType?: "card" | "ach" | "wire" | "check";
  label?: string;
  last4?: string;
  isDefault?: boolean;
  idempotencyKey?: string;
};

export type ContractTransitionOptions = {
  effectiveAt?: Date | null;
  idempotencyKey?: string;
};

export type AssetTransitionOptions = {
  effectiveAt?: Date | null;
  idempotencyKey?: string;
};

function requireRecord<T>(value: T | undefined, message: string) {
  if (!value) {
    throw new ApiError(404, message);
  }

  return value;
}

function notImplemented(feature: string): never {
  throw new ApiError(501, `${feature} is not implemented in the production runtime.`, {
    feature,
  });
}

function createRequestHash(payload: unknown) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function normalizeDateValue(value?: string | Date | null) {
  return value ? requireRecord(toDate(value), "Invalid date supplied.") : now();
}

function farFuture() {
  return new Date("9999-12-31T23:59:59.999Z");
}

function rangesOverlap(
  startA: Date,
  endA: Date | null,
  startB: Date,
  endB: Date | null,
) {
  return startA <= (endB ?? farFuture()) && startB <= (endA ?? farFuture());
}

async function withIdempotency<T extends Record<string, unknown>>(options: {
  key?: string | null;
  requestPath: string;
  requestMethod?: string;
  payload: unknown;
  execute: () => Promise<T>;
}) {
  const key = options.key?.trim();
  const requestMethod = (options.requestMethod ?? "POST").toUpperCase();
  if (!key) {
    return options.execute();
  }

  const requestHash = createRequestHash(options.payload);
  const findExisting = async () =>
    db.query.idempotencyKeys.findFirst({
      where: (table, { and: localAnd, eq: localEq }) =>
        localAnd(
          localEq(table.key, key),
          localEq(table.requestMethod, requestMethod),
          localEq(table.requestPath, options.requestPath),
        ),
    });

  const existing = await findExisting();
  if (existing) {
    if (existing.requestHash !== requestHash) {
      throw new ApiError(409, "Idempotency key was reused with different request content.", {
        requestPath: options.requestPath,
      });
    }
    if (!existing.completedAt) {
      throw new ApiError(409, "An identical request is already in progress.", {
        requestPath: options.requestPath,
      });
    }
    if (existing.responseBody) {
      return existing.responseBody as T;
    }
  } else {
    try {
      await db.insert(schema.idempotencyKeys).values({
        id: createId("idem"),
        key,
        requestPath: options.requestPath,
        requestMethod,
        requestHash,
        lockedAt: now(),
        createdAt: now(),
      });
    } catch {
      const duplicate = await findExisting();
      if (duplicate?.requestHash === requestHash && duplicate.completedAt && duplicate.responseBody) {
        return duplicate.responseBody as T;
      }
      throw new ApiError(409, "An identical request is already being processed.", {
        requestPath: options.requestPath,
      });
    }
  }

  const result = await options.execute();
  await db
    .update(schema.idempotencyKeys)
    .set({
      responseStatus: 200,
      responseBody: result,
      completedAt: now(),
    })
    .where(
      and(
        eq(schema.idempotencyKeys.key, key),
        eq(schema.idempotencyKeys.requestMethod, requestMethod),
        eq(schema.idempotencyKeys.requestPath, options.requestPath),
      ),
    );

  return result;
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
  await appendAuditEvent(event);
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

async function lockContractRow(tx: DbTransaction, contractId: string) {
  await tx.execute(
    sql`select ${schema.contracts.id} from ${schema.contracts} where ${eq(schema.contracts.id, contractId)} for update`,
  );
}

async function lockAssetRows(tx: DbTransaction, assetIds: string[]) {
  if (assetIds.length === 0) {
    return;
  }

  await tx.execute(
    sql`select ${schema.assets.id} from ${schema.assets} where ${inArray(schema.assets.id, assetIds)} for update`,
  );
}

async function getBranchByIdOrName(branchId: string, tx: DbTransaction | typeof db = db) {
  const rows = await tx
    .select()
    .from(schema.branches)
    .where(or(eq(schema.branches.id, branchId), eq(schema.branches.name, branchId)))
    .limit(1);

  return requireRecord(rows[0], `Branch ${branchId} not found.`);
}

async function getLocationById(tx: DbTransaction | typeof db, locationId: string) {
  const rows = await tx
    .select()
    .from(schema.customerLocations)
    .where(eq(schema.customerLocations.id, locationId))
    .limit(1);

  return requireRecord(rows[0], `Location ${locationId} not found.`);
}

async function getContractLines(
  tx: DbTransaction | typeof db,
  contractId: string,
) {
  return tx
    .select()
    .from(schema.contractLines)
    .where(eq(schema.contractLines.contractId, contractId));
}

async function resolveAssetReferences(
  tx: DbTransaction | typeof db,
  references: string[],
) {
  const uniqueReferences = Array.from(new Set(references.filter(Boolean)));
  if (uniqueReferences.length === 0) {
    return new Map<string, typeof schema.assets.$inferSelect>();
  }

  const rows = await tx
    .select()
    .from(schema.assets)
    .where(
      or(
        inArray(schema.assets.id, uniqueReferences),
        inArray(schema.assets.assetNumber, uniqueReferences),
      ),
    );

  const byReference = new Map<string, typeof schema.assets.$inferSelect>();
  rows.forEach((row) => {
    byReference.set(row.id, row);
    byReference.set(row.assetNumber, row);
  });
  return byReference;
}

async function assertAssetsMatchBranch(
  resolvedAssets: Array<typeof schema.assets.$inferSelect>,
  branchId: string,
) {
  const mismatched = resolvedAssets.find((asset) => asset.branchId !== branchId);
  if (mismatched) {
    throw new ApiError(409, "Asset branch does not match the contract branch.", {
      assetNumber: mismatched.assetNumber,
      assetBranchId: mismatched.branchId,
      contractBranchId: branchId,
    });
  }
}

async function getActiveAllocationsForAssets(
  tx: DbTransaction | typeof db,
  assetIds: string[],
) {
  if (assetIds.length === 0) {
    return [] as typeof schema.assetAllocations.$inferSelect[];
  }

  return tx
    .select()
    .from(schema.assetAllocations)
    .where(
      and(
        inArray(schema.assetAllocations.assetId, assetIds),
        eq(schema.assetAllocations.active, true),
      ),
    );
}

async function assertNoAllocationConflicts(
  tx: DbTransaction,
  requests: Array<{
    assetId: string;
    startsAt: Date;
    endsAt: Date | null;
  }>,
  ignoredContractId?: string | null,
) {
  if (requests.length === 0) {
    return;
  }

  for (let index = 0; index < requests.length; index += 1) {
    for (let compareIndex = index + 1; compareIndex < requests.length; compareIndex += 1) {
      if (
        requests[index]?.assetId === requests[compareIndex]?.assetId &&
        rangesOverlap(
          requests[index]!.startsAt,
          requests[index]!.endsAt,
          requests[compareIndex]!.startsAt,
          requests[compareIndex]!.endsAt,
        )
      ) {
        throw new ApiError(409, "The same asset was assigned more than once in an overlapping window.", {
          assetId: requests[index]!.assetId,
        });
      }
    }
  }

  const existing = await getActiveAllocationsForAssets(
    tx,
    Array.from(new Set(requests.map((request) => request.assetId))),
  );
  const conflict = existing.find((allocation) => {
    if (ignoredContractId && allocation.contractId === ignoredContractId) {
      return false;
    }

    return requests.some(
      (request) =>
        request.assetId === allocation.assetId &&
        rangesOverlap(request.startsAt, request.endsAt, allocation.startsAt, allocation.endsAt),
    );
  });

  if (!conflict) {
    return;
  }

  const asset = await getAssetByIdOrNumber(conflict.assetId);
  throw new ApiError(409, "Asset allocation conflict detected.", {
    assetId: conflict.assetId,
    assetNumber: asset.assetNumber,
    allocationType: conflict.allocationType,
    contractId: conflict.contractId,
  });
}

async function upsertContractAllocations(tx: DbTransaction, options: {
  contractId: string;
  lines: typeof schema.contractLines.$inferSelect[];
  allocationType: AllocationType;
  sourceEvent: string;
  effectiveAt?: Date | null;
  endDateOverride?: Date | null;
}) {
  const allocatableLines = options.lines.filter(
    (line): line is typeof schema.contractLines.$inferSelect & { assetId: string } =>
      Boolean(line.assetId),
  );
  if (allocatableLines.length === 0) {
    return;
  }

  await tx.insert(schema.assetAllocations).values(
    allocatableLines.map((line) => ({
      id: createId("alloc"),
      assetId: line.assetId,
      contractId: options.contractId,
      contractLineId: line.id,
      allocationType: options.allocationType,
      startsAt:
        options.effectiveAt && options.effectiveAt > line.startDate
          ? options.effectiveAt
          : line.startDate,
      endsAt: options.endDateOverride === undefined ? line.endDate : options.endDateOverride,
      sourceEvent: options.sourceEvent,
      active: true,
      createdAt: now(),
      updatedAt: now(),
    })),
  );
}

async function deactivateContractAllocations(
  tx: DbTransaction,
  contractId: string,
  endedAt: Date,
) {
  await tx
    .update(schema.assetAllocations)
    .set({
      active: false,
      endsAt: endedAt,
      updatedAt: now(),
    })
    .where(
      and(
        eq(schema.assetAllocations.contractId, contractId),
        eq(schema.assetAllocations.active, true),
      ),
    );
}

function deriveAssetStateFromAllocations(
  asset: typeof schema.assets.$inferSelect,
  allocations: typeof schema.assetAllocations.$inferSelect[],
) {
  if (asset.status === "retired") {
    return {
      status: "retired" as const,
      availability: "unavailable" as const,
      maintenanceStatus: asset.maintenanceStatus,
    };
  }

  const allocationTypes = allocations.map((allocation) => allocation.allocationType);
  if (allocationTypes.includes("maintenance_hold")) {
    return {
      status: "in_maintenance" as const,
      availability: "unavailable" as const,
      maintenanceStatus:
        asset.maintenanceStatus === "clear" ? "scheduled" : asset.maintenanceStatus,
    };
  }
  if (allocationTypes.includes("inspection_hold")) {
    return {
      status: "inspection_hold" as const,
      availability: "limited" as const,
      maintenanceStatus: "inspection_required" as const,
    };
  }
  if (allocationTypes.includes("on_rent") || allocationTypes.includes("swap_in")) {
    return {
      status: "on_rent" as const,
      availability: "unavailable" as const,
      maintenanceStatus: "clear" as const,
    };
  }
  if (allocationTypes.includes("reservation") || allocationTypes.includes("swap_out")) {
    return {
      status: "reserved" as const,
      availability: "limited" as const,
      maintenanceStatus: "clear" as const,
    };
  }

  return {
    status: "available" as const,
    availability: "rentable" as const,
    maintenanceStatus: "clear" as const,
  };
}

async function refreshAssetStates(tx: DbTransaction, assetIds: string[]) {
  const uniqueAssetIds = Array.from(new Set(assetIds.filter(Boolean)));
  if (uniqueAssetIds.length === 0) {
    return;
  }

  const [assets, allocations] = await Promise.all([
    tx.select().from(schema.assets).where(inArray(schema.assets.id, uniqueAssetIds)),
    getActiveAllocationsForAssets(tx, uniqueAssetIds),
  ]);

  const byAssetId = new Map<string, typeof schema.assetAllocations.$inferSelect[]>();
  allocations.forEach((allocation) => {
    const current = byAssetId.get(allocation.assetId) ?? [];
    current.push(allocation);
    byAssetId.set(allocation.assetId, current);
  });

  for (const asset of assets) {
    const derived = deriveAssetStateFromAllocations(asset, byAssetId.get(asset.id) ?? []);
    await tx
      .update(schema.assets)
      .set({
        status: derived.status,
        availability: derived.availability,
        maintenanceStatus: derived.maintenanceStatus,
        updatedAt: now(),
      })
      .where(eq(schema.assets.id, asset.id));
  }
}

async function syncManualAssetAllocation(tx: DbTransaction, options: {
  assetId: string;
  toStatus: AssetStatusKey;
  effectiveAt: Date;
}) {
  const activeAllocations = await getActiveAllocationsForAssets(tx, [options.assetId]);
  const contractBoundAllocations = activeAllocations.filter((allocation) => allocation.contractId);
  if (
    contractBoundAllocations.length > 0 &&
    ["available", "reserved", "on_rent", "inspection_hold", "in_maintenance"].includes(
      options.toStatus,
    )
  ) {
    throw new ApiError(409, "Asset lifecycle is currently governed by active contract allocations.", {
      assetId: options.assetId,
      activeAllocationCount: contractBoundAllocations.length,
    });
  }

  await tx
    .update(schema.assetAllocations)
    .set({
      active: false,
      endsAt: options.effectiveAt,
      updatedAt: now(),
    })
    .where(
      and(
        eq(schema.assetAllocations.assetId, options.assetId),
        eq(schema.assetAllocations.active, true),
        isNull(schema.assetAllocations.contractId),
      ),
    );

  let allocationType: AllocationType | null = null;
  if (options.toStatus === "reserved") {
    allocationType = "reservation";
  } else if (options.toStatus === "on_rent") {
    allocationType = "on_rent";
  } else if (options.toStatus === "inspection_hold") {
    allocationType = "inspection_hold";
  } else if (options.toStatus === "in_maintenance") {
    allocationType = "maintenance_hold";
  }

  if (allocationType) {
    await tx.insert(schema.assetAllocations).values({
      id: createId("alloc"),
      assetId: options.assetId,
      contractId: null,
      contractLineId: null,
      allocationType,
      startsAt: options.effectiveAt,
      endsAt: null,
      sourceEvent: "manual_asset_transition",
      active: true,
      createdAt: now(),
      updatedAt: now(),
    });
  }
}

async function applyContractLifecycleInTransaction(
  tx: DbTransaction,
  contract: typeof schema.contracts.$inferSelect,
  toStatus: ContractStatusKey,
  effectiveAt: Date,
) {
  const lines = await getContractLines(tx, contract.id);
  const assetIds = lines
    .map((line) => line.assetId)
    .filter((value): value is string => Boolean(value));

  await lockAssetRows(tx, assetIds);
  if (toStatus === "reserved" || toStatus === "active") {
    await assertNoAllocationConflicts(
      tx,
      lines
        .filter((line): line is typeof schema.contractLines.$inferSelect & { assetId: string } =>
          Boolean(line.assetId),
        )
        .map((line) => ({
          assetId: line.assetId,
          startsAt: effectiveAt > line.startDate ? effectiveAt : line.startDate,
          endsAt: line.endDate,
        })),
      contract.id,
    );
  }

  await deactivateContractAllocations(tx, contract.id, effectiveAt);

  if (toStatus === "reserved") {
    await upsertContractAllocations(tx, {
      contractId: contract.id,
      lines,
      allocationType: "reservation",
      sourceEvent: "contract_reserved",
      effectiveAt,
    });
  }

  if (toStatus === "active") {
    await upsertContractAllocations(tx, {
      contractId: contract.id,
      lines,
      allocationType: "on_rent",
      sourceEvent: "contract_activated",
      effectiveAt,
    });
  }

  if (toStatus === "completed") {
    await upsertContractAllocations(tx, {
      contractId: contract.id,
      lines,
      allocationType: "inspection_hold",
      sourceEvent: "contract_completed",
      effectiveAt,
      endDateOverride: null,
    });
  }

  await refreshAssetStates(tx, assetIds);
}

type ContractLineFinanceRow = typeof schema.contractLines.$inferSelect & {
  assetType: AssetRecord["type"] | null;
};

async function getContractFinanceRows(contractId: string) {
  return db
    .select({
      id: schema.contractLines.id,
      contractId: schema.contractLines.contractId,
      assetId: schema.contractLines.assetId,
      description: schema.contractLines.description,
      unitPrice: schema.contractLines.unitPrice,
      unit: schema.contractLines.unit,
      quantity: schema.contractLines.quantity,
      startDate: schema.contractLines.startDate,
      endDate: schema.contractLines.endDate,
      adjustments: schema.contractLines.adjustments,
      deliveryFee: schema.contractLines.deliveryFee,
      pickupFee: schema.contractLines.pickupFee,
      createdAt: schema.contractLines.createdAt,
      updatedAt: schema.contractLines.updatedAt,
      assetType: schema.assets.type,
    })
    .from(schema.contractLines)
    .leftJoin(schema.assets, eq(schema.contractLines.assetId, schema.assets.id))
    .where(eq(schema.contractLines.contractId, contractId)) as Promise<
    ContractLineFinanceRow[]
  >;
}

async function getApplicableRateCards(contract: typeof schema.contracts.$inferSelect) {
  const cards = await db
    .select()
    .from(schema.rateCards)
    .where(eq(schema.rateCards.active, true));

  return cards.filter((card) => {
    if (card.scope === "customer") {
      return card.customerId === contract.customerId;
    }

    if (card.scope === "branch") {
      return card.branchId === contract.branchId;
    }

    return true;
  }) satisfies RateCardInput[];
}

function invoiceDueDate(
  invoiceDate: Date,
  paymentTermsDays: number | null | undefined,
) {
  return new Date(
    invoiceDate.getTime() + Math.max(paymentTermsDays ?? 14, 0) * 24 * 60 * 60 * 1000,
  );
}

async function createDerivedFinancialEventsForContract(args: {
  contract: typeof schema.contracts.$inferSelect;
  invoiceDate: Date;
}) {
  const [lineRows, rateCards, existingEvents] = await Promise.all([
    getContractFinanceRows(args.contract.id),
    getApplicableRateCards(args.contract),
    db
      .select()
      .from(schema.financialEvents)
      .where(eq(schema.financialEvents.contractId, args.contract.id)),
  ]);

  const drafts = lineRows.flatMap((line) => {
    const adjustments = parsePricingAdjustments(line.adjustments);
    const description = line.description?.trim() || `Contract line ${line.id}`;
    const commonArgs = {
      contractLineId: line.id,
      assetId: line.assetId,
      description,
      contractDate: args.contract.startDate,
      customerId: args.contract.customerId,
      branchId: args.contract.branchId,
      assetType: line.assetType,
      rateCards,
      existingEvents,
      adjustments,
    };

    return [
      ...createRecurringRentEvents({
        ...commonArgs,
        unit: line.unit as BillingUnitKey,
        quantity: numericToNumber(line.quantity, 1),
        contractLineUnitPrice: numericToNumber(line.unitPrice),
        startDate: line.startDate,
        endDate: line.endDate,
        contractCadence: args.contract.billingCadence,
        invoiceDate: args.invoiceDate,
      }),
      ...createOneTimeChargeEvents({
        ...commonArgs,
        startDate: line.startDate,
        endDate: line.endDate,
        contractLineDeliveryFee: numericToNumber(line.deliveryFee, 0),
        contractLinePickupFee: numericToNumber(line.pickupFee, 0),
      }),
    ];
  });

  if (drafts.length === 0) {
    return [];
  }

  const insertedIds = drafts.map(() => createId("fe"));
  await db.insert(schema.financialEvents).values(
    drafts.map((draft, index) => ({
      id: insertedIds[index],
      contractId: args.contract.id,
      contractLineId: draft.contractLineId ?? null,
      assetId: draft.assetId ?? null,
      eventType: draft.eventType,
      description: draft.description,
      amount: draft.amount.toFixed(2),
      eventDate: draft.eventDate,
      status: draft.status,
      externalReference: draft.externalReference ?? null,
      metadata: draft.metadata,
      createdAt: now(),
      updatedAt: now(),
    })),
  );

  return db
    .select()
    .from(schema.financialEvents)
    .where(inArray(schema.financialEvents.id, insertedIds));
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
  options?: AssetTransitionOptions,
) {
  return withIdempotency({
    key: options?.idempotencyKey,
    requestPath: `/assets/${assetId}/transition`,
    payload: {
      assetId,
      toStatus,
      userId: userId ?? null,
      reason,
      effectiveAt: toIso(options?.effectiveAt ?? null),
    },
    execute: async () => {
      const asset = await getAssetByIdOrNumber(assetId);
      if (!canTransitionAsset(asset.status, toStatus)) {
        throw new ApiError(409, "Asset transition is not allowed.", {
          fromStatus: asset.status,
          toStatus,
        });
      }

      await db.transaction(async (tx) => {
        await lockAssetRows(tx, [asset.id]);
        await syncManualAssetAllocation(tx, {
          assetId: asset.id,
          toStatus,
          effectiveAt: options?.effectiveAt ?? now(),
        });

        const activeAllocations = await getActiveAllocationsForAssets(tx, [asset.id]);
        const hasContractBoundAllocations = activeAllocations.some((allocation) => allocation.contractId);
        const shouldRefreshFromAllocations = toStatus !== "dispatched";
        if (!hasContractBoundAllocations) {
          const derived = assetAvailability(
            toStatus,
            toStatus === "in_maintenance" ? "scheduled" : asset.maintenanceStatus,
          );
          await tx
            .update(schema.assets)
            .set({
              status: toStatus,
              availability: derived.availability,
              maintenanceStatus: derived.maintenanceStatus,
              updatedAt: now(),
            })
            .where(eq(schema.assets.id, asset.id));
        }

        if (shouldRefreshFromAllocations) {
          await refreshAssetStates(tx, [asset.id]);
        }
      });

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
    },
  });
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
  return withIdempotency({
    key: payload.idempotencyKey,
    requestPath: "/contracts",
    payload: {
      ...payload,
      startDate: payload.startDate.toISOString(),
      endDate: payload.endDate?.toISOString() ?? null,
      lines: payload.lines.map((line) => ({
        ...line,
        startDate: line.startDate.toISOString(),
        endDate: line.endDate?.toISOString() ?? null,
      })),
    },
    execute: async () => {
      const contractId = createId("contract");
      const status = payload.status ?? "quoted";

      await db.transaction(async (tx) => {
        const customer = await getCustomerByIdOrNumber(payload.customerId);
        const branch = await getBranchByIdOrName(payload.branchId, tx);
        const location = await getLocationById(tx, payload.locationId);
        if (location.customerId !== customer.id) {
          throw new ApiError(409, "Location does not belong to the contract customer.", {
            locationId: location.id,
            customerId: customer.id,
          });
        }

        const assetRefs = payload.lines
          .map((line) => line.assetId)
          .filter((value): value is string => Boolean(value));
        const resolvedAssets = await resolveAssetReferences(tx, assetRefs);
        const lineAssets = assetRefs.map((reference) =>
          requireRecord(resolvedAssets.get(reference), `Asset ${reference} not found.`),
        );
        await assertAssetsMatchBranch(lineAssets, branch.id);
        await lockAssetRows(
          tx,
          Array.from(new Set(lineAssets.map((asset) => asset.id))),
        );

        const lineRows = payload.lines.map((line) => {
          const resolvedAsset = line.assetId ? resolvedAssets.get(line.assetId) : undefined;
          return {
            id: line.lineId ?? createId("cline"),
            contractId,
            assetId: resolvedAsset?.id ?? null,
            description: line.description ?? null,
            unitPrice: line.unitPrice.toFixed(2),
            unit: line.unit as BillingUnitKey,
            quantity: String(line.quantity),
            startDate: line.startDate,
            endDate: line.endDate ?? payload.endDate ?? null,
            adjustments: { items: line.adjustments ?? [] },
            deliveryFee: null,
            pickupFee: null,
            createdAt: now(),
            updatedAt: now(),
          } satisfies typeof schema.contractLines.$inferInsert;
        });

        if (status === "reserved" || status === "active") {
          await assertNoAllocationConflicts(
            tx,
            lineRows
              .filter((line): line is typeof lineRows[number] & { assetId: string } =>
                Boolean(line.assetId),
              )
              .map((line) => ({
                assetId: line.assetId,
                startsAt: line.startDate,
                endsAt: line.endDate ?? null,
              })),
          );
        }

        await tx.insert(schema.contracts).values({
          id: contractId,
          contractNumber: payload.contractNumber,
          customerId: customer.id,
          locationId: location.id,
          branchId: branch.id,
          startDate: payload.startDate,
          endDate: payload.endDate ?? null,
          billingCadence: payload.billingCadence ?? "monthly_arrears",
          paymentTermsDays: payload.paymentTermsDays ?? 14,
          status,
          quotedAt: now(),
          reservedAt: status === "reserved" ? now() : null,
          activatedAt: status === "active" ? now() : null,
          createdAt: now(),
          updatedAt: now(),
        });
        await tx.insert(schema.contractLines).values(lineRows);

        const insertedContract = requireRecord(
          (
            await tx.select().from(schema.contracts).where(eq(schema.contracts.id, contractId)).limit(1)
          )[0],
          `Contract ${contractId} not found after insert.`,
        );
        await applyContractLifecycleInTransaction(tx, insertedContract, status, payload.startDate);
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
    },
  });
}

export async function transitionContract(
  contractId: string,
  toStatus: ContractStatusKey,
  userId?: string,
  reason = "Manual contract lifecycle transition",
  options?: ContractTransitionOptions,
) {
  return withIdempotency({
    key: options?.idempotencyKey,
    requestPath: `/contracts/${contractId}/transition`,
    payload: {
      contractId,
      toStatus,
      userId: userId ?? null,
      reason,
      effectiveAt: toIso(options?.effectiveAt ?? null),
    },
    execute: async () => {
      const contract = await getContractByIdOrNumber(contractId);
      if (!canTransitionContract(contract.status, toStatus)) {
        throw new ApiError(409, "Contract transition is not allowed.", {
          fromStatus: contract.status,
          toStatus,
        });
      }

      const effectiveAt = options?.effectiveAt ?? now();
      await db.transaction(async (tx) => {
        await lockContractRow(tx, contract.id);
        await tx
          .update(schema.contracts)
          .set({
            status: toStatus,
            reservedAt: toStatus === "reserved" ? effectiveAt : contract.reservedAt,
            activatedAt: toStatus === "active" ? effectiveAt : contract.activatedAt,
            completedAt: toStatus === "completed" ? effectiveAt : contract.completedAt,
            closedAt: toStatus === "closed" ? effectiveAt : contract.closedAt,
            cancelledAt: toStatus === "cancelled" ? effectiveAt : contract.cancelledAt,
            updatedAt: now(),
          })
          .where(eq(schema.contracts.id, contract.id));

        await applyContractLifecycleInTransaction(tx, contract, toStatus, effectiveAt);
      });

      await pushAudit({
        entityType: "contract",
        entityId: contract.id,
        eventType: "status_changed",
        userId,
        metadata: { reason, toStatus, effectiveAt: toIso(options?.effectiveAt ?? null) },
      });

      return requireRecord(
        (await listContracts()).find((entry) => entry.id === contract.id),
        `Contract ${contract.id} not found after transition.`,
      );
    },
  });
}

export async function amendContract(contractId: string, payload: AmendContractInput, userId?: string) {
  return withIdempotency({
    key: payload.idempotencyKey,
    requestPath: `/contracts/${contractId}/amend`,
    payload: {
      contractId,
      ...payload,
      effectiveAt: toIso(normalizeDateValue(payload.effectiveAt ?? null)),
    },
    execute: async () => {
      const contract = await getContractByIdOrNumber(contractId);
      if (contract.status === "closed" || contract.status === "cancelled") {
        throw new ApiError(409, "Closed or cancelled contracts cannot be amended.", {
          contractStatus: contract.status,
        });
      }

      if (payload.amendmentType === "rate_adjustment") {
        notImplemented("Rate-adjustment amendments");
      }

      const amendmentId = createId("amd");
      const effectiveAt = normalizeDateValue(payload.effectiveAt ?? payload.extendedEndDate ?? null);
      const amendmentTypeMap = {
        extension: "extension",
        asset_swap: "asset_swap",
        partial_return: "partial_return",
        rate_adjustment: "rate_adjustment",
      } as const;
      const amendmentTypeKey = payload.amendmentType as keyof typeof amendmentTypeMap;
      const amendmentType = amendmentTypeMap[amendmentTypeKey];
      if (!amendmentType) {
        throw new ApiError(400, `Unsupported amendment type ${payload.amendmentType}.`);
      }
      await db.transaction(async (tx) => {
        await lockContractRow(tx, contract.id);

        const lines = await getContractLines(tx, contract.id);
        const currentAssetIds = lines
          .map((line) => line.assetId)
          .filter((value): value is string => Boolean(value));
        await lockAssetRows(tx, currentAssetIds);

        const deltaPayload: Record<string, unknown> = {
          amendmentType: payload.amendmentType,
          notes: payload.notes ?? null,
          previousEndDate: toIso(contract.endDate),
          nextEndDate: payload.extendedEndDate ?? null,
          assetNumbersToAdd: payload.assetNumbersToAdd ?? [],
          assetNumbersToRemove: payload.assetNumbersToRemove ?? [],
          effectiveAt: toIso(effectiveAt),
        };

        if (payload.amendmentType === "extension") {
          const nextEndDate = requireRecord(
            toDate(payload.extendedEndDate ?? null),
            "Extension amendments require an extendedEndDate.",
          );
          if (contract.endDate && nextEndDate <= contract.endDate) {
            throw new ApiError(409, "Extended end date must be after the current contract end date.");
          }

          await tx
            .update(schema.contracts)
            .set({
              endDate: nextEndDate,
              updatedAt: now(),
            })
            .where(eq(schema.contracts.id, contract.id));
          await tx
            .update(schema.contractLines)
            .set({
              endDate: nextEndDate,
              updatedAt: now(),
            })
            .where(eq(schema.contractLines.contractId, contract.id));
          await tx
            .update(schema.assetAllocations)
            .set({
              endsAt: nextEndDate,
              updatedAt: now(),
            })
            .where(
              and(
                eq(schema.assetAllocations.contractId, contract.id),
                eq(schema.assetAllocations.active, true),
              ),
            );
        } else if (payload.amendmentType === "partial_return" || payload.amendmentType === "asset_swap") {
          const assetsToRemove = payload.assetNumbersToRemove ?? [];
          const assetsToAdd = payload.assetNumbersToAdd ?? [];
          if (assetsToRemove.length === 0) {
            throw new ApiError(409, "This amendment requires assetNumbersToRemove.");
          }

          const resolvedRemoveAssets = await resolveAssetReferences(tx, assetsToRemove);
          const removeAssetIds = assetsToRemove.map((reference) =>
            requireRecord(
              resolvedRemoveAssets.get(reference)?.id,
              `Asset ${reference} could not be resolved for amendment.`,
            ),
          );

          await lockAssetRows(tx, removeAssetIds);
          await tx
            .update(schema.contractLines)
            .set({
              endDate: effectiveAt,
              updatedAt: now(),
            })
            .where(
              and(
                eq(schema.contractLines.contractId, contract.id),
                inArray(schema.contractLines.assetId, removeAssetIds),
              ),
            );
          await tx
            .update(schema.assetAllocations)
            .set({
              active: false,
              endsAt: effectiveAt,
              updatedAt: now(),
            })
            .where(
              and(
                eq(schema.assetAllocations.contractId, contract.id),
                inArray(schema.assetAllocations.assetId, removeAssetIds),
                eq(schema.assetAllocations.active, true),
              ),
            );

          if (contract.status === "active") {
            const returnedLines = await tx
              .select()
              .from(schema.contractLines)
              .where(
                and(
                  eq(schema.contractLines.contractId, contract.id),
                  inArray(schema.contractLines.assetId, removeAssetIds),
                ),
              );
            await upsertContractAllocations(tx, {
              contractId: contract.id,
              lines: returnedLines,
              allocationType: "inspection_hold",
              sourceEvent:
                payload.amendmentType === "asset_swap"
                  ? "contract_swap_out"
                  : "contract_partial_return",
              effectiveAt,
              endDateOverride: null,
            });
          }

          if (payload.amendmentType === "asset_swap") {
            if (assetsToAdd.length === 0) {
              throw new ApiError(409, "Asset swaps require assetNumbersToAdd.");
            }

            const resolvedAddAssets = await resolveAssetReferences(tx, assetsToAdd);
            const addAssets = assetsToAdd.map((reference) =>
              requireRecord(
                resolvedAddAssets.get(reference),
                `Asset ${reference} could not be resolved for swap.`,
              ),
            );
            await assertAssetsMatchBranch(addAssets, contract.branchId);
            await lockAssetRows(
              tx,
              Array.from(new Set(addAssets.map((asset) => asset.id))),
            );

            const templateLine = requireRecord(
              lines.find((line) => removeAssetIds.includes(line.assetId ?? "")),
              "A swap amendment requires an existing contract line to clone pricing from.",
            );
            await assertNoAllocationConflicts(
              tx,
              addAssets.map((asset) => ({
                assetId: asset.id,
                startsAt: effectiveAt,
                endsAt: contract.endDate,
              })),
              contract.id,
            );

            const insertedLines = addAssets.map((asset) => ({
              id: createId("cline"),
              contractId: contract.id,
              assetId: asset.id,
              description: templateLine.description,
              unitPrice: templateLine.unitPrice,
              unit: templateLine.unit,
              quantity: templateLine.quantity,
              startDate: effectiveAt,
              endDate: contract.endDate,
              adjustments: templateLine.adjustments,
              deliveryFee: templateLine.deliveryFee,
              pickupFee: templateLine.pickupFee,
              createdAt: now(),
              updatedAt: now(),
            }) satisfies typeof schema.contractLines.$inferInsert);
            await tx.insert(schema.contractLines).values(insertedLines);

            await upsertContractAllocations(tx, {
              contractId: contract.id,
              lines: insertedLines as Array<typeof schema.contractLines.$inferSelect>,
              allocationType: contract.status === "reserved" ? "reservation" : "on_rent",
              sourceEvent: "contract_swap_in",
              effectiveAt,
            });
            deltaPayload.createdLineIds = insertedLines.map((line) => line.id);
          }
        }

        await tx.insert(schema.contractAmendments).values({
          id: amendmentId,
          contractId: contract.id,
          amendmentType,
          requestedByUserId: userId ?? null,
          notes: payload.notes ?? null,
          deltaPayload,
          effectiveAt,
          approvedByUserId: userId ?? null,
          approvedAt: now(),
          createdAt: now(),
        });

        const refreshedLines = await getContractLines(tx, contract.id);
        await refreshAssetStates(
          tx,
          refreshedLines
            .map((line) => line.assetId)
            .filter((value): value is string => Boolean(value)),
        );
      });

      await pushAudit({
        entityType: "contract",
        entityId: contract.id,
        eventType: "amended",
        userId,
        metadata: {
          amendmentType: payload.amendmentType,
          effectiveAt: toIso(normalizeDateValue(payload.effectiveAt ?? payload.extendedEndDate ?? null)),
        },
      });

      return requireRecord(
        (await listContracts()).find((entry) => entry.id === contract.id),
        `Contract ${contract.id} not found after amendment.`,
      );
    },
  });
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
  let amount = payload.amount;
  let description = payload.description;
  let metadata = payload.metadata ?? {};
  let contractLineId = payload.contractLineId ?? null;
  let assetId = payload.assetId ?? null;

  if (payload.reversalForEventId) {
    const originalEvent = requireRecord(
      await db.query.financialEvents.findFirst({
        where: (table, { eq: localEq }) => localEq(table.id, payload.reversalForEventId!),
      }),
      `Financial event ${payload.reversalForEventId} not found.`,
    );
    const reversal = buildReversalEvent({
      originalEvent: {
        id: originalEvent.id,
        contractLineId: originalEvent.contractLineId,
        assetId: originalEvent.assetId,
        eventType: originalEvent.eventType,
        description: originalEvent.description,
        amount: originalEvent.amount,
        eventDate: originalEvent.eventDate,
        metadata: originalEvent.metadata,
      },
      reversalDate: toDate(payload.eventDate) ?? now(),
      reason: payload.description,
    });

    amount = reversal.amount;
    description = reversal.description;
    metadata = reversal.metadata;
    contractLineId = reversal.contractLineId ?? null;
    assetId = reversal.assetId ?? null;
  }

  const id = createId("fe");
  await db.insert(schema.financialEvents).values({
    id,
    contractId: contract.id,
    contractLineId,
    assetId,
    eventType: payload.eventType,
    description,
    amount: amount.toFixed(2),
    eventDate: toDate(payload.eventDate) ?? now(),
    status: payload.status ?? "posted",
    externalReference: payload.externalReference ?? null,
    metadata,
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

export async function reverseFinancialEvent(
  financialEventId: string,
  reason: string,
  userId?: string,
) {
  const originalEvent = requireRecord(
    await db.query.financialEvents.findFirst({
      where: (table, { eq: localEq }) => localEq(table.id, financialEventId),
    }),
    `Financial event ${financialEventId} not found.`,
  );

  return createFinancialEvent(
    {
      contractId: originalEvent.contractId ?? "",
      contractLineId: originalEvent.contractLineId ?? undefined,
      assetId: originalEvent.assetId ?? undefined,
      eventType: originalEvent.eventType,
      description: reason,
      amount: Math.abs(numericToNumber(originalEvent.amount)),
      eventDate: now(),
      reversalForEventId: originalEvent.id,
      status: "posted",
    },
    userId,
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
      status: deriveInvoiceStatus({
        totalAmount: numericToNumber(row.totalAmount),
        balanceAmount: numericToNumber(row.balanceAmount),
        dueDate: row.dueDate,
        asOf: now(),
      }),
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
  const invoiceDate = normalizeInvoiceDate(now());
  const [derivedEvents, existingEvents] = await Promise.all([
    createDerivedFinancialEventsForContract({
      contract,
      invoiceDate,
    }),
    db
      .select()
      .from(schema.financialEvents)
      .where(eq(schema.financialEvents.contractId, contract.id)),
  ]);
  const invoiceableEvents = selectInvoiceableFinancialEvents({
    events: [...existingEvents, ...derivedEvents],
    invoiceDate,
  });

  if (invoiceableEvents.length === 0) {
    throw new ApiError(409, `Contract ${contract.contractNumber} has no invoiceable events.`);
  }

  const invoiceLines = buildInvoiceLinesFromFinancialEvents(invoiceableEvents);
  const totals = calculateInvoiceTotals(invoiceLines);
  const invoiceId = createId("invoice");
  const invoiceNumber = `INV-${new Date().toISOString().slice(2, 10).replace(/-/g, "")}-${invoiceId.slice(-4)}`;

  await db.transaction(async (tx) => {
    await tx.insert(schema.invoices).values({
      id: invoiceId,
      invoiceNumber,
      customerId: customer.id,
      contractId: contract.id,
      invoiceDate,
      dueDate: invoiceDueDate(invoiceDate, contract.paymentTermsDays),
      status: "draft",
      subtotalAmount: totals.subtotal.toFixed(2),
      taxAmount: totals.taxAmount.toFixed(2),
      totalAmount: totals.totalAmount.toFixed(2),
      balanceAmount: totals.balanceAmount.toFixed(2),
      createdAt: now(),
      updatedAt: now(),
    });

    await tx.insert(schema.invoiceLines).values(
      invoiceLines.map((line) => ({
        id: createId("iline"),
        invoiceId,
        description: line.description,
        quantity: line.quantity.toFixed(2),
        unitPrice: line.unitPrice.toFixed(2),
        totalAmount: line.totalAmount.toFixed(2),
        sourceFinancialEventId: line.sourceFinancialEventId,
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
      .where(inArray(schema.financialEvents.id, invoiceableEvents.map((event) => event.id)));
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
  const nextStatus = deriveInvoiceStatus({
    totalAmount: numericToNumber(invoice.totalAmount),
    balanceAmount: numericToNumber(invoice.balanceAmount),
    dueDate: invoice.dueDate,
    asOf: now(),
  });
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
  const applied = applyPaymentToInvoice({
    totalAmount: numericToNumber(invoice.totalAmount),
    balanceAmount: numericToNumber(invoice.balanceAmount),
    paymentAmount: amount,
    dueDate: invoice.dueDate,
    asOf: now(),
  });
  const paymentTransactionId = createId("pay");

  await db.transaction(async (tx) => {
    await tx
      .update(schema.invoices)
      .set({
        balanceAmount: applied.balanceAmount.toFixed(2),
        status: applied.status,
        updatedAt: now(),
      })
      .where(eq(schema.invoices.id, invoice.id));

    await tx.insert(schema.paymentTransactions).values({
      id: paymentTransactionId,
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
    aggregateType: "payment_transaction",
    aggregateId: paymentTransactionId,
    provider: "quickbooks",
    payload: {
      paymentTransactionId,
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

export async function createPaymentIntentForInvoice(
  input: CreatePaymentIntentInput | string,
) {
  return createStripePaymentIntentForInvoice(input);
}

export async function addPaymentMethod(payload: AddPaymentMethodInput, userId?: string) {
  return addPaymentMethodRecord(payload, userId);
}

export async function listPaymentMethods(customerNumber?: string) {
  return listStripePaymentMethods(customerNumber);
}

export async function createPaymentSetupIntent(customerNumber: string) {
  return createSetupIntentForCustomer(customerNumber);
}

export async function setDefaultPaymentMethod(paymentMethodId: string, userId?: string) {
  return setDefaultStripePaymentMethod(paymentMethodId, userId);
}

export async function listCustomerPaymentHistory(filters?: {
  customerNumber?: string;
  invoiceId?: string;
}) {
  return listPaymentTransactions(filters);
}

export async function processStripeWebhook(receiptId: string) {
  return processStripeWebhookReceipt(receiptId);
}

export async function refundCustomerPayment(
  transactionId: string,
  amount?: number,
  userId?: string,
) {
  return refundPaymentTransaction(transactionId, amount, userId);
}

export async function getPortalOverview(customerNumber: string) {
  const customer = requireRecord(
    (await listCustomers()).find(
      (entry) => entry.customerNumber === customerNumber || entry.id === customerNumber,
    ),
    `Customer ${customerNumber} not found.`,
  );
  const [contracts, invoices, paymentMethods, paymentHistory] = await Promise.all([
    listContracts(),
    listInvoices({ customerNumber: customer.customerNumber }),
    listPaymentMethods(customer.customerNumber),
    listPaymentTransactions({ customerNumber: customer.customerNumber }),
  ]);
  const customerContracts = contracts.filter((contract) => contract.customerName === customer.name);
  const portalSession = await createCustomerPortalSession(
    customer.customerNumber,
    process.env.APP_URL ?? "http://localhost:3000/portal",
  );

  return {
    customer,
    contracts: customerContracts,
    invoices,
    paymentMethods,
    paymentHistory,
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

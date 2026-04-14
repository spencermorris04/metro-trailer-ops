import { createHash } from "node:crypto";

import { and, asc, desc, eq, gt, ilike, inArray, isNull, or, sql } from "drizzle-orm";

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
  WorkOrderRecord,
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
import {
  deriveInvoiceReconciliationState,
  listInvoiceHistory,
  listOpenAccountingIssueReasonCodesForInvoice,
  recordInvoiceHistoryEvent,
} from "@/lib/server/invoice-ops";
import { sendTransactionalEmail } from "@/lib/server/notification-service";
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
import {
  deriveContractCommercialState,
  isActionableSignatureStatus,
} from "@/lib/server/finance-state";
import {
  deriveInventoryAssetState,
  inferManualAllocationTypeForAssetStatus,
  type InventoryAllocationType,
} from "@/lib/server/inventory-state";
import {
  listInspections,
  listWorkOrders,
} from "@/lib/server/platform-operations.production";
import { getTelematicsFreshness } from "@/lib/server/skybitz-jobs";

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
  subtype?: string;
  branchId: string;
  status?: AssetRecord["status"];
  availability?: AssetRecord["availability"];
  maintenanceStatus?: AssetRecord["maintenanceStatus"];
  gpsDeviceId?: string;
  serialNumber?: string;
  dimensions?: string;
  ageInMonths?: number;
  features?: string[];
  record360UnitId?: string;
  skybitzAssetId?: string;
  telematicsProvider?: typeof schema.assets.$inferInsert.telematicsProvider;
  manufacturedAt?: Date;
  purchaseDate?: Date;
  yardZone?: string;
  yardRow?: string;
  yardSlot?: string;
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
  lineUpdates?: Array<{
    lineId: string;
    unitPrice?: number;
    quantity?: number;
    adjustments?: string[];
    deliveryFee?: number | null;
    pickupFee?: number | null;
  }>;
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

export type AssetTransferInput = {
  branchId: string;
  yardZone?: string;
  yardRow?: string;
  yardSlot?: string;
  reason?: string;
  idempotencyKey?: string;
};

function requireRecord<T>(value: T | undefined, message: string) {
  if (!value) {
    throw new ApiError(404, message);
  }

  return value;
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

function yardLocationLabel(asset: {
  branchName?: string | null;
  yardZone?: string | null;
  yardRow?: string | null;
  yardSlot?: string | null;
}) {
  const slot = [asset.yardZone, asset.yardRow, asset.yardSlot]
    .filter((value): value is string => Boolean(value))
    .join("-");

  if (slot && asset.branchName) {
    return `${asset.branchName} yard ${slot}`;
  }

  return asset.branchName ?? null;
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
  return deriveInventoryAssetState({
    isRetired: asset.status === "retired",
    maintenanceStatus: asset.maintenanceStatus,
    allocationTypes: allocations.map(
      (allocation) => allocation.allocationType as InventoryAllocationType,
    ),
  });
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
    ["available", "reserved", "dispatched", "on_rent", "inspection_hold", "in_maintenance"].includes(
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

  const allocationType =
    inferManualAllocationTypeForAssetStatus(options.toStatus) as AllocationType | null;

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
  const [lines, amendments, commercialSummaryMap] = await Promise.all([
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
    getContractCommercialSummaryMap(contractIds),
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
    const commercialSummary =
      commercialSummaryMap.get(contract.id) ??
      buildEmptyContractCommercialSummary(contract.status);

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
      signatureStatus: commercialSummary.signatureStatus,
      latestSignatureRequestId: commercialSummary.latestSignatureRequestId,
      signedDocumentId: commercialSummary.signedDocumentId,
      invoiceCount: commercialSummary.invoiceCount,
      openInvoiceCount: commercialSummary.openInvoiceCount,
      overdueInvoiceCount: commercialSummary.overdueInvoiceCount,
      outstandingBalance: commercialSummary.outstandingBalance,
      uninvoicedEventCount: commercialSummary.uninvoicedEventCount,
      uninvoicedEventAmount: commercialSummary.uninvoicedEventAmount,
      financialExceptions: commercialSummary.financialExceptions,
      lastInvoiceSentAt: commercialSummary.lastInvoiceSentAt,
      reconciliationState: commercialSummary.reconciliationState,
      commercialStage: commercialSummary.commercialStage,
      billingState: commercialSummary.billingState,
      nextAction: commercialSummary.nextAction,
    } satisfies ContractRecord;
  });
}

type ContractCommercialSummary = {
  signatureStatus: string;
  latestSignatureRequestId: string | null;
  signedDocumentId: string | null;
  invoiceCount: number;
  openInvoiceCount: number;
  overdueInvoiceCount: number;
  outstandingBalance: number;
  uninvoicedEventCount: number;
  uninvoicedEventAmount: number;
  financialExceptions: string[];
  lastInvoiceSentAt: string | null;
  reconciliationState: string;
  commercialStage: string;
  billingState: string;
  nextAction: string | null;
  activeContractAllocationCount: number;
};

function buildEmptyContractCommercialSummary(
  contractStatus: ContractStatusKey,
): ContractCommercialSummary {
  const derived = deriveContractCommercialState({
    contractStatus,
    signatureStatus: null,
    invoiceCount: 0,
    openInvoiceCount: 0,
    overdueInvoiceCount: 0,
    outstandingBalance: 0,
    uninvoicedEventCount: 0,
  });

  return {
    signatureStatus: "not_requested",
    latestSignatureRequestId: null,
    signedDocumentId: null,
    invoiceCount: 0,
    openInvoiceCount: 0,
    overdueInvoiceCount: 0,
    outstandingBalance: 0,
    uninvoicedEventCount: 0,
    uninvoicedEventAmount: 0,
    financialExceptions: [],
    lastInvoiceSentAt: null,
    reconciliationState: "pending",
    commercialStage: derived.commercialStage,
    billingState: derived.billingState,
    nextAction: derived.nextAction,
    activeContractAllocationCount: 0,
  };
}

async function getContractCommercialSummaryMap(contractIds: string[]) {
  const uniqueContractIds = Array.from(new Set(contractIds.filter(Boolean)));
  if (uniqueContractIds.length === 0) {
    return new Map<string, ContractCommercialSummary>();
  }

  const [contractRows, signatureRows, invoiceRows, financialEventRows, allocationRows] =
    await Promise.all([
      db
        .select({
          id: schema.contracts.id,
          status: schema.contracts.status,
        })
        .from(schema.contracts)
        .where(inArray(schema.contracts.id, uniqueContractIds)),
      db
        .select({
          id: schema.signatureRequests.id,
          contractId: schema.signatureRequests.contractId,
          status: schema.signatureRequests.status,
          requestedAt: schema.signatureRequests.requestedAt,
          finalDocumentId: schema.signatureRequests.finalDocumentId,
        })
        .from(schema.signatureRequests)
        .where(inArray(schema.signatureRequests.contractId, uniqueContractIds)),
      db
        .select({
          id: schema.invoices.id,
          contractId: schema.invoices.contractId,
          status: schema.invoices.status,
          dueDate: schema.invoices.dueDate,
          totalAmount: schema.invoices.totalAmount,
          balanceAmount: schema.invoices.balanceAmount,
          sentAt: schema.invoices.sentAt,
          quickBooksSyncStatus: schema.invoices.quickBooksSyncStatus,
          quickBooksLastError: schema.invoices.quickBooksLastError,
        })
        .from(schema.invoices)
        .where(inArray(schema.invoices.contractId, uniqueContractIds)),
      db
        .select({
          contractId: schema.financialEvents.contractId,
          status: schema.financialEvents.status,
          amount: schema.financialEvents.amount,
          invoiceId: schema.financialEvents.invoiceId,
        })
        .from(schema.financialEvents)
        .where(inArray(schema.financialEvents.contractId, uniqueContractIds)),
      db
        .select({
          contractId: schema.assetAllocations.contractId,
          active: schema.assetAllocations.active,
        })
        .from(schema.assetAllocations)
        .where(
          and(
            inArray(schema.assetAllocations.contractId, uniqueContractIds),
            eq(schema.assetAllocations.active, true),
          ),
        ),
    ]);

  const signaturesByContract = new Map<
    string,
    Array<{
      id: string;
      status: string;
      requestedAt: Date;
      finalDocumentId: string | null;
    }>
  >();
  for (const row of signatureRows) {
    if (!row.contractId) {
      continue;
    }
    const current = signaturesByContract.get(row.contractId) ?? [];
    current.push({
      id: row.id,
      status: row.status,
      requestedAt: row.requestedAt,
      finalDocumentId: row.finalDocumentId,
    });
    signaturesByContract.set(row.contractId, current);
  }

  const invoicesByContract = new Map<
    string,
    Array<{
      id: string;
      status: string;
      dueDate: Date;
      totalAmount: string;
      balanceAmount: string;
      sentAt: Date | null;
      quickBooksSyncStatus: string;
      quickBooksLastError: string | null;
    }>
  >();
  for (const row of invoiceRows) {
    if (!row.contractId) {
      continue;
    }
    const current = invoicesByContract.get(row.contractId) ?? [];
    current.push({
      id: row.id,
      status: row.status,
      dueDate: row.dueDate,
      totalAmount: row.totalAmount,
      balanceAmount: row.balanceAmount,
      sentAt: row.sentAt,
      quickBooksSyncStatus: row.quickBooksSyncStatus,
      quickBooksLastError: row.quickBooksLastError,
    });
    invoicesByContract.set(row.contractId, current);
  }

  const eventsByContract = new Map<
    string,
    Array<{
      status: string;
      amount: string;
      invoiceId: string | null;
    }>
  >();
  for (const row of financialEventRows) {
    if (!row.contractId) {
      continue;
    }
    const current = eventsByContract.get(row.contractId) ?? [];
    current.push({
      status: row.status,
      amount: row.amount,
      invoiceId: row.invoiceId,
    });
    eventsByContract.set(row.contractId, current);
  }

  const activeAllocationCounts = new Map<string, number>();
  for (const row of allocationRows) {
    if (!row.contractId) {
      continue;
    }
    activeAllocationCounts.set(
      row.contractId,
      (activeAllocationCounts.get(row.contractId) ?? 0) + 1,
    );
  }

  const summaryMap = new Map<string, ContractCommercialSummary>();
  for (const contract of contractRows) {
    const signatures = [...(signaturesByContract.get(contract.id) ?? [])].sort(
      (left, right) => right.requestedAt.getTime() - left.requestedAt.getTime(),
    );
    const actionableSignature = signatures.find((row) =>
      isActionableSignatureStatus(row.status),
    );
    const completedSignature = signatures.find((row) => row.status === "completed");
    const representativeSignature =
      actionableSignature ?? completedSignature ?? signatures[0] ?? null;

    const invoices = invoicesByContract.get(contract.id) ?? [];
    const derivedInvoiceStatuses = invoices.map((invoice) =>
      deriveInvoiceStatus({
        totalAmount: numericToNumber(invoice.totalAmount),
        balanceAmount: numericToNumber(invoice.balanceAmount),
        dueDate: invoice.dueDate,
        asOf: now(),
      }),
    );
    const openInvoiceCount = derivedInvoiceStatuses.filter(
      (status) => status !== "paid" && status !== "voided",
    ).length;
    const overdueInvoiceCount = derivedInvoiceStatuses.filter(
      (status) => status === "overdue",
    ).length;
    const outstandingBalance = Number(
      invoices
        .reduce((sum, invoice) => sum + numericToNumber(invoice.balanceAmount), 0)
        .toFixed(2),
    );
    const financialExceptions = (
      await Promise.all(
        invoices.map((invoice) => listOpenAccountingIssueReasonCodesForInvoice(invoice.id)),
      )
    ).flat();
    const lastInvoiceSentAt = invoices
      .map((invoice) => invoice.sentAt)
      .filter((value): value is Date => value instanceof Date)
      .sort((left, right) => right.getTime() - left.getTime())[0];
    const reconciliationState = deriveInvoiceReconciliationState({
      quickBooksSyncStatus: invoices.every(
        (invoice) => invoice.quickBooksSyncStatus === "success",
      )
        ? "success"
        : invoices.some((invoice) => invoice.quickBooksSyncStatus === "failed")
          ? "failed"
          : "pending",
      quickBooksLastError: invoices.find((invoice) => invoice.quickBooksLastError)
        ?.quickBooksLastError,
      openIssueCount: financialExceptions.length,
    });

    const uninvoicedEvents = (eventsByContract.get(contract.id) ?? []).filter(
      (event) => !event.invoiceId && event.status === "posted",
    );
    const uninvoicedEventAmount = Number(
      uninvoicedEvents
        .reduce((sum, event) => sum + numericToNumber(event.amount), 0)
        .toFixed(2),
    );

    const derived = deriveContractCommercialState({
      contractStatus: contract.status,
      signatureStatus: representativeSignature?.status ?? null,
      invoiceCount: invoices.length,
      openInvoiceCount,
      overdueInvoiceCount,
      outstandingBalance,
      uninvoicedEventCount: uninvoicedEvents.length,
    });

    summaryMap.set(contract.id, {
      signatureStatus: representativeSignature?.status ?? "not_requested",
      latestSignatureRequestId: representativeSignature?.id ?? null,
      signedDocumentId:
        completedSignature?.finalDocumentId ?? representativeSignature?.finalDocumentId ?? null,
      invoiceCount: invoices.length,
      openInvoiceCount,
      overdueInvoiceCount,
      outstandingBalance,
      uninvoicedEventCount: uninvoicedEvents.length,
      uninvoicedEventAmount,
      financialExceptions,
      lastInvoiceSentAt: toIso(lastInvoiceSentAt),
      reconciliationState,
      commercialStage: derived.commercialStage,
      billingState: derived.billingState,
      nextAction: derived.nextAction,
      activeContractAllocationCount: activeAllocationCounts.get(contract.id) ?? 0,
    });
  }

  return summaryMap;
}

async function getContractCommercialSummary(contractId: string) {
  const contract = await getContractByIdOrNumber(contractId);
  return (
    (await getContractCommercialSummaryMap([contract.id])).get(contract.id) ??
    buildEmptyContractCommercialSummary(contract.status)
  );
}

async function assertContractExecutionReady(contractId: string, action: string) {
  const summary = await getContractCommercialSummary(contractId);
  if (!isActionableSignatureStatus(summary.signatureStatus)) {
    return;
  }

  throw new ApiError(409, `Contract has an incomplete signature workflow and cannot ${action}.`, {
    contractId,
    signatureStatus: summary.signatureStatus,
    signatureRequestId: summary.latestSignatureRequestId,
  });
}

async function maybeAutoCloseContract(contractId: string, userId?: string) {
  const contract = await getContractByIdOrNumber(contractId);
  if (contract.status !== "completed") {
    return null;
  }

  const summary = await getContractCommercialSummary(contract.id);
  if (
    summary.outstandingBalance > 0 ||
    summary.openInvoiceCount > 0 ||
    summary.uninvoicedEventCount > 0 ||
    summary.financialExceptions.length > 0 ||
    summary.activeContractAllocationCount > 0
  ) {
    return null;
  }

  return transitionContract(
    contract.id,
    "closed",
    userId,
    "Commercial reconciliation complete.",
  );
}

export async function getDashboardSummary() {
  const [assets, customers, contracts, invoices, workOrders, inspections] = await Promise.all([
    listAssets(),
    listCustomers(),
    listContracts(),
    listInvoices(),
    listWorkOrders(),
    listInspections(),
  ]);

  return {
    runtimeMode: "production",
    assets: assets.length,
    customers: customers.length,
    contracts: contracts.length,
    activeContracts: contracts.filter((contract) => contract.status === "active").length,
    overdueInvoices: invoices.filter((invoice) => invoice.status === "overdue").length,
    openWorkOrders: workOrders.filter(
      (order) => !["verified", "closed", "cancelled"].includes(order.status),
    ).length,
    pendingInspections: inspections.filter((inspection) =>
      ["requested", "in_progress", "needs_review"].includes(inspection.status),
    ).length,
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
  maintenanceStatus?: string;
  type?: string;
}) {
  const clauses = [];
  if (filters?.q) {
    const pattern = `%${filters.q}%`;
    clauses.push(
      or(
        ilike(schema.assets.assetNumber, pattern),
        ilike(schema.assets.type, pattern),
        ilike(sql`coalesce(${schema.assets.subtype}, '')`, pattern),
        ilike(sql`coalesce(${schema.assets.serialNumber}, '')`, pattern),
        ilike(schema.branches.name, pattern),
        ilike(sql`coalesce(${schema.assets.yardZone}, '')`, pattern),
        ilike(sql`coalesce(${schema.assets.yardRow}, '')`, pattern),
        ilike(sql`coalesce(${schema.assets.yardSlot}, '')`, pattern),
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
  if (filters?.maintenanceStatus) {
    clauses.push(
      eq(
        schema.assets.maintenanceStatus,
        filters.maintenanceStatus as AssetRecord["maintenanceStatus"],
      ),
    );
  }
  if (filters?.type) {
    clauses.push(eq(schema.assets.type, filters.type as AssetRecord["type"]));
  }

  const rows = await db
    .select({
      id: schema.assets.id,
      assetNumber: schema.assets.assetNumber,
      type: schema.assets.type,
      subtype: schema.assets.subtype,
      dimensions: schema.assets.dimensions,
      status: schema.assets.status,
      availability: schema.assets.availability,
      maintenanceStatus: schema.assets.maintenanceStatus,
      gpsDeviceId: schema.assets.gpsDeviceId,
      ageInMonths: schema.assets.ageInMonths,
      features: schema.assets.features,
      serialNumber: schema.assets.serialNumber,
      yardZone: schema.assets.yardZone,
      yardRow: schema.assets.yardRow,
      yardSlot: schema.assets.yardSlot,
      record360UnitId: schema.assets.record360UnitId,
      skybitzAssetId: schema.assets.skybitzAssetId,
      branchName: schema.branches.name,
    })
    .from(schema.assets)
    .innerJoin(schema.branches, eq(schema.assets.branchId, schema.branches.id))
    .where(clauses.length > 0 ? and(...clauses) : undefined)
    .orderBy(schema.assets.assetNumber);

  const assetIds = rows.map((asset) => asset.id);
  const [activeAllocations, upcomingReservations, blockingWorkOrders, latestTelematics] =
    await Promise.all([
      assetIds.length === 0
        ? Promise.resolve(
            [] as Array<{
              assetId: string;
              allocationType: InventoryAllocationType;
              startsAt: Date;
              contractNumber: string | null;
              customerName: string | null;
              locationName: string | null;
              dispatchTaskId: string | null;
              dispatchTaskStatus: string | null;
              workOrderId: string | null;
            }>,
          )
        : db
            .select({
              assetId: schema.assetAllocations.assetId,
              allocationType: schema.assetAllocations.allocationType,
              startsAt: schema.assetAllocations.startsAt,
              contractNumber: schema.contracts.contractNumber,
              customerName: schema.customers.name,
              locationName: schema.customerLocations.name,
              dispatchTaskId: schema.dispatchTasks.id,
              dispatchTaskStatus: schema.dispatchTasks.status,
              workOrderId: schema.workOrders.id,
            })
            .from(schema.assetAllocations)
            .leftJoin(
              schema.contracts,
              eq(schema.assetAllocations.contractId, schema.contracts.id),
            )
            .leftJoin(
              schema.customers,
              eq(schema.contracts.customerId, schema.customers.id),
            )
            .leftJoin(
              schema.customerLocations,
              eq(schema.contracts.locationId, schema.customerLocations.id),
            )
            .leftJoin(
              schema.dispatchTasks,
              eq(schema.assetAllocations.dispatchTaskId, schema.dispatchTasks.id),
            )
            .leftJoin(
              schema.workOrders,
              eq(schema.assetAllocations.workOrderId, schema.workOrders.id),
            )
            .where(
              and(
                inArray(schema.assetAllocations.assetId, assetIds),
                eq(schema.assetAllocations.active, true),
              ),
            )
            .orderBy(desc(schema.assetAllocations.startsAt)),
      assetIds.length === 0
        ? Promise.resolve(
            [] as Array<{
              assetId: string;
              startsAt: Date;
              contractNumber: string | null;
            }>,
          )
        : db
            .select({
              assetId: schema.assetAllocations.assetId,
              startsAt: schema.assetAllocations.startsAt,
              contractNumber: schema.contracts.contractNumber,
            })
            .from(schema.assetAllocations)
            .leftJoin(
              schema.contracts,
              eq(schema.assetAllocations.contractId, schema.contracts.id),
            )
            .where(
              and(
                inArray(schema.assetAllocations.assetId, assetIds),
                eq(schema.assetAllocations.active, true),
                eq(schema.assetAllocations.allocationType, "reservation"),
                gt(schema.assetAllocations.startsAt, now()),
              ),
            )
            .orderBy(asc(schema.assetAllocations.startsAt)),
      assetIds.length === 0
        ? Promise.resolve(
            [] as Array<{
              assetId: string;
              workOrderId: string;
              status: WorkOrderRecord["status"];
            }>,
          )
        : db
            .select({
              assetId: schema.workOrders.assetId,
              workOrderId: schema.workOrders.id,
              status: schema.workOrders.status,
            })
            .from(schema.workOrders)
            .where(
              and(
                inArray(schema.workOrders.assetId, assetIds),
                inArray(schema.workOrders.status, [
                  "open",
                  "assigned",
                  "in_progress",
                  "awaiting_parts",
                  "awaiting_vendor",
                  "repair_completed",
                ]),
              ),
            )
            .orderBy(desc(schema.workOrders.updatedAt)),
      assetIds.length === 0
        ? Promise.resolve(
            [] as Array<{
              assetId: string;
              capturedAt: Date;
            }>,
          )
        : db
            .select({
              assetId: schema.telematicsPings.assetId,
              capturedAt: schema.telematicsPings.capturedAt,
            })
            .from(schema.telematicsPings)
            .where(inArray(schema.telematicsPings.assetId, assetIds))
            .orderBy(desc(schema.telematicsPings.capturedAt)),
    ]);

  const activeAllocationsByAsset = new Map<
    string,
    typeof activeAllocations
  >();
  for (const allocation of activeAllocations) {
    const current = activeAllocationsByAsset.get(allocation.assetId) ?? [];
    current.push(allocation);
    activeAllocationsByAsset.set(allocation.assetId, current);
  }

  const nextReservationByAsset = new Map<
    string,
    (typeof upcomingReservations)[number]
  >();
  for (const reservation of upcomingReservations) {
    if (!nextReservationByAsset.has(reservation.assetId)) {
      nextReservationByAsset.set(reservation.assetId, reservation);
    }
  }

  const blockingWorkOrderByAsset = new Map<
    string,
    {
      workOrderId: string;
      statuses: WorkOrderRecord["status"][];
    }
  >();
  for (const workOrder of blockingWorkOrders) {
    const current = blockingWorkOrderByAsset.get(workOrder.assetId);
    if (!current) {
      blockingWorkOrderByAsset.set(workOrder.assetId, {
        workOrderId: workOrder.workOrderId,
        statuses: [workOrder.status],
      });
      continue;
    }

    current.statuses.push(workOrder.status);
  }

  const latestTelematicsByAsset = new Map<
    string,
    (typeof latestTelematics)[number]
  >();
  for (const ping of latestTelematics) {
    if (!latestTelematicsByAsset.has(ping.assetId)) {
      latestTelematicsByAsset.set(ping.assetId, ping);
    }
  }

  return rows.map((asset) => {
    const activeForAsset = activeAllocationsByAsset.get(asset.id) ?? [];
    const blockingWorkOrder = blockingWorkOrderByAsset.get(asset.id) ?? null;
    const derived = deriveInventoryAssetState({
      isRetired: asset.status === "retired",
      maintenanceStatus: asset.maintenanceStatus,
      allocationTypes: activeForAsset.map(
        (allocation) => allocation.allocationType as InventoryAllocationType,
      ),
      blockingWorkOrderStatuses: blockingWorkOrder?.statuses ?? [],
    });
    const activeContract = activeForAsset.find((allocation) => allocation.contractNumber);
    const dispatchHold = activeForAsset.find(
      (allocation) => allocation.allocationType === "dispatch_hold",
    );
    const nextReservation = nextReservationByAsset.get(asset.id) ?? null;
    const latestPing = latestTelematicsByAsset.get(asset.id) ?? null;
    const telematicsFreshness = latestPing
      ? getTelematicsFreshness(latestPing.capturedAt)
      : null;

    let blockingReason: string | null = null;
    let custodyLocation: string | null = yardLocationLabel({
      branchName: asset.branchName,
      yardZone: asset.yardZone,
      yardRow: asset.yardRow,
      yardSlot: asset.yardSlot,
    });
    let locationSource: string | null = custodyLocation ? "yard" : null;

    if (derived.status === "dispatched") {
      blockingReason = dispatchHold?.dispatchTaskId
        ? `Assigned to dispatch task ${dispatchHold.dispatchTaskId}.`
        : "Assigned to dispatch execution.";
      custodyLocation = `${asset.branchName} dispatch lane`;
      locationSource = "dispatch";
    } else if (derived.status === "on_rent") {
      blockingReason = activeContract?.contractNumber
        ? `Active contract ${activeContract.contractNumber}.`
        : "Currently on rent.";
      custodyLocation =
        activeContract?.locationName ?? activeContract?.customerName ?? "Customer site";
      locationSource = "customer_site";
    } else if (derived.status === "reserved") {
      blockingReason = activeContract?.contractNumber
        ? `Reserved on contract ${activeContract.contractNumber}.`
        : "Reserved and excluded from rentable inventory.";
    } else if (derived.status === "inspection_hold") {
      blockingReason = activeContract?.contractNumber
        ? `Awaiting inspection review after contract ${activeContract.contractNumber}.`
        : "Awaiting inspection review.";
      custodyLocation = `${asset.branchName} inspection queue`;
      locationSource = "inspection";
    } else if (derived.status === "in_maintenance") {
      blockingReason = blockingWorkOrder?.workOrderId
        ? `Blocked by work order ${blockingWorkOrder.workOrderId}.`
        : "Blocked by maintenance workflow.";
      custodyLocation = `${asset.branchName} service bay`;
      locationSource = "maintenance";
    } else if (derived.status === "retired") {
      blockingReason = "Retired from active inventory.";
      locationSource = "retired";
    }

    return {
      id: asset.id,
      assetNumber: asset.assetNumber,
      type: asset.type,
      subtype: asset.subtype,
      dimensions:
        typeof asset.dimensions?.summary === "string"
          ? asset.dimensions.summary
          : JSON.stringify(asset.dimensions ?? "Unspecified dimensions"),
      branch: asset.branchName,
      status: derived.status,
      availability: derived.availability,
      maintenanceStatus: derived.maintenanceStatus,
      gpsDeviceId: asset.gpsDeviceId ?? undefined,
      serialNumber: asset.serialNumber,
      yardZone: asset.yardZone,
      yardRow: asset.yardRow,
      yardSlot: asset.yardSlot,
      age:
        asset.ageInMonths !== null && asset.ageInMonths !== undefined
          ? `${asset.ageInMonths} months`
          : "Unknown",
      features: asset.features ?? [],
      custodyLocation,
      locationSource,
      blockingReason,
      allocationTypes: Array.from(
        new Set(activeForAsset.map((allocation) => allocation.allocationType)),
      ),
      activeContractNumber: activeContract?.contractNumber ?? null,
      activeCustomerName: activeContract?.customerName ?? null,
      nextContractNumber: nextReservation?.contractNumber ?? null,
      nextReservationStart: toIso(nextReservation?.startsAt),
      activeDispatchTaskId: dispatchHold?.dispatchTaskId ?? null,
      activeDispatchTaskStatus: dispatchHold?.dispatchTaskStatus ?? null,
      activeWorkOrderId: blockingWorkOrder?.workOrderId ?? null,
      activeWorkOrderStatus: blockingWorkOrder?.statuses[0] ?? null,
      record360UnitId: asset.record360UnitId,
      skybitzAssetId: asset.skybitzAssetId,
      telematicsFreshnessMinutes: telematicsFreshness?.freshnessMinutes ?? null,
      telematicsStale: telematicsFreshness?.stale ?? undefined,
    } satisfies AssetRecord;
  });
}

export async function listAssetsPage(
  filters?: Parameters<typeof listAssets>[0] & {
    page?: number;
    pageSize?: number;
  },
) {
  const page = Math.max(1, filters?.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters?.pageSize ?? 25));
  const data = await listAssets(filters);
  const start = (page - 1) * pageSize;

  return {
    data: data.slice(start, start + pageSize),
    total: data.length,
    page,
    pageSize,
  };
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
    subtype: payload.subtype ?? null,
    branchId: branch.id,
    status,
    availability: payload.availability ?? derived.availability,
    maintenanceStatus: derived.maintenanceStatus,
    gpsDeviceId: payload.gpsDeviceId ?? null,
    serialNumber: payload.serialNumber ?? null,
    dimensions: {
      summary: payload.dimensions ?? "Unspecified dimensions",
    },
    ageInMonths: payload.ageInMonths ?? null,
    features: payload.features ?? [],
    record360UnitId: payload.record360UnitId ?? null,
    skybitzAssetId: payload.skybitzAssetId ?? null,
    telematicsProvider: payload.telematicsProvider ?? null,
    manufacturedAt: payload.manufacturedAt ?? null,
    purchaseDate: payload.purchaseDate ?? null,
    yardZone: payload.yardZone ?? null,
    yardRow: payload.yardRow ?? null,
    yardSlot: payload.yardSlot ?? null,
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
      assetNumber: payload.assetNumber ?? asset.assetNumber,
      type: payload.type ?? asset.type,
      subtype: payload.subtype ?? asset.subtype,
      status,
      availability: payload.availability ?? derived.availability,
      maintenanceStatus: derived.maintenanceStatus,
      gpsDeviceId: payload.gpsDeviceId ?? asset.gpsDeviceId,
      serialNumber: payload.serialNumber ?? asset.serialNumber,
      dimensions: payload.dimensions ? { summary: payload.dimensions } : asset.dimensions,
      ageInMonths: payload.ageInMonths ?? asset.ageInMonths,
      features: payload.features ?? asset.features,
      record360UnitId: payload.record360UnitId ?? asset.record360UnitId,
      skybitzAssetId: payload.skybitzAssetId ?? asset.skybitzAssetId,
      telematicsProvider: payload.telematicsProvider ?? asset.telematicsProvider,
      manufacturedAt: payload.manufacturedAt ?? asset.manufacturedAt,
      purchaseDate: payload.purchaseDate ?? asset.purchaseDate,
      yardZone: payload.yardZone ?? asset.yardZone,
      yardRow: payload.yardRow ?? asset.yardRow,
      yardSlot: payload.yardSlot ?? asset.yardSlot,
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
        if (toStatus === "retired" && hasContractBoundAllocations) {
          throw new ApiError(409, "Assets with active contract allocations cannot be retired.", {
            assetId: asset.id,
          });
        }

        if (toStatus === "retired") {
          await tx
            .update(schema.assets)
            .set({
              status: "retired",
              availability: "unavailable",
              maintenanceStatus: asset.maintenanceStatus,
              updatedAt: now(),
            })
            .where(eq(schema.assets.id, asset.id));
        } else {
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

export async function transferAsset(
  assetId: string,
  payload: AssetTransferInput,
  userId?: string,
) {
  return withIdempotency({
    key: payload.idempotencyKey,
    requestPath: `/assets/${assetId}/transfer`,
    payload,
    execute: async () => {
      const asset = await getAssetByIdOrNumber(assetId);
      const branch = await getBranchByIdOrName(payload.branchId);

      if (asset.branchId === branch.id) {
        throw new ApiError(409, "Asset is already assigned to this branch.", {
          assetId: asset.id,
          branchId: branch.id,
        });
      }

      const activeAllocations = await getActiveAllocationsForAssets(db, [asset.id]);
      if (activeAllocations.length > 0 || asset.status !== "available") {
        throw new ApiError(409, "Only available, unallocated assets can be transferred.", {
          assetId: asset.id,
          status: asset.status,
          activeAllocationCount: activeAllocations.length,
        });
      }

      await db
        .update(schema.assets)
        .set({
          branchId: branch.id,
          yardZone: payload.yardZone ?? null,
          yardRow: payload.yardRow ?? null,
          yardSlot: payload.yardSlot ?? null,
          updatedAt: now(),
        })
        .where(eq(schema.assets.id, asset.id));

      await pushAudit({
        entityType: "asset",
        entityId: asset.id,
        eventType: "transferred",
        userId,
        metadata: {
          fromBranchId: asset.branchId,
          toBranchId: branch.id,
          reason: payload.reason ?? "Branch transfer",
        },
      });

      return requireRecord(
        (await listAssets()).find((entry) => entry.id === asset.id),
        `Asset ${asset.id} not found after transfer.`,
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
      if (toStatus === "active") {
        await assertContractExecutionReady(contract.id, "activate");
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
          lineUpdates: payload.lineUpdates ?? [],
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
        } else if (
          payload.amendmentType === "partial_return" ||
          payload.amendmentType === "asset_swap"
        ) {
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
        } else if (payload.amendmentType === "rate_adjustment") {
          const lineUpdates = payload.lineUpdates ?? [];
          if (lineUpdates.length === 0) {
            throw new ApiError(409, "Rate-adjustment amendments require lineUpdates.");
          }

          const lineIds = lineUpdates.map((line) => line.lineId);
          const matchingLines = lines.filter((line) => lineIds.includes(line.id));
          if (matchingLines.length !== lineUpdates.length) {
            throw new ApiError(404, "One or more contract lines could not be resolved for rate adjustment.", {
              requestedLineIds: lineIds,
            });
          }

          const nextValues = lineUpdates.map((update) => {
            const currentLine = requireRecord(
              matchingLines.find((line) => line.id === update.lineId),
              `Contract line ${update.lineId} not found for rate adjustment.`,
            );

            if (currentLine.assetId && update.quantity !== undefined && update.quantity !== 1) {
              throw new ApiError(409, "Serialized asset contract lines must keep quantity 1.", {
                lineId: currentLine.id,
              });
            }

            return {
              lineId: currentLine.id,
              previousUnitPrice: numericToNumber(currentLine.unitPrice),
              nextUnitPrice:
                update.unitPrice ?? numericToNumber(currentLine.unitPrice),
              previousQuantity: numericToNumber(currentLine.quantity, 1),
              nextQuantity: update.quantity ?? numericToNumber(currentLine.quantity, 1),
              previousAdjustments:
                Array.isArray(currentLine.adjustments?.items)
                  ? currentLine.adjustments.items
                  : [],
              nextAdjustments:
                update.adjustments ??
                (Array.isArray(currentLine.adjustments?.items)
                  ? currentLine.adjustments.items
                  : []),
              previousDeliveryFee: numericToNumber(currentLine.deliveryFee, 0),
              nextDeliveryFee:
                update.deliveryFee ?? numericToNumber(currentLine.deliveryFee, 0),
              previousPickupFee: numericToNumber(currentLine.pickupFee, 0),
              nextPickupFee:
                update.pickupFee ?? numericToNumber(currentLine.pickupFee, 0),
            };
          });

          for (const lineUpdate of lineUpdates) {
            const currentLine = requireRecord(
              matchingLines.find((line) => line.id === lineUpdate.lineId),
              `Contract line ${lineUpdate.lineId} not found for rate adjustment.`,
            );

            await tx
              .update(schema.contractLines)
              .set({
                unitPrice:
                  lineUpdate.unitPrice?.toFixed(2) ?? currentLine.unitPrice,
                quantity:
                  lineUpdate.quantity !== undefined
                    ? String(lineUpdate.quantity)
                    : currentLine.quantity,
                adjustments:
                  lineUpdate.adjustments !== undefined
                    ? { items: lineUpdate.adjustments }
                    : currentLine.adjustments,
                deliveryFee:
                  lineUpdate.deliveryFee !== undefined
                    ? lineUpdate.deliveryFee?.toFixed(2) ?? null
                    : currentLine.deliveryFee,
                pickupFee:
                  lineUpdate.pickupFee !== undefined
                    ? lineUpdate.pickupFee?.toFixed(2) ?? null
                    : currentLine.pickupFee,
                updatedAt: now(),
              })
              .where(eq(schema.contractLines.id, currentLine.id));
          }

          deltaPayload.lineUpdates = nextValues;
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
      deliveryStatus: schema.invoices.deliveryStatus,
      sentAt: schema.invoices.sentAt,
      deliveryChannel: schema.invoices.deliveryChannel,
      quickBooksSyncStatus: schema.invoices.quickBooksSyncStatus,
      quickBooksLastSyncedAt: schema.invoices.quickBooksLastSyncedAt,
      quickBooksLastError: schema.invoices.quickBooksLastError,
      invoiceDate: schema.invoices.invoiceDate,
      dueDate: schema.invoices.dueDate,
      totalAmount: schema.invoices.totalAmount,
      balanceAmount: schema.invoices.balanceAmount,
    })
    .from(schema.invoices)
    .innerJoin(schema.customers, eq(schema.invoices.customerId, schema.customers.id))
    .leftJoin(schema.contracts, eq(schema.invoices.contractId, schema.contracts.id))
    .orderBy(desc(schema.invoices.invoiceDate));

  const issueRows = await db
    .select({
      internalEntityId: schema.accountingSyncIssues.internalEntityId,
      reasonCode: schema.accountingSyncIssues.reasonCode,
    })
    .from(schema.accountingSyncIssues)
    .where(
      and(
        eq(schema.accountingSyncIssues.provider, "quickbooks"),
        eq(schema.accountingSyncIssues.entityType, "invoice"),
        eq(schema.accountingSyncIssues.status, "open"),
      ),
    );
  const issueMap = new Map<string, string[]>();
  for (const row of issueRows) {
    if (!row.internalEntityId) {
      continue;
    }
    const current = issueMap.get(row.internalEntityId) ?? [];
    current.push(row.reasonCode);
    issueMap.set(row.internalEntityId, current);
  }

  return rows
    .filter((row) => {
      const derivedStatus = deriveInvoiceStatus({
        totalAmount: numericToNumber(row.totalAmount),
        balanceAmount: numericToNumber(row.balanceAmount),
        dueDate: row.dueDate,
        asOf: now(),
      });

      if (filters?.status && derivedStatus !== filters.status) {
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
    .map((row) => {
      const derivedStatus = deriveInvoiceStatus({
        totalAmount: numericToNumber(row.totalAmount),
        balanceAmount: numericToNumber(row.balanceAmount),
        dueDate: row.dueDate,
        asOf: now(),
      });
      const openIssues = issueMap.get(row.id) ?? [];

      return {
        id: row.id,
        invoiceNumber: row.invoiceNumber,
        customerName: row.customerName,
        contractNumber: row.contractNumber ?? "Unassigned",
        status: derivedStatus,
        invoiceDate: toIso(row.invoiceDate) ?? new Date(0).toISOString(),
        dueDate: toIso(row.dueDate) ?? new Date(0).toISOString(),
        totalAmount: numericToNumber(row.totalAmount),
        balanceAmount: numericToNumber(row.balanceAmount),
        deliveryStatus: row.deliveryStatus,
        sentAt: toIso(row.sentAt),
        deliveryChannel: row.deliveryChannel,
        quickBooksSyncStatus: row.quickBooksSyncStatus,
        quickBooksLastSyncedAt: toIso(row.quickBooksLastSyncedAt),
        quickBooksLastError: row.quickBooksLastError,
        reconciliationState: deriveInvoiceReconciliationState({
          quickBooksSyncStatus: row.quickBooksSyncStatus,
          quickBooksLastError: row.quickBooksLastError,
          openIssueCount: openIssues.length,
        }),
      };
    }) satisfies InvoiceRecord[];
}

export async function getInvoiceHistory(invoiceId: string) {
  const invoice = await getInvoiceByIdOrNumber(invoiceId);
  return listInvoiceHistory(invoice.id);
}

export async function generateInvoiceForContract(contractId: string, userId?: string) {
  const contract = await getContractByIdOrNumber(contractId);
  await assertContractExecutionReady(contract.id, "generate invoices");
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
      deliveryStatus: "ready_to_send",
      deliveryChannel: "email",
      quickBooksSyncStatus: "pending",
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
  await recordInvoiceHistoryEvent({
    invoiceId,
    eventType: "generated",
    actorUserId: userId ?? null,
    metadata: {
      invoiceNumber,
      contractNumber: contract.contractNumber,
      totalAmount: totals.totalAmount,
    },
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
  const customer = requireRecord(
    await db.query.customers.findFirst({
      where: (table, { eq: localEq }) => localEq(table.id, invoice.customerId),
    }),
    `Customer ${invoice.customerId} not found.`,
  );
  const nextStatus = deriveInvoiceStatus({
    totalAmount: numericToNumber(invoice.totalAmount),
    balanceAmount: numericToNumber(invoice.balanceAmount),
    dueDate: invoice.dueDate,
    asOf: now(),
  });
  const recipientEmail =
    typeof customer.contactInfo?.email === "string" ? customer.contactInfo.email : null;
  const appUrl = process.env.APP_URL?.trim() || "http://localhost:3000";
  const deliveryAttemptedAt = now();
  let deliveryStatus = "delivery_failed";
  let sentAt: Date | null = null;
  let deliveryError: string | null = null;

  if (recipientEmail) {
    const delivery = await sendTransactionalEmail({
      to: recipientEmail,
      subject: `Metro Trailer invoice ${invoice.invoiceNumber}`,
      text: [
        `Invoice ${invoice.invoiceNumber} is ready.`,
        `Amount due: $${numericToNumber(invoice.balanceAmount).toFixed(2)}`,
        `Due date: ${invoice.dueDate.toISOString().slice(0, 10)}`,
        `PDF: ${appUrl}/api/invoices/${invoice.id}/pdf`,
        `Portal: ${appUrl}/portal`,
      ].join("\n"),
      relatedEntityType: "invoice",
      relatedEntityId: invoice.id,
    });

    deliveryStatus =
      delivery.status === "sent"
        ? "sent"
        : delivery.status === "queued"
          ? "ready_to_send"
          : "delivery_failed";
    sentAt = delivery.status === "skipped" ? null : deliveryAttemptedAt;
    deliveryError =
      delivery.status === "skipped" ? "Email configuration is incomplete." : null;
  } else {
    deliveryError = "Customer is missing a billing email address.";
  }

  await db
    .update(schema.invoices)
    .set({
      status: nextStatus,
      deliveryStatus,
      sentAt,
      deliveryChannel: "email",
      quickBooksSyncStatus: "pending",
      quickBooksLastError: deliveryError,
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
  await recordInvoiceHistoryEvent({
    invoiceId: invoice.id,
    eventType: invoice.sentAt ? "resent" : deliveryStatus === "delivery_failed" ? "delivery_failed" : "sent",
    actorUserId: userId ?? null,
    metadata: {
      deliveryChannel: "email",
      deliveryStatus,
      recipientEmail,
      error: deliveryError,
    },
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
  await recordInvoiceHistoryEvent({
    invoiceId: invoice.id,
    eventType: "payment_applied",
    actorUserId: userId ?? null,
    metadata: {
      amount,
      paymentTransactionId,
    },
  });
  if (invoice.contractId) {
    await maybeAutoCloseContract(invoice.contractId, userId);
  }
  return requireRecord(
    (await listInvoices()).find((entry) => entry.id === invoice.id),
    `Invoice ${invoice.id} not found after payment.`,
  );
}

export async function getFinancialOverview() {
  const [contracts, invoices, events] = await Promise.all([
    listContracts(),
    listInvoices(),
    listFinancialEvents(),
  ]);

  const awaitingSignature = contracts.filter((contract) =>
    ["sent", "in_progress", "partially_signed"].includes(contract.signatureStatus ?? ""),
  );
  const readyToInvoice = contracts.filter(
    (contract) =>
      ["active", "completed"].includes(contract.status) &&
      (contract.uninvoicedEventCount ?? 0) > 0,
  );
  const openReceivables = contracts.filter(
    (contract) => (contract.outstandingBalance ?? 0) > 0,
  );
  const readyToClose = contracts.filter(
    (contract) => contract.commercialStage === "ready_to_close",
  );

  return {
    metrics: {
      contractCount: contracts.length,
      awaitingSignature: awaitingSignature.length,
      readyToInvoice: readyToInvoice.length,
      openReceivables: openReceivables.length,
      readyToClose: readyToClose.length,
      outstandingBalance: Number(
        openReceivables
          .reduce((sum, contract) => sum + (contract.outstandingBalance ?? 0), 0)
          .toFixed(2),
      ),
      uninvoicedEventAmount: Number(
        readyToInvoice
          .reduce((sum, contract) => sum + (contract.uninvoicedEventAmount ?? 0), 0)
          .toFixed(2),
      ),
    },
    queues: {
      awaitingSignature: awaitingSignature.slice(0, 8),
      readyToInvoice: readyToInvoice.slice(0, 8),
      openReceivables: openReceivables.slice(0, 8),
      readyToClose: readyToClose.slice(0, 8),
    },
    contracts,
    invoices: invoices.slice(0, 12),
    recentEvents: events.slice(0, 12),
  };
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

import { createHash } from "node:crypto";

import { and, desc, eq, inArray, sql } from "drizzle-orm";

import { db, schema } from "@/lib/db";
import type {
  AssetRecord,
  WorkOrderBillableDispositionKey,
  WorkOrderBillingApprovalStatusKey,
  WorkOrderRecord,
  WorkOrderStatusKey,
  WorkOrderVerificationResultKey,
} from "@/lib/domain/models";
import type {
  DocumentRecord,
  TechnicianWorkloadRecord,
  VendorQueueRecord,
  VerificationQueueRecord,
  WorkOrderDetailRecord,
  WorkOrderEventRecord,
  WorkOrderLaborEntryRecord,
  WorkOrderPartEntryRecord,
  WorkOrderVerificationRecord,
} from "@/lib/platform-types";
import { ApiError } from "@/lib/server/api";
import { appendAuditEvent } from "@/lib/server/audit";
import { enqueueOutboxJob } from "@/lib/server/outbox";
import {
  createId,
  now,
  numericToNumber,
  stableStringify,
  toIso,
} from "@/lib/server/production-utils";
import {
  canGenerateCustomerDamageEvents,
  getVerificationFailureStatus,
  isBlockingMaintenanceStatus,
  normalizeBillableApprovalStatus,
  requireWorkOrderTransition,
} from "@/lib/server/work-orders.lifecycle";

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type WorkOrderListFilters = {
  status?: string;
  branch?: string;
  assetNumber?: string;
};

type LaborEntryInput = {
  technicianUserId?: string;
  hours: number;
  hourlyRate?: number;
  notes?: string;
};

type PartEntryInput = {
  partNumber?: string;
  description: string;
  quantity: number;
  unitCost?: number;
};

export type CreateWorkOrderInput = {
  title: string;
  assetNumber: string;
  branch?: string;
  priority: string;
  source: string;
  sourceType:
    | "manual"
    | "inspection_failure"
    | "dispatch_return"
    | "telematics_alert"
    | "customer_report"
    | "scheduled_maintenance";
  contractNumber?: string;
  inspectionId?: string;
  technicianUserId?: string;
  vendorId?: string;
  vendorName?: string;
  symptomSummary?: string;
  diagnosis?: string;
  repairSummary?: string;
  dueAt?: Date;
  billableDisposition: WorkOrderBillableDispositionKey;
  billingApprovalStatus?: WorkOrderBillingApprovalStatusKey;
  estimatedCost?: number;
  laborHours?: number;
  status?: "open" | "assigned";
  laborEntries?: LaborEntryInput[];
  partEntries?: PartEntryInput[];
  notes?: string;
  idempotencyKey?: string;
};

export type UpdateWorkOrderInput = {
  title?: string;
  priority?: string;
  source?: string;
  sourceType?:
    | "manual"
    | "inspection_failure"
    | "dispatch_return"
    | "telematics_alert"
    | "customer_report"
    | "scheduled_maintenance";
  symptomSummary?: string;
  diagnosis?: string;
  repairSummary?: string;
  dueAt?: Date | null;
  estimatedCost?: number;
  actualCost?: number;
  laborHours?: number;
  billableDisposition?: WorkOrderBillableDispositionKey;
  billingApprovalStatus?: WorkOrderBillingApprovalStatusKey;
  contractNumber?: string | null;
  notes?: string;
  laborEntries?: LaborEntryInput[];
  partEntries?: PartEntryInput[];
  idempotencyKey?: string;
};

export type AssignWorkOrderInput = {
  technicianUserId?: string;
  vendorId?: string;
  vendorName?: string;
  notes?: string;
  idempotencyKey?: string;
};

export type StartWorkOrderInput = {
  notes?: string;
  idempotencyKey?: string;
};

export type AwaitingWorkOrderInput = {
  notes: string;
  idempotencyKey?: string;
};

export type RepairCompleteWorkOrderInput = {
  repairSummary: string;
  notes?: string;
  actualCost?: number;
  laborHours?: number;
  technicianUserId?: string;
  vendorId?: string;
  vendorName?: string;
  laborEntries?: LaborEntryInput[];
  partEntries?: PartEntryInput[];
  idempotencyKey?: string;
};

export type VerifyWorkOrderInput = {
  result: WorkOrderVerificationResultKey;
  notes?: string;
  inspectionId?: string;
  idempotencyKey?: string;
};

export type CancelWorkOrderInput = {
  reason: string;
  idempotencyKey?: string;
};

export type CloseWorkOrderInput = {
  notes?: string;
  idempotencyKey?: string;
};

type WorkOrderJoinedRow = {
  id: string;
  title: string;
  status: WorkOrderStatusKey;
  assetNumber: string;
  branchName: string;
  priority: string | null;
  source: string | null;
  sourceType: CreateWorkOrderInput["sourceType"];
  symptomSummary: string | null;
  diagnosis: string | null;
  repairSummary: string | null;
  contractNumber: string | null;
  customerName: string | null;
  technicianName: string | null;
  technicianUserId: string | null;
  vendorId: string | null;
  vendorName: string | null;
  inspectionId: string | null;
  dueAt: Date | null;
  openedAt: Date;
  assignedAt: Date | null;
  startedAt: Date | null;
  repairCompletedAt: Date | null;
  verifiedAt: Date | null;
  closedAt: Date | null;
  cancelledAt: Date | null;
  billableDisposition: WorkOrderBillableDispositionKey;
  billingApprovalStatus: WorkOrderBillingApprovalStatusKey;
  billableApprovedAt: Date | null;
  estimatedCost: string | null;
  actualCost: string | null;
  laborHours: string | null;
};

type WorkOrderSummarySupport = {
  attachmentCount: number;
  partCount: number;
  verificationOutcome: WorkOrderVerificationResultKey | null;
};

function requireRecord<T>(value: T | undefined | null, message: string) {
  if (!value) {
    throw new ApiError(404, message);
  }

  return value;
}

function createRequestHash(payload: unknown) {
  return createHash("sha256").update(stableStringify(payload)).digest("hex");
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

async function pushAudit(event: {
  entityId: string;
  eventType: string;
  userId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  await appendAuditEvent({
    entityType: "work_order",
    entityId: event.entityId,
    eventType: event.eventType,
    userId: event.userId ?? null,
    metadata: event.metadata ?? {},
  });
}

async function getAssetByIdOrNumber(assetIdOrNumber: string) {
  const asset = await db.query.assets.findFirst({
    where: (table, { eq: localEq, or: localOr }) =>
      localOr(localEq(table.id, assetIdOrNumber), localEq(table.assetNumber, assetIdOrNumber)),
  });

  return requireRecord(asset, `Asset ${assetIdOrNumber} not found.`);
}

async function getContractByIdOrNumber(contractIdOrNumber: string) {
  const contract = await db.query.contracts.findFirst({
    where: (table, { eq: localEq, or: localOr }) =>
      localOr(localEq(table.id, contractIdOrNumber), localEq(table.contractNumber, contractIdOrNumber)),
  });

  return requireRecord(contract, `Contract ${contractIdOrNumber} not found.`);
}

async function getInspectionById(inspectionId: string) {
  const inspection = await db.query.inspections.findFirst({
    where: (table, { eq: localEq }) => localEq(table.id, inspectionId),
  });

  return requireRecord(inspection, `Inspection ${inspectionId} not found.`);
}

async function getVendorByIdOrName(vendorIdOrName: string) {
  const vendor = await db.query.maintenanceVendors.findFirst({
    where: (table, { eq: localEq, or: localOr }) =>
      localOr(localEq(table.id, vendorIdOrName), localEq(table.name, vendorIdOrName)),
  });

  return requireRecord(vendor, `Vendor ${vendorIdOrName} not found.`);
}

async function getWorkOrderEntity(workOrderId: string) {
  const workOrder = await db.query.workOrders.findFirst({
    where: (table, { eq: localEq }) => localEq(table.id, workOrderId),
  });

  return requireRecord(workOrder, `Work order ${workOrderId} not found.`);
}

async function getWorkOrderJoinedRow(workOrderId: string) {
  const [row] = await db
    .select({
      id: schema.workOrders.id,
      title: schema.workOrders.title,
      status: schema.workOrders.status,
      assetNumber: schema.assets.assetNumber,
      branchName: schema.branches.name,
      priority: schema.workOrders.priority,
      source: schema.workOrders.description,
      sourceType: schema.workOrders.sourceType,
      symptomSummary: schema.workOrders.symptomSummary,
      diagnosis: schema.workOrders.diagnosis,
      repairSummary: schema.workOrders.repairSummary,
      contractNumber: schema.contracts.contractNumber,
      customerName: schema.customers.name,
      technicianName: schema.users.name,
      technicianUserId: schema.workOrders.assignedToUserId,
      vendorId: schema.workOrders.vendorId,
      vendorName: schema.workOrders.vendorName,
      inspectionId: schema.workOrders.inspectionId,
      dueAt: schema.workOrders.dueAt,
      openedAt: schema.workOrders.openedAt,
      assignedAt: schema.workOrders.assignedAt,
      startedAt: schema.workOrders.startedAt,
      repairCompletedAt: schema.workOrders.repairCompletedAt,
      verifiedAt: schema.workOrders.verifiedAt,
      closedAt: schema.workOrders.closedAt,
      cancelledAt: schema.workOrders.cancelledAt,
      billableDisposition: schema.workOrders.billableDisposition,
      billingApprovalStatus: schema.workOrders.billingApprovalStatus,
      billableApprovedAt: schema.workOrders.billableApprovedAt,
      estimatedCost: schema.workOrders.estimatedCost,
      actualCost: schema.workOrders.actualCost,
      laborHours: schema.workOrders.laborHours,
    })
    .from(schema.workOrders)
    .innerJoin(schema.assets, eq(schema.workOrders.assetId, schema.assets.id))
    .innerJoin(schema.branches, eq(schema.workOrders.branchId, schema.branches.id))
    .leftJoin(schema.users, eq(schema.workOrders.assignedToUserId, schema.users.id))
    .leftJoin(schema.contracts, eq(schema.workOrders.contractId, schema.contracts.id))
    .leftJoin(schema.customers, eq(schema.contracts.customerId, schema.customers.id))
    .where(eq(schema.workOrders.id, workOrderId))
    .limit(1);

  return requireRecord(row, `Work order ${workOrderId} not found.`);
}

async function lockAssetRow(tx: DbTransaction, assetId: string) {
  await tx.execute(sql`select id from assets where id = ${assetId} for update`);
}

async function lockWorkOrderRow(tx: DbTransaction, workOrderId: string) {
  await tx.execute(sql`select id from work_orders where id = ${workOrderId} for update`);
}

async function upsertVendorTx(
  tx: DbTransaction,
  options: {
    vendorId?: string | null;
    vendorName?: string | null;
  },
) {
  if (options.vendorId) {
    return getVendorByIdOrName(options.vendorId);
  }

  const vendorName = options.vendorName?.trim();
  if (!vendorName) {
    return null;
  }

  const existing = await tx.query.maintenanceVendors.findFirst({
    where: (table, { eq: localEq }) => localEq(table.name, vendorName),
  });
  if (existing) {
    return existing;
  }

  const id = createId("vendor");
  await tx.insert(schema.maintenanceVendors).values({
    id,
    name: vendorName,
    active: true,
    createdAt: now(),
    updatedAt: now(),
  });

  return requireRecord(
    await tx.query.maintenanceVendors.findFirst({
      where: (table, { eq: localEq }) => localEq(table.id, id),
    }),
    `Vendor ${id} not found after creation.`,
  );
}

async function insertWorkOrderEventTx(
  tx: DbTransaction,
  options: {
    workOrderId: string;
    eventType:
      | "created"
      | "updated"
      | "assigned"
      | "status_changed"
      | "started"
      | "awaiting_parts"
      | "awaiting_vendor"
      | "repair_completed"
      | "verified_passed"
      | "verified_failed"
      | "cancelled"
      | "closed"
      | "note_added"
      | "labor_added"
      | "part_added"
      | "billing_reviewed"
      | "attachment_added";
    actorUserId?: string | null;
    fromStatus?: WorkOrderStatusKey | null;
    toStatus?: WorkOrderStatusKey | null;
    notes?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  await tx.insert(schema.workOrderEvents).values({
    id: createId("wo_evt"),
    workOrderId: options.workOrderId,
    eventType: options.eventType,
    actorUserId: options.actorUserId ?? null,
    fromStatus: options.fromStatus ?? null,
    toStatus: options.toStatus ?? null,
    notes: options.notes ?? null,
    metadata: options.metadata ?? {},
    createdAt: now(),
  });
}

async function insertLaborEntriesTx(
  tx: DbTransaction,
  workOrderId: string,
  entries: LaborEntryInput[] | undefined,
  actorUserId?: string,
) {
  if (!entries || entries.length === 0) {
    return 0;
  }

  const insertedAt = now();
  await tx.insert(schema.workOrderLaborEntries).values(
    entries.map((entry) => ({
      id: createId("wo_labor"),
      workOrderId,
      technicianUserId: entry.technicianUserId ?? null,
      hours: entry.hours.toFixed(2),
      hourlyRate: entry.hourlyRate?.toFixed(2) ?? null,
      notes: entry.notes ?? null,
      createdAt: insertedAt,
    })),
  );

  await insertWorkOrderEventTx(tx, {
    workOrderId,
    eventType: "labor_added",
    actorUserId,
    metadata: {
      count: entries.length,
      totalHours: Number(entries.reduce((sum, entry) => sum + entry.hours, 0).toFixed(2)),
    },
  });

  return entries.length;
}

async function insertPartEntriesTx(
  tx: DbTransaction,
  workOrderId: string,
  entries: PartEntryInput[] | undefined,
  actorUserId?: string,
) {
  if (!entries || entries.length === 0) {
    return 0;
  }

  const insertedAt = now();
  await tx.insert(schema.workOrderPartEntries).values(
    entries.map((entry) => ({
      id: createId("wo_part"),
      workOrderId,
      partNumber: entry.partNumber ?? null,
      description: entry.description,
      quantity: entry.quantity.toFixed(2),
      unitCost: entry.unitCost?.toFixed(2) ?? null,
      createdAt: insertedAt,
    })),
  );

  await insertWorkOrderEventTx(tx, {
    workOrderId,
    eventType: "part_added",
    actorUserId,
    metadata: {
      count: entries.length,
      totalQuantity: Number(entries.reduce((sum, entry) => sum + entry.quantity, 0).toFixed(2)),
    },
  });

  return entries.length;
}

async function ensureCustomerDamageEligibility(options: {
  disposition: WorkOrderBillableDispositionKey;
  approvalStatus: WorkOrderBillingApprovalStatusKey;
  contractId: string | null;
}) {
  if (
    options.disposition === "customer_damage" &&
    options.approvalStatus === "approved" &&
    !options.contractId
  ) {
    throw new ApiError(
      409,
      "Customer-damage work orders require a linked contract before approval.",
    );
  }
}

function computeLaborAmount(entries: Array<{ hours: number; hourlyRate: number | null }>) {
  return Number(
    entries
      .reduce((sum, entry) => sum + entry.hours * (entry.hourlyRate ?? 0), 0)
      .toFixed(2),
  );
}

function computePartAmount(entries: Array<{ quantity: number; unitCost: number | null }>) {
  return Number(
    entries
      .reduce((sum, entry) => sum + entry.quantity * (entry.unitCost ?? 0), 0)
      .toFixed(2),
  );
}

export async function syncAssetMaintenanceStateTx(tx: DbTransaction, assetId: string) {
  const [asset] = await tx
    .select({
      id: schema.assets.id,
      status: schema.assets.status,
      maintenanceStatus: schema.assets.maintenanceStatus,
    })
    .from(schema.assets)
    .where(eq(schema.assets.id, assetId))
    .limit(1);

  const resolvedAsset = requireRecord(asset, `Asset ${assetId} not found.`);

  const activeAllocations = await tx
    .select({
      allocationType: schema.assetAllocations.allocationType,
    })
    .from(schema.assetAllocations)
    .where(
      and(
        eq(schema.assetAllocations.assetId, assetId),
        eq(schema.assetAllocations.active, true),
      ),
    );

  const blockingWorkOrders = await tx
    .select({
      status: schema.workOrders.status,
    })
    .from(schema.workOrders)
    .where(
      and(
        eq(schema.workOrders.assetId, assetId),
        inArray(schema.workOrders.status, [
          "open",
          "assigned",
          "in_progress",
          "awaiting_parts",
          "awaiting_vendor",
          "repair_completed",
        ]),
      ),
    );

  const hasMaintenanceHold = activeAllocations.some(
    (allocation) => allocation.allocationType === "maintenance_hold",
  );
  const hasInspectionHold = activeAllocations.some(
    (allocation) => allocation.allocationType === "inspection_hold",
  );
  const hasOnRent = activeAllocations.some(
    (allocation) => allocation.allocationType === "on_rent",
  );
  const hasReservation = activeAllocations.some(
    (allocation) => allocation.allocationType === "reservation",
  );

  let nextStatus: AssetRecord["status"] = resolvedAsset.status as AssetRecord["status"];
  let nextAvailability: AssetRecord["availability"] = "rentable";
  let nextMaintenanceStatus: AssetRecord["maintenanceStatus"] = "clear";

  if (hasMaintenanceHold || blockingWorkOrders.length > 0) {
    nextStatus = "in_maintenance";
    nextAvailability = "unavailable";
    if (blockingWorkOrders.some((workOrder) => workOrder.status === "awaiting_parts")) {
      nextMaintenanceStatus = "waiting_on_parts";
    } else if (blockingWorkOrders.some((workOrder) => workOrder.status === "repair_completed")) {
      nextMaintenanceStatus = "inspection_required";
    } else {
      nextMaintenanceStatus = "under_repair";
    }
  } else if (hasInspectionHold) {
    nextStatus = "inspection_hold";
    nextAvailability = "limited";
    nextMaintenanceStatus = "inspection_required";
  } else if (hasOnRent) {
    nextStatus = "on_rent";
    nextAvailability = "unavailable";
    nextMaintenanceStatus = "clear";
  } else if (hasReservation) {
    nextStatus = "reserved";
    nextAvailability = "limited";
    nextMaintenanceStatus = "clear";
  } else {
    nextStatus = "available";
    nextAvailability = "rentable";
    nextMaintenanceStatus = "clear";
  }

  await tx
    .update(schema.assets)
    .set({
      status: nextStatus,
      availability: nextAvailability,
      maintenanceStatus: nextMaintenanceStatus,
      updatedAt: now(),
    })
    .where(eq(schema.assets.id, assetId));
}

async function insertMaintenanceHoldTx(options: {
  tx: DbTransaction;
  assetId: string;
  contractId?: string | null;
  workOrderId: string;
  sourceEvent: string;
  startsAt?: Date;
  metadata?: Record<string, unknown>;
}) {
  await options.tx.insert(schema.assetAllocations).values({
    id: createId("alloc"),
    assetId: options.assetId,
    contractId: options.contractId ?? null,
    workOrderId: options.workOrderId,
    dispatchTaskId: null,
    allocationType: "maintenance_hold",
    startsAt: options.startsAt ?? now(),
    endsAt: null,
    sourceEvent: options.sourceEvent,
    active: true,
    metadata: options.metadata ?? {},
    createdAt: now(),
    updatedAt: now(),
  });
}

async function releaseMaintenanceHoldTx(
  tx: DbTransaction,
  workOrderId: string,
  endsAt = now(),
) {
  await tx
    .update(schema.assetAllocations)
    .set({
      active: false,
      endsAt,
      updatedAt: now(),
    })
    .where(
      and(
        eq(schema.assetAllocations.workOrderId, workOrderId),
        eq(schema.assetAllocations.allocationType, "maintenance_hold"),
        eq(schema.assetAllocations.active, true),
      ),
    );
}

async function closeInspectionHoldForInspectionTx(
  tx: DbTransaction,
  inspectionId: string,
  endsAt = now(),
) {
  await tx
    .update(schema.assetAllocations)
    .set({
      active: false,
      endsAt,
      updatedAt: now(),
    })
    .where(
      and(
        eq(schema.assetAllocations.allocationType, "inspection_hold"),
        eq(schema.assetAllocations.active, true),
        sql`${schema.assetAllocations.metadata} ->> 'inspectionId' = ${inspectionId}`,
      ),
    );
}

async function enqueueRecord360UnitSync(assetId: string, sourceEvent: string) {
  await enqueueOutboxJob({
    jobType: "asset.sync.record360",
    aggregateType: "asset",
    aggregateId: assetId,
    provider: "record360",
    payload: {
      assetId,
      sourceEvent,
    },
  });
}

async function maybeCreateBillableDamageEventsTx(
  tx: DbTransaction,
  workOrder: typeof schema.workOrders.$inferSelect,
  actorUserId?: string,
) {
  if (
    !canGenerateCustomerDamageEvents({
      disposition: workOrder.billableDisposition,
      approvalStatus: workOrder.billingApprovalStatus,
      contractId: workOrder.contractId ?? null,
    })
  ) {
    return;
  }

  const existing = await tx
    .select({ id: schema.financialEvents.id })
    .from(schema.financialEvents)
    .where(
      and(
        eq(schema.financialEvents.workOrderId, workOrder.id),
        eq(schema.financialEvents.eventType, "damage"),
        inArray(schema.financialEvents.status, ["pending", "posted", "invoiced"]),
      ),
    )
    .limit(1);
  if (existing.length > 0) {
    return;
  }

  const [laborRows, partRows] = await Promise.all([
    tx
      .select({
        hours: schema.workOrderLaborEntries.hours,
        hourlyRate: schema.workOrderLaborEntries.hourlyRate,
      })
      .from(schema.workOrderLaborEntries)
      .where(eq(schema.workOrderLaborEntries.workOrderId, workOrder.id)),
    tx
      .select({
        quantity: schema.workOrderPartEntries.quantity,
        unitCost: schema.workOrderPartEntries.unitCost,
      })
      .from(schema.workOrderPartEntries)
      .where(eq(schema.workOrderPartEntries.workOrderId, workOrder.id)),
  ]);

  const laborAmount = computeLaborAmount(
    laborRows.map((entry) => ({
      hours: numericToNumber(entry.hours),
      hourlyRate: entry.hourlyRate ? numericToNumber(entry.hourlyRate) : null,
    })),
  );
  const partsAmount = computePartAmount(
    partRows.map((entry) => ({
      quantity: numericToNumber(entry.quantity),
      unitCost: entry.unitCost ? numericToNumber(entry.unitCost) : null,
    })),
  );
  const actualCost = numericToNumber(workOrder.actualCost);
  const vendorAmount = Number(Math.max(0, actualCost - laborAmount - partsAmount).toFixed(2));

  const financialEvents: typeof schema.financialEvents.$inferInsert[] = [];
  const baseMetadata = {
    workOrderId: workOrder.id,
    billableDisposition: workOrder.billableDisposition,
    approvedByUserId: workOrder.billableApprovedByUserId ?? null,
    actorUserId: actorUserId ?? null,
  };

  if (laborAmount > 0) {
    financialEvents.push({
      id: createId("fe"),
      contractId: workOrder.contractId,
      assetId: workOrder.assetId,
      workOrderId: workOrder.id,
      eventType: "damage",
      description: `Work order labor recovery for ${workOrder.title}`,
      amount: laborAmount.toFixed(2),
      eventDate: now(),
      status: "posted",
      metadata: {
        ...baseMetadata,
        component: "labor",
      },
      createdAt: now(),
      updatedAt: now(),
    });
  }

  if (partsAmount > 0) {
    financialEvents.push({
      id: createId("fe"),
      contractId: workOrder.contractId,
      assetId: workOrder.assetId,
      workOrderId: workOrder.id,
      eventType: "damage",
      description: `Work order parts recovery for ${workOrder.title}`,
      amount: partsAmount.toFixed(2),
      eventDate: now(),
      status: "posted",
      metadata: {
        ...baseMetadata,
        component: "parts",
      },
      createdAt: now(),
      updatedAt: now(),
    });
  }

  if (vendorAmount > 0) {
    financialEvents.push({
      id: createId("fe"),
      contractId: workOrder.contractId,
      assetId: workOrder.assetId,
      workOrderId: workOrder.id,
      eventType: "damage",
      description: `Work order vendor recovery for ${workOrder.title}`,
      amount: vendorAmount.toFixed(2),
      eventDate: now(),
      status: "posted",
      metadata: {
        ...baseMetadata,
        component: "vendor",
      },
      createdAt: now(),
      updatedAt: now(),
    });
  }

  if (financialEvents.length === 0) {
    return;
  }

  await tx.insert(schema.financialEvents).values(financialEvents);
  await insertWorkOrderEventTx(tx, {
    workOrderId: workOrder.id,
    eventType: "billing_reviewed",
    actorUserId,
    notes: "Approved customer-damage financial events posted.",
    metadata: {
      eventCount: financialEvents.length,
      totalAmount: Number(
        financialEvents.reduce((sum, event) => sum + numericToNumber(event.amount), 0).toFixed(2),
      ),
    },
  });
}

function mapWorkOrderSummary(
  row: WorkOrderJoinedRow,
  support: WorkOrderSummarySupport,
): WorkOrderRecord {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    assetNumber: row.assetNumber,
    branch: row.branchName,
    priority: row.priority ?? "Normal",
    source: row.source ?? "Manual entry",
    sourceType: row.sourceType,
    symptomSummary: row.symptomSummary,
    diagnosis: row.diagnosis,
    repairSummary: row.repairSummary,
    contractNumber: row.contractNumber,
    customerName: row.customerName,
    technicianName: row.technicianName,
    technicianUserId: row.technicianUserId,
    vendorId: row.vendorId,
    vendorName: row.vendorName,
    inspectionId: row.inspectionId,
    dueAt: toIso(row.dueAt),
    openedAt: toIso(row.openedAt),
    assignedAt: toIso(row.assignedAt),
    startedAt: toIso(row.startedAt),
    repairCompletedAt: toIso(row.repairCompletedAt),
    verifiedAt: toIso(row.verifiedAt),
    closedAt: toIso(row.closedAt),
    cancelledAt: toIso(row.cancelledAt),
    verificationOutcome: support.verificationOutcome,
    billableDisposition: row.billableDisposition,
    billingApprovalStatus: row.billingApprovalStatus,
    billableApprovedAt: toIso(row.billableApprovedAt),
    attachmentCount: support.attachmentCount,
    estimatedCost: row.estimatedCost ? numericToNumber(row.estimatedCost) : null,
    actualCost: row.actualCost ? numericToNumber(row.actualCost) : null,
    laborHours: row.laborHours ? numericToNumber(row.laborHours) : null,
    partCount: support.partCount,
  };
}

async function getSummarySupport(workOrderIds: string[]) {
  if (workOrderIds.length === 0) {
    return {
      attachmentCountById: new Map<string, number>(),
      partCountById: new Map<string, number>(),
      verificationOutcomeById: new Map<string, WorkOrderVerificationResultKey | null>(),
    };
  }

  const [attachments, parts, verifications] = await Promise.all([
    db
      .select({
        workOrderId: schema.documents.workOrderId,
      })
      .from(schema.documents)
      .where(inArray(schema.documents.workOrderId, workOrderIds)),
    db
      .select({
        workOrderId: schema.workOrderPartEntries.workOrderId,
      })
      .from(schema.workOrderPartEntries)
      .where(inArray(schema.workOrderPartEntries.workOrderId, workOrderIds)),
    db
      .select({
        workOrderId: schema.workOrderVerifications.workOrderId,
        result: schema.workOrderVerifications.result,
      })
      .from(schema.workOrderVerifications)
      .where(inArray(schema.workOrderVerifications.workOrderId, workOrderIds))
      .orderBy(desc(schema.workOrderVerifications.createdAt)),
  ]);

  const attachmentCountById = new Map<string, number>();
  for (const row of attachments) {
    if (!row.workOrderId) {
      continue;
    }
    attachmentCountById.set(
      row.workOrderId,
      (attachmentCountById.get(row.workOrderId) ?? 0) + 1,
    );
  }

  const partCountById = new Map<string, number>();
  for (const row of parts) {
    partCountById.set(row.workOrderId, (partCountById.get(row.workOrderId) ?? 0) + 1);
  }

  const verificationOutcomeById = new Map<string, WorkOrderVerificationResultKey | null>();
  for (const row of verifications) {
    if (!verificationOutcomeById.has(row.workOrderId)) {
      verificationOutcomeById.set(row.workOrderId, row.result);
    }
  }

  return {
    attachmentCountById,
    partCountById,
    verificationOutcomeById,
  };
}

async function buildWorkOrderSummaryById(workOrderId: string) {
  const row = await getWorkOrderJoinedRow(workOrderId);
  const support = await getSummarySupport([workOrderId]);
  return mapWorkOrderSummary(row, {
    attachmentCount: support.attachmentCountById.get(workOrderId) ?? 0,
    partCount: support.partCountById.get(workOrderId) ?? 0,
    verificationOutcome: support.verificationOutcomeById.get(workOrderId) ?? null,
  });
}

function mapDocumentRecord(row: {
  id: string;
  contractNumber: string | null;
  customerName: string | null;
  documentType: string;
  status: string;
  filename: string;
  objectLocked: boolean;
  lockedAt: Date | null;
  source: string;
  hash: string;
  createdAt: Date;
  contentType: string;
  sizeBytes: number;
  storageProvider: "inline" | "s3";
  storageBucket: string | null;
  storageKey: string | null;
  storageVersionId: string | null;
  storageETag: string | null;
  retentionUntil: Date | null;
  relatedSignatureRequestId: string | null;
  supersedesDocumentId: string | null;
  retentionMode: "governance" | "compliance" | null;
  metadata: Record<string, unknown> | null;
  workOrderId: string | null;
}) {
  return {
    id: row.id,
    contractNumber: row.contractNumber ?? "Unassigned",
    customerName: row.customerName ?? "Unknown",
    documentType: row.documentType,
    status: row.status,
    filename: row.filename,
    objectLocked: row.objectLocked,
    lockedAt: toIso(row.lockedAt),
    source: row.source,
    hash: row.hash,
    createdAt: toIso(row.createdAt) ?? new Date(0).toISOString(),
    contentType: row.contentType,
    sizeBytes: row.sizeBytes,
    contentBase64: null,
    storageProvider: row.storageProvider,
    storageBucket: row.storageBucket,
    storageKey: row.storageKey,
    storageVersionId: row.storageVersionId,
    storageETag: row.storageETag,
    retentionUntil: toIso(row.retentionUntil),
    relatedSignatureRequestId: row.relatedSignatureRequestId,
    supersedesDocumentId: row.supersedesDocumentId,
    retentionMode: row.retentionMode ?? "compliance",
    metadata: (row.metadata ?? {}) as Record<string, string | number | boolean | null>,
    workOrderId: row.workOrderId,
  } satisfies DocumentRecord;
}

function mapWorkOrderLaborEntry(row: {
  id: string;
  technicianUserId: string | null;
  technicianName: string | null;
  hours: string;
  hourlyRate: string | null;
  notes: string | null;
  createdAt: Date;
}) {
  return {
    id: row.id,
    technicianUserId: row.technicianUserId,
    technicianName: row.technicianName,
    hours: numericToNumber(row.hours),
    hourlyRate: row.hourlyRate ? numericToNumber(row.hourlyRate) : null,
    notes: row.notes,
    createdAt: toIso(row.createdAt) ?? new Date(0).toISOString(),
  } satisfies WorkOrderLaborEntryRecord;
}

function mapWorkOrderPartEntry(row: {
  id: string;
  partNumber: string | null;
  description: string;
  quantity: string;
  unitCost: string | null;
  createdAt: Date;
}) {
  return {
    id: row.id,
    partNumber: row.partNumber,
    description: row.description,
    quantity: numericToNumber(row.quantity),
    unitCost: row.unitCost ? numericToNumber(row.unitCost) : null,
    createdAt: toIso(row.createdAt) ?? new Date(0).toISOString(),
  } satisfies WorkOrderPartEntryRecord;
}

function mapWorkOrderEvent(row: {
  id: string;
  eventType: string;
  actorUserId: string | null;
  actorName: string | null;
  fromStatus: string | null;
  toStatus: string | null;
  notes: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}) {
  return {
    id: row.id,
    type: row.eventType,
    actorUserId: row.actorUserId,
    actorName: row.actorName,
    fromStatus: row.fromStatus,
    toStatus: row.toStatus,
    notes: row.notes,
    metadata: (row.metadata ?? {}) as Record<string, string | number | boolean | null>,
    createdAt: toIso(row.createdAt) ?? new Date(0).toISOString(),
  } satisfies WorkOrderEventRecord;
}

function mapWorkOrderVerification(row: {
  id: string;
  verifierUserId: string | null;
  verifierName: string | null;
  result: "passed" | "failed";
  notes: string | null;
  inspectionId: string | null;
  createdAt: Date;
}) {
  return {
    id: row.id,
    verifierUserId: row.verifierUserId,
    verifierName: row.verifierName,
    result: row.result,
    notes: row.notes,
    inspectionId: row.inspectionId,
    createdAt: toIso(row.createdAt) ?? new Date(0).toISOString(),
  } satisfies WorkOrderVerificationRecord;
}

export async function listWorkOrders(filters?: WorkOrderListFilters) {
  const rows = await db
    .select({
      id: schema.workOrders.id,
      title: schema.workOrders.title,
      status: schema.workOrders.status,
      assetNumber: schema.assets.assetNumber,
      branchName: schema.branches.name,
      priority: schema.workOrders.priority,
      source: schema.workOrders.description,
      sourceType: schema.workOrders.sourceType,
      symptomSummary: schema.workOrders.symptomSummary,
      diagnosis: schema.workOrders.diagnosis,
      repairSummary: schema.workOrders.repairSummary,
      contractNumber: schema.contracts.contractNumber,
      customerName: schema.customers.name,
      technicianName: schema.users.name,
      technicianUserId: schema.workOrders.assignedToUserId,
      vendorId: schema.workOrders.vendorId,
      vendorName: schema.workOrders.vendorName,
      inspectionId: schema.workOrders.inspectionId,
      dueAt: schema.workOrders.dueAt,
      openedAt: schema.workOrders.openedAt,
      assignedAt: schema.workOrders.assignedAt,
      startedAt: schema.workOrders.startedAt,
      repairCompletedAt: schema.workOrders.repairCompletedAt,
      verifiedAt: schema.workOrders.verifiedAt,
      closedAt: schema.workOrders.closedAt,
      cancelledAt: schema.workOrders.cancelledAt,
      billableDisposition: schema.workOrders.billableDisposition,
      billingApprovalStatus: schema.workOrders.billingApprovalStatus,
      billableApprovedAt: schema.workOrders.billableApprovedAt,
      estimatedCost: schema.workOrders.estimatedCost,
      actualCost: schema.workOrders.actualCost,
      laborHours: schema.workOrders.laborHours,
    })
    .from(schema.workOrders)
    .innerJoin(schema.assets, eq(schema.workOrders.assetId, schema.assets.id))
    .innerJoin(schema.branches, eq(schema.workOrders.branchId, schema.branches.id))
    .leftJoin(schema.users, eq(schema.workOrders.assignedToUserId, schema.users.id))
    .leftJoin(schema.contracts, eq(schema.workOrders.contractId, schema.contracts.id))
    .leftJoin(schema.customers, eq(schema.contracts.customerId, schema.customers.id))
    .orderBy(desc(schema.workOrders.updatedAt), desc(schema.workOrders.createdAt));

  const support = await getSummarySupport(rows.map((row) => row.id));

  return rows
    .map((row) =>
      mapWorkOrderSummary(row, {
        attachmentCount: support.attachmentCountById.get(row.id) ?? 0,
        partCount: support.partCountById.get(row.id) ?? 0,
        verificationOutcome: support.verificationOutcomeById.get(row.id) ?? null,
      }),
    )
    .filter((row) => {
      if (filters?.status && row.status !== filters.status) {
        return false;
      }
      if (filters?.branch && row.branch !== filters.branch) {
        return false;
      }
      if (filters?.assetNumber && row.assetNumber !== filters.assetNumber) {
        return false;
      }
      return true;
    });
}

export async function getWorkOrderDetail(workOrderId: string) {
  const [summary, laborRows, partRows, eventRows, verificationRows, attachmentRows] =
    await Promise.all([
      buildWorkOrderSummaryById(workOrderId),
      db
        .select({
          id: schema.workOrderLaborEntries.id,
          technicianUserId: schema.workOrderLaborEntries.technicianUserId,
          technicianName: schema.users.name,
          hours: schema.workOrderLaborEntries.hours,
          hourlyRate: schema.workOrderLaborEntries.hourlyRate,
          notes: schema.workOrderLaborEntries.notes,
          createdAt: schema.workOrderLaborEntries.createdAt,
        })
        .from(schema.workOrderLaborEntries)
        .leftJoin(schema.users, eq(schema.workOrderLaborEntries.technicianUserId, schema.users.id))
        .where(eq(schema.workOrderLaborEntries.workOrderId, workOrderId))
        .orderBy(desc(schema.workOrderLaborEntries.createdAt)),
      db
        .select({
          id: schema.workOrderPartEntries.id,
          partNumber: schema.workOrderPartEntries.partNumber,
          description: schema.workOrderPartEntries.description,
          quantity: schema.workOrderPartEntries.quantity,
          unitCost: schema.workOrderPartEntries.unitCost,
          createdAt: schema.workOrderPartEntries.createdAt,
        })
        .from(schema.workOrderPartEntries)
        .where(eq(schema.workOrderPartEntries.workOrderId, workOrderId))
        .orderBy(desc(schema.workOrderPartEntries.createdAt)),
      db
        .select({
          id: schema.workOrderEvents.id,
          eventType: schema.workOrderEvents.eventType,
          actorUserId: schema.workOrderEvents.actorUserId,
          actorName: schema.users.name,
          fromStatus: schema.workOrderEvents.fromStatus,
          toStatus: schema.workOrderEvents.toStatus,
          notes: schema.workOrderEvents.notes,
          metadata: schema.workOrderEvents.metadata,
          createdAt: schema.workOrderEvents.createdAt,
        })
        .from(schema.workOrderEvents)
        .leftJoin(schema.users, eq(schema.workOrderEvents.actorUserId, schema.users.id))
        .where(eq(schema.workOrderEvents.workOrderId, workOrderId))
        .orderBy(desc(schema.workOrderEvents.createdAt)),
      db
        .select({
          id: schema.workOrderVerifications.id,
          verifierUserId: schema.workOrderVerifications.verifierUserId,
          verifierName: schema.users.name,
          result: schema.workOrderVerifications.result,
          notes: schema.workOrderVerifications.notes,
          inspectionId: schema.workOrderVerifications.inspectionId,
          createdAt: schema.workOrderVerifications.createdAt,
        })
        .from(schema.workOrderVerifications)
        .leftJoin(schema.users, eq(schema.workOrderVerifications.verifierUserId, schema.users.id))
        .where(eq(schema.workOrderVerifications.workOrderId, workOrderId))
        .orderBy(desc(schema.workOrderVerifications.createdAt)),
      db
        .select({
          id: schema.documents.id,
          contractNumber: schema.contracts.contractNumber,
          customerName: schema.customers.name,
          documentType: schema.documents.documentType,
          status: schema.documents.status,
          filename: schema.documents.filename,
          objectLocked: schema.documents.objectLocked,
          lockedAt: schema.documents.lockedAt,
          source: schema.documents.source,
          hash: schema.documents.hash,
          createdAt: schema.documents.createdAt,
          contentType: schema.documents.contentType,
          sizeBytes: schema.documents.sizeBytes,
          storageProvider: schema.documents.storageProvider,
          storageBucket: schema.documents.storageBucket,
          storageKey: schema.documents.storageKey,
          storageVersionId: schema.documents.storageVersionId,
          storageETag: schema.documents.storageETag,
          retentionUntil: schema.documents.retentionUntil,
          relatedSignatureRequestId: schema.documents.relatedSignatureRequestId,
          supersedesDocumentId: schema.documents.supersedesDocumentId,
          retentionMode: schema.documents.retentionMode,
          metadata: schema.documents.metadata,
          workOrderId: schema.documents.workOrderId,
        })
        .from(schema.documents)
        .leftJoin(schema.contracts, eq(schema.documents.contractId, schema.contracts.id))
        .leftJoin(schema.customers, eq(schema.documents.customerId, schema.customers.id))
        .where(eq(schema.documents.workOrderId, workOrderId))
        .orderBy(desc(schema.documents.createdAt)),
    ]);

  return {
    ...summary,
    laborEntries: laborRows.map(mapWorkOrderLaborEntry),
    partEntries: partRows.map(mapWorkOrderPartEntry),
    events: eventRows.map(mapWorkOrderEvent),
    verifications: verificationRows.map(mapWorkOrderVerification),
    attachments: attachmentRows.map(mapDocumentRecord),
  } satisfies WorkOrderDetailRecord;
}

async function buildLaborAndPartMetadataFromPayload(options: {
  laborEntries?: LaborEntryInput[];
  partEntries?: PartEntryInput[];
}) {
  return {
    laborEntryCount: options.laborEntries?.length ?? 0,
    partEntryCount: options.partEntries?.length ?? 0,
  };
}

export async function createWorkOrder(
  payload: CreateWorkOrderInput,
  userId?: string,
) {
  return withIdempotency({
    key: payload.idempotencyKey,
    requestPath: "/api/work-orders",
    payload,
    execute: async () => {
      const [asset, inspection, contract] = await Promise.all([
        getAssetByIdOrNumber(payload.assetNumber),
        payload.inspectionId ? getInspectionById(payload.inspectionId) : Promise.resolve(null),
        payload.contractNumber ? getContractByIdOrNumber(payload.contractNumber) : Promise.resolve(null),
      ]);

      if (payload.branch) {
        const branch = await db.query.branches.findFirst({
          where: (table, { eq: localEq, or: localOr }) =>
            localOr(
              localEq(table.id, payload.branch as string),
              localEq(table.name, payload.branch as string),
              localEq(table.code, payload.branch as string),
            ),
        });
        if (!branch || branch.id !== asset.branchId) {
          throw new ApiError(
            409,
            "Work order branch is derived from the asset and cannot be overridden.",
          );
        }
      }

      const billingApprovalStatus = normalizeBillableApprovalStatus({
        disposition: payload.billableDisposition,
        approvalStatus: payload.billingApprovalStatus,
      });

      await ensureCustomerDamageEligibility({
        disposition: payload.billableDisposition,
        approvalStatus: billingApprovalStatus,
        contractId: contract?.id ?? inspection?.contractId ?? null,
      });

      const workOrderId = createId("wo");
      await db.transaction(async (tx) => {
        await lockAssetRow(tx, asset.id);
        const vendor = await upsertVendorTx(tx, {
          vendorId: payload.vendorId,
          vendorName: payload.vendorName,
        });
        const status =
          payload.status ?? (payload.technicianUserId || vendor ? "assigned" : "open");

        await tx.insert(schema.workOrders).values({
          id: workOrderId,
          assetId: asset.id,
          contractId: contract?.id ?? inspection?.contractId ?? null,
          inspectionId: inspection?.id ?? null,
          branchId: asset.branchId,
          assignedToUserId: payload.technicianUserId ?? null,
          vendorId: vendor?.id ?? null,
          sourceType: payload.sourceType,
          status,
          priority: payload.priority,
          title: payload.title,
          description: payload.source,
          symptomSummary: payload.symptomSummary ?? payload.notes ?? null,
          diagnosis: payload.diagnosis ?? null,
          repairSummary: payload.repairSummary ?? null,
          vendorName: vendor?.name ?? payload.vendorName ?? null,
          dueAt: payload.dueAt ?? null,
          billableDisposition: payload.billableDisposition,
          billingApprovalStatus,
          billableApprovedByUserId:
            billingApprovalStatus === "approved" ? (userId ?? null) : null,
          billableApprovedAt: billingApprovalStatus === "approved" ? now() : null,
          estimatedCost: payload.estimatedCost?.toFixed(2) ?? null,
          laborHours: payload.laborHours?.toFixed(2) ?? null,
          parts: null,
          openedAt: now(),
          assignedAt: status === "assigned" ? now() : null,
          createdAt: now(),
          updatedAt: now(),
        });

        await insertMaintenanceHoldTx({
          tx,
          assetId: asset.id,
          contractId: contract?.id ?? inspection?.contractId ?? null,
          workOrderId,
          sourceEvent:
            payload.sourceType === "inspection_failure"
              ? "inspection_failed"
              : "work_order_opened",
          metadata: {
            inspectionId: inspection?.id ?? null,
          },
        });

        if (inspection?.id) {
          await closeInspectionHoldForInspectionTx(tx, inspection.id);
        }

        await insertLaborEntriesTx(tx, workOrderId, payload.laborEntries, userId);
        await insertPartEntriesTx(tx, workOrderId, payload.partEntries, userId);
        await insertWorkOrderEventTx(tx, {
          workOrderId,
          eventType: "created",
          actorUserId: userId,
          toStatus: status,
          notes: payload.notes ?? null,
          metadata: {
            source: payload.source,
            sourceType: payload.sourceType,
            contractNumber: contract?.contractNumber ?? null,
            inspectionId: inspection?.id ?? null,
            vendorId: vendor?.id ?? null,
            ...await buildLaborAndPartMetadataFromPayload(payload),
          },
        });
        if (status === "assigned") {
          await insertWorkOrderEventTx(tx, {
            workOrderId,
            eventType: "assigned",
            actorUserId: userId,
            fromStatus: "open",
            toStatus: "assigned",
            notes: payload.notes ?? null,
            metadata: {
              technicianUserId: payload.technicianUserId ?? null,
              vendorId: vendor?.id ?? null,
            },
          });
        }

        await syncAssetMaintenanceStateTx(tx, asset.id);
      });

      await enqueueRecord360UnitSync(asset.id, "work_order_opened");
      await pushAudit({
        entityId: workOrderId,
        eventType: "created",
        userId,
        metadata: {
          assetId: asset.id,
          assetNumber: asset.assetNumber,
          sourceType: payload.sourceType,
          contractId: contract?.id ?? inspection?.contractId ?? null,
        },
      });

      return {
        workOrder: await buildWorkOrderSummaryById(workOrderId),
      };
    },
  }).then((result) => result.workOrder);
}

export async function createInspectionFailureWorkOrderTx(
  tx: DbTransaction,
  options: {
    assetId: string;
    inspectionId: string;
    contractId?: string | null;
    damageSummary: string;
    damageScore?: number | null;
    completedAt: Date;
    userId?: string;
  },
) {
  const existing = await tx.query.workOrders.findFirst({
    where: (table, { and: localAnd, eq: localEq, inArray: localInArray }) =>
      localAnd(
        localEq(table.inspectionId, options.inspectionId),
        localInArray(table.status, [
          "open",
          "assigned",
          "in_progress",
          "awaiting_parts",
          "awaiting_vendor",
          "repair_completed",
          "verified",
          "closed",
        ]),
      ),
  });

  if (existing) {
    return existing.id;
  }

  const asset = requireRecord(
    await tx.query.assets.findFirst({
      where: (table, { eq: localEq }) => localEq(table.id, options.assetId),
    }),
    `Asset ${options.assetId} not found.`,
  );
  const inspection = requireRecord(
    await tx.query.inspections.findFirst({
      where: (table, { eq: localEq }) => localEq(table.id, options.inspectionId),
    }),
    `Inspection ${options.inspectionId} not found.`,
  );

  const workOrderId = createId("wo");
  await tx.insert(schema.workOrders).values({
    id: workOrderId,
    assetId: asset.id,
    contractId: options.contractId ?? null,
    inspectionId: inspection.id,
    branchId: asset.branchId,
    sourceType: "inspection_failure",
    status: "open",
    priority: (options.damageScore ?? 0) >= 70 ? "Critical" : "High",
    title: `Repair from ${inspection.inspectionType.replace(/_/g, " ")} inspection`,
    description: "Inspection failure auto-created maintenance order.",
    symptomSummary: options.damageSummary,
    openedAt: options.completedAt,
    createdAt: now(),
    updatedAt: now(),
  });

  await insertMaintenanceHoldTx({
    tx,
    assetId: asset.id,
    contractId: options.contractId ?? null,
    workOrderId,
    sourceEvent: "inspection_failed",
    startsAt: options.completedAt,
    metadata: {
      inspectionId: inspection.id,
      damageScore: options.damageScore ?? null,
    },
  });

  await insertWorkOrderEventTx(tx, {
    workOrderId,
    eventType: "created",
    actorUserId: options.userId,
    toStatus: "open",
    notes: options.damageSummary,
    metadata: {
      sourceType: "inspection_failure",
      inspectionId: inspection.id,
      damageScore: options.damageScore ?? null,
    },
  });

  return workOrderId;
}

export async function updateWorkOrder(
  workOrderId: string,
  payload: UpdateWorkOrderInput,
  userId?: string,
) {
  return withIdempotency({
    key: payload.idempotencyKey,
    requestPath: `/api/work-orders/${workOrderId}`,
    requestMethod: "PATCH",
    payload,
    execute: async () => {
      await db.transaction(async (tx) => {
        const workOrder = requireRecord(
          await tx.query.workOrders.findFirst({
            where: (table, { eq: localEq }) => localEq(table.id, workOrderId),
          }),
          `Work order ${workOrderId} not found.`,
        );
        await lockWorkOrderRow(tx, workOrderId);
        await lockAssetRow(tx, workOrder.assetId);

        if (
          (payload.laborEntries?.length || payload.partEntries?.length) &&
          !["assigned", "in_progress", "awaiting_parts", "awaiting_vendor", "repair_completed"].includes(workOrder.status)
        ) {
          throw new ApiError(
            409,
            "Labor and part entries can only be recorded while the work order is active or awaiting verification.",
          );
        }

        const contract =
          payload.contractNumber === undefined
            ? null
            : payload.contractNumber
              ? await getContractByIdOrNumber(payload.contractNumber)
              : null;
        const nextDisposition = payload.billableDisposition ?? workOrder.billableDisposition;
        const nextApprovalStatus = normalizeBillableApprovalStatus({
          disposition: nextDisposition,
          approvalStatus: payload.billingApprovalStatus ?? workOrder.billingApprovalStatus,
        });

        await ensureCustomerDamageEligibility({
          disposition: nextDisposition,
          approvalStatus: nextApprovalStatus,
          contractId: contract?.id ?? workOrder.contractId ?? null,
        });

        const isBillingApprovalChange =
          payload.billingApprovalStatus !== undefined &&
          payload.billingApprovalStatus !== workOrder.billingApprovalStatus;

        await tx
          .update(schema.workOrders)
          .set({
            title: payload.title ?? workOrder.title,
            priority: payload.priority ?? workOrder.priority,
            description: payload.source ?? workOrder.description,
            sourceType: payload.sourceType ?? workOrder.sourceType,
            symptomSummary:
              payload.symptomSummary === undefined
                ? workOrder.symptomSummary
                : payload.symptomSummary,
            diagnosis:
              payload.diagnosis === undefined ? workOrder.diagnosis : payload.diagnosis,
            repairSummary:
              payload.repairSummary === undefined
                ? workOrder.repairSummary
                : payload.repairSummary,
            dueAt: payload.dueAt === undefined ? workOrder.dueAt : payload.dueAt,
            estimatedCost:
              payload.estimatedCost === undefined
                ? workOrder.estimatedCost
                : payload.estimatedCost.toFixed(2),
            actualCost:
              payload.actualCost === undefined
                ? workOrder.actualCost
                : payload.actualCost.toFixed(2),
            laborHours:
              payload.laborHours === undefined
                ? workOrder.laborHours
                : payload.laborHours.toFixed(2),
            billableDisposition: nextDisposition,
            billingApprovalStatus: nextApprovalStatus,
            billableApprovedByUserId:
              nextApprovalStatus === "approved"
                ? (userId ?? workOrder.billableApprovedByUserId ?? null)
                : workOrder.billableApprovedByUserId,
            billableApprovedAt:
              nextApprovalStatus === "approved"
                ? (workOrder.billableApprovedAt ?? now())
                : workOrder.billableApprovedAt,
            contractId:
              payload.contractNumber === undefined
                ? workOrder.contractId
                : contract?.id ?? null,
            updatedAt: now(),
          })
          .where(eq(schema.workOrders.id, workOrderId));

        await insertLaborEntriesTx(tx, workOrderId, payload.laborEntries, userId);
        await insertPartEntriesTx(tx, workOrderId, payload.partEntries, userId);
        await insertWorkOrderEventTx(tx, {
          workOrderId,
          eventType: isBillingApprovalChange ? "billing_reviewed" : "updated",
          actorUserId: userId,
          fromStatus: workOrder.status,
          toStatus: workOrder.status,
          notes: payload.notes ?? null,
          metadata: {
            changedFields: Object.keys(payload),
            contractId:
              payload.contractNumber === undefined
                ? workOrder.contractId
                : contract?.id ?? null,
            billingApprovalStatus: nextApprovalStatus,
          },
        });
      });

      await pushAudit({
        entityId: workOrderId,
        eventType: "updated",
        userId,
        metadata: {
          changedFields: Object.keys(payload),
        },
      });

      return {
        workOrder: await buildWorkOrderSummaryById(workOrderId),
      };
    },
  }).then((result) => result.workOrder);
}

export async function assignWorkOrder(
  workOrderId: string,
  payload: AssignWorkOrderInput,
  userId?: string,
) {
  return withIdempotency({
    key: payload.idempotencyKey,
    requestPath: `/api/work-orders/${workOrderId}/assign`,
    payload,
    execute: async () => {
      await db.transaction(async (tx) => {
        const workOrder = requireRecord(
          await tx.query.workOrders.findFirst({
            where: (table, { eq: localEq }) => localEq(table.id, workOrderId),
          }),
          `Work order ${workOrderId} not found.`,
        );
        await lockWorkOrderRow(tx, workOrderId);

        const nextStatus = requireWorkOrderTransition({
          currentStatus: workOrder.status,
          action: "assign",
        });
        const vendor = await upsertVendorTx(tx, {
          vendorId: payload.vendorId,
          vendorName: payload.vendorName,
        });

        if (!payload.technicianUserId && !vendor) {
          throw new ApiError(400, "Assignment requires either a technician or a vendor.");
        }

        await tx
          .update(schema.workOrders)
          .set({
            assignedToUserId: payload.technicianUserId ?? workOrder.assignedToUserId,
            vendorId: vendor?.id ?? workOrder.vendorId,
            vendorName: vendor?.name ?? payload.vendorName ?? workOrder.vendorName,
            status: nextStatus,
            assignedAt: workOrder.assignedAt ?? now(),
            updatedAt: now(),
          })
          .where(eq(schema.workOrders.id, workOrderId));

        await insertWorkOrderEventTx(tx, {
          workOrderId,
          eventType: "assigned",
          actorUserId: userId,
          fromStatus: workOrder.status,
          toStatus: nextStatus,
          notes: payload.notes ?? null,
          metadata: {
            technicianUserId: payload.technicianUserId ?? workOrder.assignedToUserId,
            vendorId: vendor?.id ?? workOrder.vendorId,
          },
        });
      });

      await pushAudit({
        entityId: workOrderId,
        eventType: "assigned",
        userId,
      });

      return {
        workOrder: await buildWorkOrderSummaryById(workOrderId),
      };
    },
  }).then((result) => result.workOrder);
}

async function mutateWorkOrderStatus(options: {
  workOrderId: string;
  action:
    | "start"
    | "awaiting_parts"
    | "awaiting_vendor"
    | "repair_complete"
    | "verify"
    | "cancel"
    | "close";
  userId?: string;
  notes?: string | null;
  metadata?: Record<string, unknown>;
  verificationResult?: WorkOrderVerificationResultKey;
  update?: (
    tx: DbTransaction,
    current: typeof schema.workOrders.$inferSelect,
    nextStatus: WorkOrderStatusKey,
  ) => Promise<void>;
}) {
  await db.transaction(async (tx) => {
    const workOrder = requireRecord(
      await tx.query.workOrders.findFirst({
        where: (table, { eq: localEq }) => localEq(table.id, options.workOrderId),
      }),
      `Work order ${options.workOrderId} not found.`,
    );
    await lockWorkOrderRow(tx, workOrder.id);
    await lockAssetRow(tx, workOrder.assetId);

    const nextStatus = requireWorkOrderTransition({
      currentStatus: workOrder.status,
      action: options.action,
      hasAssignment: Boolean(workOrder.assignedToUserId || workOrder.vendorId),
      verificationResult: options.verificationResult,
    });

    if (options.update) {
      await options.update(tx, workOrder, nextStatus);
    }

    const updatePatch: Partial<typeof schema.workOrders.$inferInsert> = {
      status: nextStatus,
      updatedAt: now(),
    };
    if (options.action === "start") {
      updatePatch.startedAt = workOrder.startedAt ?? now();
    }
    if (options.action === "repair_complete") {
      updatePatch.completedAt = now();
      updatePatch.repairCompletedAt = now();
    }
    if (options.action === "verify" && options.verificationResult === "passed") {
      updatePatch.verifiedAt = now();
      updatePatch.verifiedByUserId = options.userId ?? null;
    }
    if (options.action === "close") {
      updatePatch.closedAt = now();
    }
    if (options.action === "cancel") {
      updatePatch.cancelledAt = now();
    }

    await tx
      .update(schema.workOrders)
      .set(updatePatch)
      .where(eq(schema.workOrders.id, workOrder.id));

    if (options.action === "verify") {
      await tx.insert(schema.workOrderVerifications).values({
        id: createId("wo_verify"),
        workOrderId: workOrder.id,
        verifierUserId: options.userId ?? null,
        result: options.verificationResult!,
        notes: options.notes ?? null,
        inspectionId:
          typeof options.metadata?.inspectionId === "string"
            ? options.metadata.inspectionId
            : null,
        createdAt: now(),
      });
    }

    if (options.action === "verify" && options.verificationResult === "passed") {
      await releaseMaintenanceHoldTx(tx, workOrder.id);
      await maybeCreateBillableDamageEventsTx(
        tx,
        {
          ...workOrder,
          status: nextStatus,
          verifiedAt: now(),
          verifiedByUserId: options.userId ?? null,
        },
        options.userId,
      );
    }

    if (options.action === "cancel") {
      await releaseMaintenanceHoldTx(tx, workOrder.id);
    }

    if (options.action === "verify" && options.verificationResult === "failed") {
      await tx
        .update(schema.workOrders)
        .set({
          verifiedAt: null,
          verifiedByUserId: null,
          updatedAt: now(),
        })
        .where(eq(schema.workOrders.id, workOrder.id));
    }

    await insertWorkOrderEventTx(tx, {
      workOrderId: workOrder.id,
      eventType:
        options.action === "start"
          ? "started"
          : options.action === "awaiting_parts"
            ? "awaiting_parts"
            : options.action === "awaiting_vendor"
              ? "awaiting_vendor"
              : options.action === "repair_complete"
                ? "repair_completed"
                : options.action === "verify"
                  ? options.verificationResult === "passed"
                    ? "verified_passed"
                    : "verified_failed"
                  : options.action === "cancel"
                    ? "cancelled"
                    : "closed",
      actorUserId: options.userId,
      fromStatus: workOrder.status,
      toStatus: nextStatus,
      notes: options.notes ?? null,
      metadata: options.metadata ?? {},
    });

    await syncAssetMaintenanceStateTx(tx, workOrder.assetId);
  });

  const summary = await buildWorkOrderSummaryById(options.workOrderId);
  const entity = await getWorkOrderEntity(options.workOrderId);
  await enqueueRecord360UnitSync(
    entity.assetId,
    options.action === "verify" && options.verificationResult === "passed"
      ? "work_order_verified"
      : `work_order_${options.action}`,
  );

  await pushAudit({
    entityId: options.workOrderId,
    eventType:
      options.action === "verify"
        ? options.verificationResult === "passed"
          ? "verified"
          : "verification_failed"
        : options.action,
    userId: options.userId,
    metadata: options.metadata,
  });

  return summary;
}

export async function startWorkOrder(
  workOrderId: string,
  payload: StartWorkOrderInput,
  userId?: string,
) {
  return withIdempotency({
    key: payload.idempotencyKey,
    requestPath: `/api/work-orders/${workOrderId}/start`,
    payload,
    execute: async () => ({
      workOrder: await mutateWorkOrderStatus({
        workOrderId,
        action: "start",
        userId,
        notes: payload.notes ?? null,
      }),
    }),
  }).then((result) => result.workOrder);
}

export async function markWorkOrderAwaitingParts(
  workOrderId: string,
  payload: AwaitingWorkOrderInput,
  userId?: string,
) {
  return withIdempotency({
    key: payload.idempotencyKey,
    requestPath: `/api/work-orders/${workOrderId}/awaiting-parts`,
    payload,
    execute: async () => ({
      workOrder: await mutateWorkOrderStatus({
        workOrderId,
        action: "awaiting_parts",
        userId,
        notes: payload.notes,
      }),
    }),
  }).then((result) => result.workOrder);
}

export async function markWorkOrderAwaitingVendor(
  workOrderId: string,
  payload: AwaitingWorkOrderInput,
  userId?: string,
) {
  return withIdempotency({
    key: payload.idempotencyKey,
    requestPath: `/api/work-orders/${workOrderId}/awaiting-vendor`,
    payload,
    execute: async () => ({
      workOrder: await mutateWorkOrderStatus({
        workOrderId,
        action: "awaiting_vendor",
        userId,
        notes: payload.notes,
      }),
    }),
  }).then((result) => result.workOrder);
}

export async function markWorkOrderRepairComplete(
  workOrderId: string,
  payload: RepairCompleteWorkOrderInput,
  userId?: string,
) {
  return withIdempotency({
    key: payload.idempotencyKey,
    requestPath: `/api/work-orders/${workOrderId}/repair-complete`,
    payload,
    execute: async () => ({
      workOrder: await mutateWorkOrderStatus({
        workOrderId,
        action: "repair_complete",
        userId,
        notes: payload.notes ?? null,
        metadata: {
          repairSummary: payload.repairSummary,
        },
        update: async (tx, current) => {
          const vendor = await upsertVendorTx(tx, {
            vendorId: payload.vendorId,
            vendorName: payload.vendorName,
          });
          await tx
            .update(schema.workOrders)
            .set({
              repairSummary: payload.repairSummary,
              actualCost:
                payload.actualCost === undefined
                  ? current.actualCost
                  : payload.actualCost.toFixed(2),
              laborHours:
                payload.laborHours === undefined
                  ? current.laborHours
                  : payload.laborHours.toFixed(2),
              assignedToUserId:
                payload.technicianUserId ?? current.assignedToUserId ?? null,
              vendorId: vendor?.id ?? current.vendorId,
              vendorName: vendor?.name ?? payload.vendorName ?? current.vendorName,
              updatedAt: now(),
            })
            .where(eq(schema.workOrders.id, current.id));
          await insertLaborEntriesTx(tx, current.id, payload.laborEntries, userId);
          await insertPartEntriesTx(tx, current.id, payload.partEntries, userId);
        },
      }),
    }),
  }).then((result) => result.workOrder);
}

export async function verifyWorkOrder(
  workOrderId: string,
  payload: VerifyWorkOrderInput,
  userId?: string,
) {
  return withIdempotency({
    key: payload.idempotencyKey,
    requestPath: `/api/work-orders/${workOrderId}/verify`,
    payload,
    execute: async () => {
      const current = await getWorkOrderEntity(workOrderId);
      return {
        workOrder: await mutateWorkOrderStatus({
          workOrderId,
          action: "verify",
          userId,
          notes: payload.notes ?? null,
          verificationResult: payload.result,
          metadata: {
            inspectionId: payload.inspectionId ?? null,
            verificationResult: payload.result,
            fallbackStatus:
              payload.result === "failed"
                ? getVerificationFailureStatus(Boolean(current.assignedToUserId || current.vendorId))
                : null,
          },
        }),
      };
    },
  }).then((result) => result.workOrder);
}

export async function cancelWorkOrder(
  workOrderId: string,
  payload: CancelWorkOrderInput,
  userId?: string,
) {
  return withIdempotency({
    key: payload.idempotencyKey,
    requestPath: `/api/work-orders/${workOrderId}/cancel`,
    payload,
    execute: async () => ({
      workOrder: await mutateWorkOrderStatus({
        workOrderId,
        action: "cancel",
        userId,
        notes: payload.reason,
        metadata: {
          reason: payload.reason,
        },
      }),
    }),
  }).then((result) => result.workOrder);
}

export async function closeWorkOrder(
  workOrderId: string,
  payload: CloseWorkOrderInput,
  userId?: string,
) {
  return withIdempotency({
    key: payload.idempotencyKey,
    requestPath: `/api/work-orders/${workOrderId}/close`,
    payload,
    execute: async () => ({
      workOrder: await mutateWorkOrderStatus({
        workOrderId,
        action: "close",
        userId,
        notes: payload.notes ?? null,
      }),
    }),
  }).then((result) => result.workOrder);
}

export async function listTechnicianWorkloads() {
  const rows = await listWorkOrders();
  const grouped = new Map<string, TechnicianWorkloadRecord>();

  for (const row of rows.filter((entry) => isBlockingMaintenanceStatus(entry.status))) {
    const key = row.technicianUserId ?? "unassigned";
    const entry = grouped.get(key) ?? {
      technicianUserId: row.technicianUserId ?? null,
      technicianName: row.technicianName ?? "Unassigned",
      assignedCount: 0,
      inProgressCount: 0,
      awaitingCount: 0,
      repairCompletedCount: 0,
      estimatedHours: 0,
    };

    if (row.status === "assigned") {
      entry.assignedCount += 1;
    } else if (row.status === "in_progress") {
      entry.inProgressCount += 1;
    } else if (["awaiting_parts", "awaiting_vendor"].includes(row.status)) {
      entry.awaitingCount += 1;
    } else if (row.status === "repair_completed") {
      entry.repairCompletedCount += 1;
    }

    entry.estimatedHours += row.laborHours ?? 0;
    grouped.set(key, entry);
  }

  return [...grouped.values()].sort((left, right) =>
    right.inProgressCount - left.inProgressCount ||
    right.awaitingCount - left.awaitingCount ||
    left.technicianName.localeCompare(right.technicianName),
  );
}

export async function listVendorQueue() {
  const rows = await listWorkOrders();
  const grouped = new Map<string, VendorQueueRecord>();

  for (const row of rows.filter((entry) => entry.vendorId || entry.vendorName)) {
    const key = row.vendorId ?? row.vendorName ?? "unassigned";
    const entry = grouped.get(key) ?? {
      vendorId: row.vendorId ?? null,
      vendorName: row.vendorName ?? "Unassigned vendor",
      assignedCount: 0,
      awaitingVendorCount: 0,
      repairCompletedCount: 0,
      estimatedCost: 0,
      actualCost: 0,
    };

    if (row.status === "assigned") {
      entry.assignedCount += 1;
    }
    if (row.status === "awaiting_vendor") {
      entry.awaitingVendorCount += 1;
    }
    if (row.status === "repair_completed") {
      entry.repairCompletedCount += 1;
    }
    entry.estimatedCost += row.estimatedCost ?? 0;
    entry.actualCost += row.actualCost ?? 0;
    grouped.set(key, entry);
  }

  return [...grouped.values()].sort((left, right) =>
    right.awaitingVendorCount - left.awaitingVendorCount ||
    right.assignedCount - left.assignedCount ||
    left.vendorName.localeCompare(right.vendorName),
  );
}

export async function listVerificationQueue() {
  const rows = await listWorkOrders({ status: "repair_completed" });
  return rows.map((row) => ({
    workOrderId: row.id,
    assetNumber: row.assetNumber,
    title: row.title,
    branch: row.branch,
    repairCompletedAt: row.repairCompletedAt ?? null,
    technicianName: row.technicianName ?? null,
    vendorName: row.vendorName ?? null,
    billableDisposition: row.billableDisposition ?? "internal",
  })) satisfies VerificationQueueRecord[];
}

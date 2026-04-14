import { and, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";

import { titleize } from "@/lib/format";
import { db, schema } from "@/lib/db";
import type {
  DispatchTaskRecord,
  WorkOrderRecord,
} from "@/lib/domain/models";
import type {
  CollectionCaseRecord,
  InspectionRecord,
  IntegrationJobRecord,
  TelematicsRecord,
} from "@/lib/platform-types";
import { ApiError } from "@/lib/server/api";
import { appendAuditEvent } from "@/lib/server/audit";
import {
  enqueueCollectionsEvaluationJob,
  evaluateCollectionsCadence,
} from "@/lib/server/collections-jobs";
import {
  buildCollectionsReminder,
  buildRecord360InspectionRequest,
  buildRecord360UnitSync,
  buildTelematicsRecoverySnapshot,
  extractRecord360InspectionResult,
} from "@/lib/server/integration-clients";
import { sendTransactionalEmail } from "@/lib/server/notification-service";
import { enqueueOutboxJob, getWebhookReceipt } from "@/lib/server/outbox";
import {
  createId,
  now,
  numericToNumber,
  toDate,
  toIso,
} from "@/lib/server/production-utils";
import { enqueueSkybitzPullJob, getTelematicsFreshness } from "@/lib/server/skybitz-jobs";
import {
  createInspectionFailureWorkOrderTx,
  syncAssetMaintenanceStateTx,
} from "@/lib/server/work-orders.production";

type CreateDispatchTaskInput = {
  type: string;
  status?: DispatchTaskRecord["status"];
  branch: string;
  assetNumber: string;
  contractNumber?: string;
  customerSite: string;
  scheduledFor: string;
  scheduledEnd?: string;
  driverName?: string;
  notes?: string;
  idempotencyKey?: string;
};

type DispatchConfirmationInput = {
  outcome: "delivery_confirmed" | "pickup_confirmed" | "swap_confirmed";
  notes?: string;
  completedAt?: string;
  idempotencyKey?: string;
};

type CreateInspectionInput = {
  assetNumber: string;
  contractNumber: string;
  customerSite: string;
  inspectionType: string;
};

type InspectionCompletionInput = {
  status: "passed" | "failed" | "needs_review";
  damageSummary: string;
  photos?: string[];
  damageScore?: number;
  media?: Array<Record<string, unknown>>;
  externalInspectionId?: string;
};

type CreateWorkOrderInput = {
  title: string;
  assetNumber: string;
  branch: string;
  priority: string;
  source: string;
  inspectionId?: string;
  technicianUserId?: string;
  vendorName?: string;
  estimatedCost?: number;
  laborHours?: number;
  status?: "open" | "assigned" | "in_progress" | "awaiting_parts";
  laborEntries?: Array<{
    technicianUserId?: string;
    hours: number;
    hourlyRate?: number;
    notes?: string;
  }>;
  partEntries?: Array<{
    partNumber?: string;
    description: string;
    quantity: number;
    unitCost?: number;
  }>;
  notes?: string;
  idempotencyKey?: string;
};

type CompleteWorkOrderInput = {
  notes?: string;
  actualCost?: number;
  laborHours?: number;
  technicianUserId?: string;
  vendorName?: string;
  laborEntries?: Array<{
    technicianUserId?: string;
    hours: number;
    hourlyRate?: number;
    notes?: string;
  }>;
  partEntries?: Array<{
    partNumber?: string;
    description: string;
    quantity: number;
    unitCost?: number;
  }>;
};

type UpdateCollectionCaseInput = Partial<
  Pick<
    CollectionCaseRecord,
    "status" | "promisedPaymentDate" | "promisedPaymentAmount"
  >
> & {
  note?: string;
};

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

function requireRecord<T>(value: T | undefined, message: string) {
  if (!value) {
    throw new ApiError(404, message);
  }

  return value;
}

function normalizeDispatchTaskType(
  value: string,
): typeof schema.dispatchTasks.$inferInsert.taskType {
  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, "_");

  switch (normalized) {
    case "delivery":
    case "pickup":
    case "swap":
    case "return":
    case "checkout":
    case "checkin":
      return normalized;
    default:
      throw new ApiError(400, `Unsupported dispatch task type: ${value}`);
  }
}

function normalizeInspectionType(
  value: string,
): typeof schema.inspections.$inferInsert.inspectionType {
  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, "_");

  switch (normalized) {
    case "delivery":
    case "return":
    case "damage_assessment":
    case "maintenance_release":
    case "spot_check":
      return normalized;
    default:
      throw new ApiError(400, `Unsupported inspection type: ${value}`);
  }
}

function normalizeCollectionStatus(
  value: string,
): typeof schema.collectionCases.$inferInsert.status {
  switch (value) {
    case "current":
    case "reminder_sent":
    case "promise_to_pay":
    case "disputed":
    case "escalated":
    case "resolved":
      return value;
    default:
      throw new ApiError(400, `Unsupported collection status: ${value}`);
  }
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

function differenceInDays(from: Date, to: Date) {
  return Math.max(0, Math.floor((from.getTime() - to.getTime()) / 86_400_000));
}

function summarizeTelematicsSource(rawPayload: Record<string, unknown> | null | undefined) {
  if (!rawPayload) {
    return null;
  }

  const source = rawPayload.source;
  return typeof source === "string" ? source : "skybitz";
}

async function ensureSkybitzMapping(asset: {
  id: string;
  assetNumber: string;
  gpsDeviceId: string | null;
  skybitzAssetId: string | null;
}) {
  const [existing] = await db
    .select()
    .from(schema.externalEntityMappings)
    .where(
      and(
        eq(schema.externalEntityMappings.provider, "skybitz"),
        eq(schema.externalEntityMappings.entityType, "asset"),
        eq(schema.externalEntityMappings.internalId, asset.id),
      ),
    )
    .limit(1);

  if (existing) {
    return existing;
  }

  const externalId = asset.skybitzAssetId ?? asset.gpsDeviceId ?? null;
  if (!externalId) {
    return null;
  }

  const mappingId = createId("extmap");
  await db.insert(schema.externalEntityMappings).values({
    id: mappingId,
    provider: "skybitz",
    entityType: "asset",
    internalId: asset.id,
    externalId,
    payload: {
      assetNumber: asset.assetNumber,
      gpsDeviceId: asset.gpsDeviceId ?? null,
      skybitzAssetId: asset.skybitzAssetId ?? null,
    },
    createdAt: now(),
    updatedAt: now(),
  });

  const [created] = await db
    .select()
    .from(schema.externalEntityMappings)
    .where(eq(schema.externalEntityMappings.id, mappingId))
    .limit(1);

  return created ?? null;
}

async function getCollectionCaseAnalytics(
  collectionCaseIds: string[],
): Promise<
  Map<
    string,
    {
      reminderCount: number;
      latestActivityType: string | null;
      latestActivityAt: Date | null;
      promisedPaymentAmount: number | null;
    }
  >
> {
  if (collectionCaseIds.length === 0) {
    return new Map();
  }

  const [activities, promises] = await Promise.all([
    db
      .select({
        collectionCaseId: schema.collectionActivities.collectionCaseId,
        activityType: schema.collectionActivities.activityType,
        createdAt: schema.collectionActivities.createdAt,
      })
      .from(schema.collectionActivities)
      .where(inArray(schema.collectionActivities.collectionCaseId, collectionCaseIds))
      .orderBy(desc(schema.collectionActivities.createdAt)),
    db
      .select({
        collectionCaseId: schema.promisedPayments.collectionCaseId,
        amount: schema.promisedPayments.amount,
        promisedFor: schema.promisedPayments.promisedFor,
      })
      .from(schema.promisedPayments)
      .where(inArray(schema.promisedPayments.collectionCaseId, collectionCaseIds))
      .orderBy(desc(schema.promisedPayments.promisedFor)),
  ]);

  const analytics = new Map<
    string,
    {
      reminderCount: number;
      latestActivityType: string | null;
      latestActivityAt: Date | null;
      promisedPaymentAmount: number | null;
    }
  >();

  for (const collectionCaseId of collectionCaseIds) {
    analytics.set(collectionCaseId, {
      reminderCount: 0,
      latestActivityType: null,
      latestActivityAt: null,
      promisedPaymentAmount: null,
    });
  }

  for (const activity of activities) {
    const entry = analytics.get(activity.collectionCaseId);
    if (!entry) {
      continue;
    }

    if (entry.latestActivityAt === null) {
      entry.latestActivityAt = activity.createdAt;
      entry.latestActivityType = activity.activityType;
    }

    if (activity.activityType === "email") {
      entry.reminderCount += 1;
    }
  }

  for (const promise of promises) {
    const entry = analytics.get(promise.collectionCaseId);
    if (!entry || entry.promisedPaymentAmount !== null) {
      continue;
    }

    entry.promisedPaymentAmount = numericToNumber(promise.amount);
  }

  return analytics;
}

async function getBranchByIdOrName(branchId: string) {
  const branch = await db.query.branches.findFirst({
    where: (table, { eq: localEq, or: localOr }) =>
      localOr(
        localEq(table.id, branchId),
        localEq(table.code, branchId),
        localEq(table.name, branchId),
      ),
  });

  return requireRecord(branch, `Branch ${branchId} not found.`);
}

async function getAssetByIdOrNumber(assetId: string) {
  const asset = await db.query.assets.findFirst({
    where: (table, { eq: localEq, or: localOr }) =>
      localOr(localEq(table.id, assetId), localEq(table.assetNumber, assetId)),
  });

  return requireRecord(asset, `Asset ${assetId} not found.`);
}

async function getContractByIdOrNumber(contractId: string) {
  const contract = await db.query.contracts.findFirst({
    where: (table, { eq: localEq, or: localOr }) =>
      localOr(localEq(table.id, contractId), localEq(table.contractNumber, contractId)),
  });

  return requireRecord(contract, `Contract ${contractId} not found.`);
}

async function getCustomerLocationByIdOrName(
  locationId: string,
  customerId?: string | null,
) {
  const clauses = [
    or(
      eq(schema.customerLocations.id, locationId),
      eq(schema.customerLocations.name, locationId),
    ),
  ];

  if (customerId) {
    clauses.push(eq(schema.customerLocations.customerId, customerId));
  }

  const [location] = await db
    .select()
    .from(schema.customerLocations)
    .where(and(...clauses));

  return requireRecord(location, `Customer location ${locationId} not found.`);
}

async function getDispatchTaskRow(taskId: string) {
  const task = await db.query.dispatchTasks.findFirst({
    where: (table, { eq: localEq }) => localEq(table.id, taskId),
  });

  return requireRecord(task, `Dispatch task ${taskId} not found.`);
}

async function getInspectionRow(inspectionId: string) {
  const inspection = await db.query.inspections.findFirst({
    where: (table, { eq: localEq }) => localEq(table.id, inspectionId),
  });

  return requireRecord(inspection, `Inspection ${inspectionId} not found.`);
}

async function getWorkOrderRow(workOrderId: string) {
  const workOrder = await db.query.workOrders.findFirst({
    where: (table, { eq: localEq }) => localEq(table.id, workOrderId),
  });

  return requireRecord(workOrder, `Work order ${workOrderId} not found.`);
}

async function ensureOpenCollectionCase(
  collectionCaseId: string,
  userId?: string,
) {
  const existing = await db.query.collectionCases.findFirst({
    where: (table, { eq: localEq, or: localOr }) =>
      localOr(localEq(table.id, collectionCaseId), localEq(table.invoiceId, collectionCaseId)),
  });

  if (existing) {
    return existing;
  }

  const invoice = await db.query.invoices.findFirst({
    where: (table, { eq: localEq, or: localOr }) =>
      localOr(localEq(table.id, collectionCaseId), localEq(table.invoiceNumber, collectionCaseId)),
  });

  const resolvedInvoice = requireRecord(
    invoice,
    `Collection case ${collectionCaseId} not found.`,
  );

  const newCaseId = createId("collection");
  await db.insert(schema.collectionCases).values({
    id: newCaseId,
    customerId: resolvedInvoice.customerId,
    invoiceId: resolvedInvoice.id,
    ownerUserId: userId ?? null,
    status: "current",
    notes: ["Collection case created from open invoice."],
    createdAt: now(),
    updatedAt: now(),
  });

  return requireRecord(
    await db.query.collectionCases.findFirst({
      where: (table, { eq: localEq }) => localEq(table.id, newCaseId),
    }),
    `Collection case ${newCaseId} not found after creation.`,
  );
}

async function getLatestTelematicsPing(assetId: string) {
  const [ping] = await db
    .select()
    .from(schema.telematicsPings)
    .where(eq(schema.telematicsPings.assetId, assetId))
    .orderBy(desc(schema.telematicsPings.capturedAt))
    .limit(1);

  return ping ?? null;
}

async function lockAssetRow(tx: DbTransaction, assetId: string) {
  await tx.execute(sql`select id from assets where id = ${assetId} for update`);
}

async function lockContractRow(tx: DbTransaction, contractId: string) {
  await tx.execute(sql`select id from contracts where id = ${contractId} for update`);
}

async function getContractLineForAsset(tx: DbTransaction, contractId: string, assetId: string) {
  const [line] = await tx
    .select({
      id: schema.contractLines.id,
      startDate: schema.contractLines.startDate,
      endDate: schema.contractLines.endDate,
    })
    .from(schema.contractLines)
    .where(
      and(
        eq(schema.contractLines.contractId, contractId),
        eq(schema.contractLines.assetId, assetId),
      ),
    )
    .limit(1);

  return line ?? null;
}

async function syncAssetStateFromAllocations(tx: DbTransaction, assetId: string) {
  await syncAssetMaintenanceStateTx(tx, assetId);
}

async function insertWorkOrderEntries(
  tx: DbTransaction,
  workOrderId: string,
  payload: Pick<CreateWorkOrderInput, "laborEntries" | "partEntries"> &
    Pick<CompleteWorkOrderInput, "laborEntries" | "partEntries">,
) {
  if (payload.laborEntries && payload.laborEntries.length > 0) {
    await tx.insert(schema.workOrderLaborEntries).values(
      payload.laborEntries.map((entry) => ({
        id: createId("wo_labor"),
        workOrderId,
        technicianUserId: entry.technicianUserId ?? null,
        hours: entry.hours.toFixed(2),
        hourlyRate: entry.hourlyRate?.toFixed(2) ?? null,
        notes: entry.notes ?? null,
        createdAt: now(),
      })),
    );
  }

  if (payload.partEntries && payload.partEntries.length > 0) {
    await tx.insert(schema.workOrderPartEntries).values(
      payload.partEntries.map((entry) => ({
        id: createId("wo_part"),
        workOrderId,
        partNumber: entry.partNumber ?? null,
        description: entry.description,
        quantity: entry.quantity.toFixed(2),
        unitCost: entry.unitCost?.toFixed(2) ?? null,
        createdAt: now(),
      })),
    );
  }
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

function mapDispatchTaskRow(row: {
  id: string;
  taskType: typeof schema.dispatchTasks.$inferSelect.taskType;
  status: typeof schema.dispatchTasks.$inferSelect.status;
  branchName: string;
  assetNumber: string | null;
  contractNumber: string | null;
  customerSite: string | null;
  scheduledStart: Date;
  scheduledEnd: Date | null;
  driverName: string | null;
  notes: string | null;
  completedAt: Date | null;
}) {
  return {
    id: row.id,
    type: titleize(row.taskType),
    status: row.status,
    branch: row.branchName,
    assetNumber: row.assetNumber ?? "Unassigned",
    contractNumber: row.contractNumber,
    customerSite: row.customerSite ?? "Unassigned",
    scheduledFor: toIso(row.scheduledStart) ?? new Date(0).toISOString(),
    scheduledEnd: toIso(row.scheduledEnd),
    driverName: row.driverName,
    notes: row.notes,
    completedAt: toIso(row.completedAt),
  } satisfies DispatchTaskRecord;
}

function mapInspectionRow(row: {
  id: string;
  assetNumber: string | null;
  contractNumber: string | null;
  customerSite: string | null;
  inspectionType: typeof schema.inspections.$inferSelect.inspectionType;
  status: typeof schema.inspections.$inferSelect.status;
  externalInspectionId?: string | null;
  createdAt: Date;
  completedAt: Date | null;
  resultSummary: string | null;
  damageScore?: number | null;
  photos: string[] | null;
  record360Payload?: Record<string, unknown> | null;
  workOrderId?: string | null;
}) {
  return {
    id: row.id,
    assetNumber: row.assetNumber ?? "Unknown",
    contractNumber: row.contractNumber ?? "Unassigned",
    customerSite: row.customerSite ?? "Unassigned",
    inspectionType: titleize(row.inspectionType),
    status: row.status,
    requestedAt: toIso(row.createdAt) ?? new Date(0).toISOString(),
    completedAt: toIso(row.completedAt),
    damageSummary: row.resultSummary ?? "Pending inspection results.",
    photos: row.photos ?? [],
    damageScore: row.damageScore,
    externalInspectionId: row.externalInspectionId,
    linkedWorkOrderId: row.workOrderId,
    media: Array.isArray(row.record360Payload?.media)
      ? (row.record360Payload.media as Array<Record<string, unknown>>)
      : [],
  } satisfies InspectionRecord;
}

function mapWorkOrderRow(row: {
  id: string;
  title: string;
  status: typeof schema.workOrders.$inferSelect.status;
  assetNumber: string | null;
  branchName: string;
  priority: string | null;
  source: string;
  technicianName?: string | null;
  vendorName?: string | null;
  inspectionId?: string | null;
  estimatedCost?: string | number | null;
  actualCost?: string | number | null;
  laborHours?: string | number | null;
  partCount?: number;
}) {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    assetNumber: row.assetNumber ?? "Unknown",
    branch: row.branchName,
    priority: row.priority ?? "Normal",
    source: row.source,
    technicianName: row.technicianName,
    vendorName: row.vendorName,
    inspectionId: row.inspectionId,
    estimatedCost:
      row.estimatedCost === null ? null : numericToNumber(row.estimatedCost),
    actualCost: row.actualCost === null ? null : numericToNumber(row.actualCost),
    laborHours: row.laborHours === null ? null : numericToNumber(row.laborHours),
    partCount: row.partCount ?? 0,
  } satisfies WorkOrderRecord;
}

function mapCollectionCaseRow(row: {
  id: string;
  customerName: string;
  invoiceNumber: string | null;
  status: string;
  ownerName: string | null;
  balanceAmount: string | number | null;
  dueDate?: Date | null;
  lastContactAt: Date | null;
  promisedPaymentDate: Date | null;
  notes: string[] | null;
  reminderCount?: number;
  latestActivityType?: string | null;
  latestActivityAt?: Date | null;
  promisedPaymentAmount?: number | null;
  nextAction?: string;
}) {
  const overdueDays = row.dueDate ? differenceInDays(now(), row.dueDate) : 0;

  return {
    id: row.id,
    customerName: row.customerName,
    invoiceNumber: row.invoiceNumber ?? "Unassigned",
    status: row.status,
    owner: row.ownerName ?? "Unassigned",
    balanceAmount: numericToNumber(row.balanceAmount),
    lastContactAt: toIso(row.lastContactAt),
    promisedPaymentDate: toIso(row.promisedPaymentDate),
    notes: row.notes ?? [],
    overdueDays,
    reminderCount: row.reminderCount ?? 0,
    nextAction: row.nextAction,
    lastActivityType: row.latestActivityType ?? null,
    latestActivityAt: toIso(row.latestActivityAt),
    promisedPaymentAmount: row.promisedPaymentAmount ?? null,
  } satisfies CollectionCaseRecord;
}

function mapTelematicsRow(row: {
  id: string;
  assetNumber: string;
  provider: string;
  latitude: string | number;
  longitude: string | number;
  speedMph: string | number | null;
  heading: number | null;
  capturedAt: Date;
  gpsDeviceId?: string | null;
  externalAssetId?: string | null;
  rawPayload?: Record<string, unknown> | null;
}) {
  const freshness = getTelematicsFreshness(row.capturedAt);
  return {
    id: row.id,
    assetNumber: row.assetNumber,
    provider: titleize(row.provider),
    latitude: numericToNumber(row.latitude),
    longitude: numericToNumber(row.longitude),
    speedMph: numericToNumber(row.speedMph),
    heading: row.heading ?? 0,
    capturedAt: toIso(row.capturedAt) ?? new Date(0).toISOString(),
    stale: freshness.stale,
    freshnessMinutes: freshness.freshnessMinutes,
    gpsDeviceId: row.gpsDeviceId ?? null,
    externalAssetId: row.externalAssetId ?? null,
    rawSource: summarizeTelematicsSource(row.rawPayload),
  } satisfies TelematicsRecord;
}

function mapIntegrationJobRow(row: {
  id: string;
  provider: string;
  entityType: string;
  entityId: string;
  direction: string;
  status: string;
  startedAt: Date;
  finishedAt: Date | null;
  lastError: string | null;
}) {
  return {
    id: row.id,
    provider: titleize(row.provider),
    entityType: row.entityType,
    entityId: row.entityId,
    direction: row.direction,
    status: row.status,
    startedAt: toIso(row.startedAt) ?? new Date(0).toISOString(),
    finishedAt: toIso(row.finishedAt),
    lastError: row.lastError,
  } satisfies IntegrationJobRecord;
}

async function insertInspectionRequest(options: {
  assetId: string;
  contractId?: string | null;
  customerLocationId?: string | null;
  inspectionType: typeof schema.inspections.$inferInsert.inspectionType;
  userId?: string;
  sourceEvent: string;
  tx?: DbTransaction;
}) {
  const inspectionId = createId("insp");

  const persist = async (tx: DbTransaction) => {
    await tx.insert(schema.inspections).values({
      id: inspectionId,
      assetId: options.assetId,
      contractId: options.contractId ?? null,
      customerLocationId: options.customerLocationId ?? null,
      inspectionType: options.inspectionType,
      status: "requested",
      resultSummary: "Pending inspection results.",
      photos: [],
      createdAt: now(),
      updatedAt: now(),
    });

    const shouldBlockInventory = ["return", "damage_assessment", "maintenance_release"].includes(
      options.inspectionType,
    );

    if (shouldBlockInventory) {
      const [existingHold] = await tx
        .select({
          id: schema.assetAllocations.id,
        })
        .from(schema.assetAllocations)
        .where(
          and(
            eq(schema.assetAllocations.assetId, options.assetId),
            eq(schema.assetAllocations.allocationType, "inspection_hold"),
            eq(schema.assetAllocations.active, true),
          ),
        )
        .limit(1);

      if (!existingHold) {
        await tx.insert(schema.assetAllocations).values({
          id: createId("alloc"),
          assetId: options.assetId,
          contractId: options.contractId ?? null,
          allocationType: "inspection_hold",
          startsAt: now(),
          endsAt: null,
          sourceEvent: options.sourceEvent,
          active: true,
          metadata: {
            inspectionId,
          },
          createdAt: now(),
          updatedAt: now(),
        });
      }
    }
  };

  if (options.tx) {
    await persist(options.tx);
  } else {
    await db.transaction(persist);
  }

  await enqueueOutboxJob({
    jobType: "inspection.request.record360",
    aggregateType: "inspection",
    aggregateId: inspectionId,
    provider: "record360",
    payload: {
      inspectionId,
      inspectionType: options.inspectionType,
      contractId: options.contractId ?? null,
      assetId: options.assetId,
    },
  });
  await enqueueRecord360UnitSync(options.assetId, options.sourceEvent);

  await pushAudit({
    entityType: "inspection",
    entityId: inspectionId,
    eventType: "requested",
    userId: options.userId,
    metadata: {
      inspectionType: options.inspectionType,
      sourceEvent: options.sourceEvent,
    },
  });

  return inspectionId;
}

export async function listDispatchTasks(filters?: {
  status?: string;
  branch?: string;
  type?: string;
}) {
  const rows = await db
    .select({
      id: schema.dispatchTasks.id,
      taskType: schema.dispatchTasks.taskType,
      status: schema.dispatchTasks.status,
      branchName: schema.branches.name,
      assetNumber: schema.assets.assetNumber,
      contractNumber: schema.contracts.contractNumber,
      customerSite: schema.customerLocations.name,
      scheduledStart: schema.dispatchTasks.scheduledStart,
      scheduledEnd: schema.dispatchTasks.scheduledEnd,
      driverName: schema.dispatchTasks.driverName,
      notes: schema.dispatchTasks.notes,
      completedAt: schema.dispatchTasks.completedAt,
    })
    .from(schema.dispatchTasks)
    .innerJoin(schema.branches, eq(schema.dispatchTasks.branchId, schema.branches.id))
    .leftJoin(schema.assets, eq(schema.dispatchTasks.assetId, schema.assets.id))
    .leftJoin(schema.contracts, eq(schema.dispatchTasks.contractId, schema.contracts.id))
    .leftJoin(
      schema.customerLocations,
      eq(schema.dispatchTasks.customerLocationId, schema.customerLocations.id),
    )
    .orderBy(desc(schema.dispatchTasks.scheduledStart));

  return rows.map(mapDispatchTaskRow).filter((task) => {
    if (filters?.status && task.status !== filters.status) {
      return false;
    }
    if (filters?.branch && task.branch !== filters.branch) {
      return false;
    }
    if (filters?.type && task.type.toLowerCase() !== titleize(filters.type).toLowerCase()) {
      return false;
    }
    return true;
  });
}

export async function createDispatchTask(
  payload: CreateDispatchTaskInput,
  userId?: string,
) {
  const [branch, asset, contract] = await Promise.all([
    getBranchByIdOrName(payload.branch),
    getAssetByIdOrNumber(payload.assetNumber),
    payload.contractNumber ? getContractByIdOrNumber(payload.contractNumber) : Promise.resolve(null),
  ]);
  if (asset.branchId !== branch.id) {
    throw new ApiError(409, "Dispatch task asset must belong to the selected branch.", {
      assetNumber: asset.assetNumber,
      assetBranchId: asset.branchId,
      branchId: branch.id,
    });
  }
  if (contract && contract.branchId !== branch.id) {
    throw new ApiError(409, "Dispatch task contract must belong to the selected branch.", {
      contractNumber: contract.contractNumber,
      contractBranchId: contract.branchId,
      branchId: branch.id,
    });
  }
  const customerLocation = await getCustomerLocationByIdOrName(
    payload.customerSite,
    contract?.customerId,
  ).catch(() => null);
  const taskType = normalizeDispatchTaskType(payload.type);
  const id = createId("dispatch");
  const status = payload.status ?? "unassigned";

  await db.transaction(async (tx) => {
    await lockAssetRow(tx, asset.id);

    await tx.insert(schema.dispatchTasks).values({
      id,
      branchId: branch.id,
      contractId: contract?.id ?? null,
      assetId: asset.id,
      customerLocationId: customerLocation?.id ?? null,
      taskType,
      status,
      scheduledStart: new Date(payload.scheduledFor),
      scheduledEnd: payload.scheduledEnd ? new Date(payload.scheduledEnd) : null,
      driverName: payload.driverName ?? null,
      notes: payload.notes ?? null,
      createdAt: now(),
      updatedAt: now(),
    });

    if (status === "assigned" || status === "in_progress") {
      await tx
        .update(schema.assetAllocations)
        .set({
          active: false,
          endsAt: now(),
          updatedAt: now(),
        })
        .where(
          and(
            eq(schema.assetAllocations.assetId, asset.id),
            eq(schema.assetAllocations.allocationType, "dispatch_hold"),
            eq(schema.assetAllocations.active, true),
          ),
        );

      await tx.insert(schema.assetAllocations).values({
        id: createId("alloc"),
        assetId: asset.id,
        contractId: contract?.id ?? null,
        dispatchTaskId: id,
        allocationType: "dispatch_hold",
        startsAt: now(),
        endsAt: null,
        sourceEvent: "dispatch_task_created",
        active: true,
        metadata: {
          dispatchStatus: status,
        },
        createdAt: now(),
        updatedAt: now(),
      });
      await syncAssetStateFromAllocations(tx, asset.id);
    }
  });

  await enqueueRecord360UnitSync(asset.id, "dispatch_task_created");

  await pushAudit({
    entityType: "dispatch_task",
    entityId: id,
    eventType: "created",
    userId,
    metadata: {
      taskType,
      assetNumber: asset.assetNumber,
      contractNumber: contract?.contractNumber ?? null,
      dispatchStatus: status,
    },
  });

  return requireRecord(
    (await listDispatchTasks()).find((task) => task.id === id),
    `Dispatch task ${id} not found after creation.`,
  );
}

export async function confirmDispatchTask(
  taskId: string,
  payload: DispatchConfirmationInput,
  userId?: string,
) {
  const task = await getDispatchTaskRow(taskId);
  const asset = requireRecord(
    task.assetId
      ? await db.query.assets.findFirst({
          where: (table, { eq: localEq }) => localEq(table.id, task.assetId as string),
        })
      : undefined,
    `Dispatch task ${taskId} is not tied to an asset.`,
  );
  const contract = task.contractId ? await getContractByIdOrNumber(task.contractId) : null;
  const completedAt = toDate(payload.completedAt) ?? now();
  let inspectionId: string | null = null;

  await db.transaction(async (tx) => {
    await lockAssetRow(tx, asset.id);
    if (contract) {
      await lockContractRow(tx, contract.id);
    }

    await tx
      .update(schema.dispatchTasks)
      .set({
        status: "completed",
        notes: payload.notes ? [task.notes, payload.notes].filter(Boolean).join("\n") : task.notes,
        completedAt,
        updatedAt: now(),
      })
      .where(eq(schema.dispatchTasks.id, task.id));

    if (payload.outcome === "delivery_confirmed" || payload.outcome === "swap_confirmed") {
      const contractLine = contract
        ? await getContractLineForAsset(tx, contract.id, asset.id)
        : null;

      await tx
        .update(schema.assetAllocations)
        .set({
          active: false,
          endsAt: completedAt,
          updatedAt: now(),
        })
        .where(
          and(
            eq(schema.assetAllocations.assetId, asset.id),
            inArray(schema.assetAllocations.allocationType, [
              "reservation",
              "dispatch_hold",
              "swap_in",
              "swap_out",
            ]),
            eq(schema.assetAllocations.active, true),
          ),
        );

      await tx.insert(schema.assetAllocations).values({
        id: createId("alloc"),
        assetId: asset.id,
        contractId: contract?.id ?? null,
        contractLineId: contractLine?.id ?? null,
        dispatchTaskId: task.id,
        allocationType: "on_rent",
        startsAt: completedAt,
        endsAt: null,
        sourceEvent: payload.outcome,
        active: true,
        metadata: {
          dispatchTaskId: task.id,
        },
        createdAt: now(),
        updatedAt: now(),
      });
      await syncAssetStateFromAllocations(tx, asset.id);
    }

    if (payload.outcome === "pickup_confirmed") {
      await tx
        .update(schema.assetAllocations)
        .set({
          active: false,
          endsAt: completedAt,
          updatedAt: now(),
        })
        .where(
          and(
            eq(schema.assetAllocations.assetId, asset.id),
            inArray(schema.assetAllocations.allocationType, ["on_rent", "dispatch_hold"]),
            eq(schema.assetAllocations.active, true),
          ),
        );

      await tx.insert(schema.assetAllocations).values({
        id: createId("alloc"),
        assetId: asset.id,
        contractId: contract?.id ?? null,
        dispatchTaskId: task.id,
        allocationType: "inspection_hold",
        startsAt: completedAt,
        endsAt: null,
        sourceEvent: payload.outcome,
        active: true,
        metadata: {
          dispatchTaskId: task.id,
        },
        createdAt: now(),
        updatedAt: now(),
      });
      await syncAssetStateFromAllocations(tx, asset.id);
    }

    if (contract) {
      await tx.insert(schema.financialEvents).values({
        id: createId("fe"),
        contractId: contract.id,
        eventType:
          payload.outcome === "delivery_confirmed"
            ? "delivery"
            : payload.outcome === "pickup_confirmed"
              ? "pickup"
              : "adjustment",
        description: `Dispatch task ${titleize(task.taskType)} ${payload.outcome.replace(/_/g, " ")}`,
        amount: "0.00",
        eventDate: now(),
        status: "posted",
        createdAt: now(),
        updatedAt: now(),
      });
    }

    if (contract && payload.outcome === "delivery_confirmed" && contract.status === "reserved") {
      await tx
        .update(schema.contracts)
        .set({
          status: "active",
          activatedAt: completedAt,
          updatedAt: now(),
        })
        .where(eq(schema.contracts.id, contract.id));
    }

    if (contract && payload.outcome === "pickup_confirmed" && contract.status === "active") {
      await tx
        .update(schema.contracts)
        .set({
          status: "completed",
          completedAt,
          updatedAt: now(),
        })
        .where(eq(schema.contracts.id, contract.id));
    }

    if (payload.outcome === "delivery_confirmed" || payload.outcome === "pickup_confirmed") {
      const createdInspectionId = await insertInspectionRequest({
        assetId: asset.id,
        contractId: contract?.id ?? null,
        customerLocationId: task.customerLocationId ?? null,
        inspectionType: payload.outcome === "delivery_confirmed" ? "delivery" : "return",
        userId,
        sourceEvent: payload.outcome,
        tx,
      });
      inspectionId = createdInspectionId;
    }
  });

  await enqueueRecord360UnitSync(asset.id, payload.outcome);

  await pushAudit({
    entityType: "dispatch_task",
    entityId: task.id,
    eventType: "confirmed",
    userId,
    metadata: {
      outcome: payload.outcome,
      assetNumber: asset.assetNumber,
      contractNumber: contract?.contractNumber ?? null,
      inspectionId,
    },
  });

  if (contract && payload.outcome === "delivery_confirmed" && contract.status === "reserved") {
    await pushAudit({
      entityType: "contract",
      entityId: contract.id,
      eventType: "activated",
      userId,
      metadata: {
        source: "dispatch_confirmation",
        taskId,
      },
    });
  }

  if (contract && payload.outcome === "pickup_confirmed" && contract.status === "active") {
    await pushAudit({
      entityType: "contract",
      entityId: contract.id,
      eventType: "completed",
      userId,
      metadata: {
        source: "dispatch_confirmation",
        taskId,
      },
    });
  }

  return requireRecord(
    (await listDispatchTasks()).find((entry) => entry.id === task.id),
    `Dispatch task ${task.id} not found after confirmation.`,
  );
}

export async function listInspections(filters?: {
  status?: string;
  assetNumber?: string;
  contractNumber?: string;
}) {
  const rows = await db
    .select({
      id: schema.inspections.id,
      assetNumber: schema.assets.assetNumber,
      contractNumber: schema.contracts.contractNumber,
      customerSite: schema.customerLocations.name,
      inspectionType: schema.inspections.inspectionType,
      status: schema.inspections.status,
      externalInspectionId: schema.inspections.externalInspectionId,
      createdAt: schema.inspections.createdAt,
      completedAt: schema.inspections.completedAt,
      resultSummary: schema.inspections.resultSummary,
      damageScore: schema.inspections.damageScore,
      photos: schema.inspections.photos,
      record360Payload: schema.inspections.record360Payload,
    })
    .from(schema.inspections)
    .innerJoin(schema.assets, eq(schema.inspections.assetId, schema.assets.id))
    .leftJoin(schema.contracts, eq(schema.inspections.contractId, schema.contracts.id))
    .leftJoin(
      schema.customerLocations,
      eq(schema.inspections.customerLocationId, schema.customerLocations.id),
    )
    .orderBy(desc(schema.inspections.createdAt));

  const inspectionIds = rows.map((row) => row.id);
  const linkedWorkOrders =
    inspectionIds.length === 0
      ? []
      : await db
          .select({
            id: schema.workOrders.id,
            inspectionId: schema.workOrders.inspectionId,
            createdAt: schema.workOrders.createdAt,
          })
          .from(schema.workOrders)
          .where(inArray(schema.workOrders.inspectionId, inspectionIds))
          .orderBy(desc(schema.workOrders.createdAt));

  const workOrderByInspectionId = new Map<string, string>();
  linkedWorkOrders.forEach((row) => {
    if (row.inspectionId && !workOrderByInspectionId.has(row.inspectionId)) {
      workOrderByInspectionId.set(row.inspectionId, row.id);
    }
  });

  return rows.map((row) =>
    mapInspectionRow({
      ...row,
      workOrderId: workOrderByInspectionId.get(row.id) ?? null,
    }),
  ).filter((inspection) => {
    if (filters?.status && inspection.status !== filters.status) {
      return false;
    }
    if (filters?.assetNumber && inspection.assetNumber !== filters.assetNumber) {
      return false;
    }
    if (filters?.contractNumber && inspection.contractNumber !== filters.contractNumber) {
      return false;
    }
    return true;
  });
}

export async function createInspection(
  payload: CreateInspectionInput,
  userId?: string,
) {
  const asset = await getAssetByIdOrNumber(payload.assetNumber);
  const contract = await getContractByIdOrNumber(payload.contractNumber);
  const customerLocation = await getCustomerLocationByIdOrName(
    payload.customerSite,
    contract.customerId,
  ).catch(() => null);

  const inspectionId = await insertInspectionRequest({
    assetId: asset.id,
    contractId: contract.id,
    customerLocationId: customerLocation?.id ?? null,
    inspectionType: normalizeInspectionType(payload.inspectionType),
    userId,
    sourceEvent: "manual_request",
  });

  return requireRecord(
    (await listInspections()).find((inspection) => inspection.id === inspectionId),
    `Inspection ${inspectionId} not found after creation.`,
  );
}

export async function completeInspection(
  inspectionId: string,
  payload: InspectionCompletionInput,
  userId?: string,
) {
  const inspection = await getInspectionRow(inspectionId);
  const asset = await getAssetByIdOrNumber(inspection.assetId);
  const completedAt = now();
  let workOrderId: string | null = null;

  await db.transaction(async (tx) => {
    await lockAssetRow(tx, asset.id);

    await tx
      .update(schema.inspections)
      .set({
        status: payload.status,
        resultSummary: payload.damageSummary,
        externalInspectionId:
          payload.externalInspectionId ?? inspection.externalInspectionId ?? null,
        damageScore: payload.damageScore ?? inspection.damageScore ?? null,
        photos: payload.photos ?? inspection.photos ?? [],
        record360Payload: payload.media
          ? {
              ...(inspection.record360Payload ?? {}),
              media: payload.media,
            }
          : inspection.record360Payload,
        completedAt,
        updatedAt: now(),
      })
      .where(eq(schema.inspections.id, inspection.id));

    await tx
      .update(schema.assetAllocations)
      .set({
        active: false,
        endsAt: completedAt,
        updatedAt: now(),
      })
      .where(
        and(
          eq(schema.assetAllocations.assetId, asset.id),
          eq(schema.assetAllocations.allocationType, "inspection_hold"),
          eq(schema.assetAllocations.active, true),
        ),
      );

    if (payload.status === "failed" || payload.status === "needs_review") {
      workOrderId = await createInspectionFailureWorkOrderTx(tx, {
        assetId: asset.id,
        inspectionId: inspection.id,
        contractId: inspection.contractId ?? null,
        damageSummary: payload.damageSummary,
        damageScore: payload.damageScore ?? null,
        completedAt,
        userId,
      });

      await syncAssetStateFromAllocations(tx, asset.id);
    } else {
      await syncAssetStateFromAllocations(tx, asset.id);
    }
  });

  if (workOrderId) {
    await enqueueRecord360UnitSync(asset.id, "inspection_failure_work_order");
  }

  await pushAudit({
    entityType: "inspection",
    entityId: inspection.id,
    eventType: "completed",
    userId,
    metadata: {
      status: payload.status,
      workOrderId,
    },
  });

  return {
    inspection: requireRecord(
      (await listInspections()).find((entry) => entry.id === inspection.id),
      `Inspection ${inspection.id} not found after completion.`,
    ),
    workOrder:
      workOrderId === null
        ? null
        : requireRecord(
            (await listWorkOrders()).find((entry) => entry.id === workOrderId),
            `Work order ${workOrderId} not found after inspection completion.`,
          ),
  };
}

export async function listWorkOrders(filters?: {
  status?: string;
  branch?: string;
  assetNumber?: string;
}) {
  const rows = await db
    .select({
      id: schema.workOrders.id,
      title: schema.workOrders.title,
      status: schema.workOrders.status,
      assetNumber: schema.assets.assetNumber,
      branchName: schema.branches.name,
      priority: schema.workOrders.priority,
      source: schema.workOrders.description,
      technicianName: schema.users.name,
      vendorName: schema.workOrders.vendorName,
      inspectionId: schema.workOrders.inspectionId,
      estimatedCost: schema.workOrders.estimatedCost,
      actualCost: schema.workOrders.actualCost,
      laborHours: schema.workOrders.laborHours,
    })
    .from(schema.workOrders)
    .innerJoin(schema.assets, eq(schema.workOrders.assetId, schema.assets.id))
    .innerJoin(schema.branches, eq(schema.workOrders.branchId, schema.branches.id))
    .leftJoin(schema.users, eq(schema.workOrders.assignedToUserId, schema.users.id))
    .orderBy(desc(schema.workOrders.createdAt));

  const workOrderIds = rows.map((row) => row.id);
  const partRows =
    workOrderIds.length === 0
      ? []
      : await db
          .select({
            workOrderId: schema.workOrderPartEntries.workOrderId,
          })
          .from(schema.workOrderPartEntries)
          .where(inArray(schema.workOrderPartEntries.workOrderId, workOrderIds));

  const partCountByWorkOrderId = new Map<string, number>();
  partRows.forEach((row) => {
    partCountByWorkOrderId.set(
      row.workOrderId,
      (partCountByWorkOrderId.get(row.workOrderId) ?? 0) + 1,
    );
  });

  return rows
    .map((row) =>
      mapWorkOrderRow({
        ...row,
        source: row.source ?? "Manual entry",
        partCount: partCountByWorkOrderId.get(row.id) ?? 0,
      }),
    )
    .filter((order) => {
      if (filters?.status && order.status !== filters.status) {
        return false;
      }
      if (filters?.branch && order.branch !== filters.branch) {
        return false;
      }
      if (filters?.assetNumber && order.assetNumber !== filters.assetNumber) {
        return false;
      }
      return true;
    });
}

export async function createWorkOrder(
  payload: CreateWorkOrderInput,
  userId?: string,
) {
  const [asset, branch, inspection] = await Promise.all([
    getAssetByIdOrNumber(payload.assetNumber),
    getBranchByIdOrName(payload.branch),
    payload.inspectionId ? getInspectionRow(payload.inspectionId) : Promise.resolve(null),
  ]);
  const id = createId("wo");

  await db.transaction(async (tx) => {
    await lockAssetRow(tx, asset.id);

    await tx.insert(schema.workOrders).values({
      id,
      assetId: asset.id,
      inspectionId: payload.inspectionId ?? null,
      branchId: branch.id,
      assignedToUserId: payload.technicianUserId ?? null,
      status: payload.status ?? (payload.technicianUserId ? "assigned" : "open"),
      priority: payload.priority,
      title: payload.title,
      description: payload.notes ?? payload.source,
      vendorName: payload.vendorName ?? null,
      estimatedCost: payload.estimatedCost?.toFixed(2) ?? null,
      laborHours: payload.laborHours?.toFixed(2) ?? null,
      parts:
        payload.partEntries && payload.partEntries.length > 0
          ? {
              count: payload.partEntries.length,
            }
          : null,
      openedAt: now(),
      assignedAt: payload.technicianUserId ? now() : null,
      createdAt: now(),
      updatedAt: now(),
    });

    await tx.insert(schema.assetAllocations).values({
      id: createId("alloc"),
      assetId: asset.id,
      contractId: inspection?.contractId ?? null,
      workOrderId: id,
      allocationType: "maintenance_hold",
      startsAt: now(),
      endsAt: null,
      sourceEvent: "work_order_opened",
      active: true,
      metadata: {
        workOrderId: id,
      },
      createdAt: now(),
      updatedAt: now(),
    });

    await insertWorkOrderEntries(tx, id, payload);
    await syncAssetStateFromAllocations(tx, asset.id);
  });

  await enqueueRecord360UnitSync(asset.id, "work_order_opened");

  await pushAudit({
    entityType: "work_order",
    entityId: id,
    eventType: "created",
    userId,
    metadata: {
      assetNumber: asset.assetNumber,
      priority: payload.priority,
      technicianUserId: payload.technicianUserId ?? null,
      vendorName: payload.vendorName ?? null,
    },
  });

  return requireRecord(
    (await listWorkOrders()).find((entry) => entry.id === id),
    `Work order ${id} not found after creation.`,
  );
}

export async function completeWorkOrder(
  workOrderId: string,
  userId?: string,
  notesOrPayload: string | CompleteWorkOrderInput = "Work completed",
) {
  const workOrder = await getWorkOrderRow(workOrderId);
  const asset = await getAssetByIdOrNumber(workOrder.assetId);
  const completion =
    typeof notesOrPayload === "string" ? { notes: notesOrPayload } : notesOrPayload;
  const notes = completion.notes ?? "Work completed";

  await db.transaction(async (tx) => {
    await lockAssetRow(tx, asset.id);

    await tx
      .update(schema.workOrders)
      .set({
        status: "repair_completed",
        assignedToUserId: completion.technicianUserId ?? workOrder.assignedToUserId,
        vendorName: completion.vendorName ?? workOrder.vendorName,
        actualCost: completion.actualCost?.toFixed(2) ?? workOrder.actualCost,
        laborHours: completion.laborHours?.toFixed(2) ?? workOrder.laborHours,
        description: notes,
        completedAt: now(),
        updatedAt: now(),
      })
      .where(eq(schema.workOrders.id, workOrder.id));

    await tx
      .update(schema.assetAllocations)
      .set({
        active: false,
        endsAt: now(),
        updatedAt: now(),
      })
      .where(
        and(
          eq(schema.assetAllocations.assetId, asset.id),
          eq(schema.assetAllocations.allocationType, "maintenance_hold"),
          eq(schema.assetAllocations.active, true),
        ),
      );

    await insertWorkOrderEntries(tx, workOrder.id, completion);
    await syncAssetStateFromAllocations(tx, asset.id);
  });

  await enqueueRecord360UnitSync(asset.id, "work_order_completed");

  await pushAudit({
    entityType: "work_order",
    entityId: workOrder.id,
    eventType: "completed",
    userId,
    metadata: {
      assetNumber: asset.assetNumber,
      notes,
    },
  });

  return requireRecord(
    (await listWorkOrders()).find((entry) => entry.id === workOrder.id),
    `Work order ${workOrder.id} not found after completion.`,
  );
}

async function upsertExternalEntityMapping(options: {
  provider: typeof schema.externalEntityMappings.$inferInsert.provider;
  entityType: string;
  internalId: string;
  externalId: string;
  payload?: Record<string, unknown>;
}) {
  const existing = await db.query.externalEntityMappings.findFirst({
    where: (table, { and: localAnd, eq: localEq }) =>
      localAnd(
        localEq(table.provider, options.provider),
        localEq(table.entityType, options.entityType),
        localEq(table.internalId, options.internalId),
      ),
  });

  if (existing) {
    await db
      .update(schema.externalEntityMappings)
      .set({
        externalId: options.externalId,
        payload: options.payload ?? existing.payload,
        updatedAt: now(),
      })
      .where(eq(schema.externalEntityMappings.id, existing.id));
    return existing.id;
  }

  const id = createId("map");
  await db.insert(schema.externalEntityMappings).values({
    id,
    provider: options.provider,
    entityType: options.entityType,
    internalId: options.internalId,
    externalId: options.externalId,
    payload: options.payload ?? {},
    createdAt: now(),
    updatedAt: now(),
  });
  return id;
}

async function resolveInspectionForRecord360Event(event: ReturnType<typeof extractRecord360InspectionResult>) {
  if (event.externalInspectionId) {
    const inspection = await db.query.inspections.findFirst({
      where: (table, { eq: localEq }) =>
        localEq(table.externalInspectionId, event.externalInspectionId!),
    });
    if (inspection) {
      return inspection;
    }
  }

  if (event.contractNumber && event.assetNumber) {
    const [inspection] = await db
      .select({
        id: schema.inspections.id,
        assetId: schema.inspections.assetId,
        contractId: schema.inspections.contractId,
        customerLocationId: schema.inspections.customerLocationId,
        inspectionType: schema.inspections.inspectionType,
        status: schema.inspections.status,
        externalInspectionId: schema.inspections.externalInspectionId,
        resultSummary: schema.inspections.resultSummary,
        damageScore: schema.inspections.damageScore,
        photos: schema.inspections.photos,
        record360Payload: schema.inspections.record360Payload,
      })
      .from(schema.inspections)
      .innerJoin(schema.assets, eq(schema.inspections.assetId, schema.assets.id))
      .leftJoin(schema.contracts, eq(schema.inspections.contractId, schema.contracts.id))
      .where(
        and(
          eq(schema.assets.assetNumber, event.assetNumber),
          eq(schema.contracts.contractNumber, event.contractNumber),
        ),
      )
      .orderBy(desc(schema.inspections.createdAt))
      .limit(1);

    if (inspection) {
      return inspection;
    }
  }

  if (event.assetNumber) {
    const [inspection] = await db
      .select({
        id: schema.inspections.id,
        assetId: schema.inspections.assetId,
        contractId: schema.inspections.contractId,
        customerLocationId: schema.inspections.customerLocationId,
        inspectionType: schema.inspections.inspectionType,
        status: schema.inspections.status,
        externalInspectionId: schema.inspections.externalInspectionId,
        resultSummary: schema.inspections.resultSummary,
        damageScore: schema.inspections.damageScore,
        photos: schema.inspections.photos,
        record360Payload: schema.inspections.record360Payload,
      })
      .from(schema.inspections)
      .innerJoin(schema.assets, eq(schema.inspections.assetId, schema.assets.id))
      .where(eq(schema.assets.assetNumber, event.assetNumber))
      .orderBy(desc(schema.inspections.createdAt))
      .limit(1);

    if (inspection) {
      return inspection;
    }
  }

  return null;
}

export async function syncAssetUnitToRecord360(assetId: string) {
  const asset = requireRecord(
    await db.query.assets.findFirst({
      where: (table, { eq: localEq }) => localEq(table.id, assetId),
    }),
    `Asset ${assetId} not found.`,
  );
  const branch = requireRecord(
    await db.query.branches.findFirst({
      where: (table, { eq: localEq }) => localEq(table.id, asset.branchId),
    }),
    `Branch ${asset.branchId} not found.`,
  );

  const result = await buildRecord360UnitSync({
    assetNumber: asset.assetNumber,
    assetType: asset.type,
    status: asset.status,
    branchName: branch.name,
    externalUnitId: asset.record360UnitId,
    dimensions:
      asset.dimensions && typeof asset.dimensions === "object"
        ? (asset.dimensions as Record<string, unknown>)
        : null,
    features: asset.features ?? null,
    serialNumber: asset.serialNumber ?? null,
    gpsDeviceId: asset.gpsDeviceId ?? null,
  });

  await db
    .update(schema.assets)
    .set({
      record360UnitId: result.data.unitId,
      updatedAt: now(),
    })
    .where(eq(schema.assets.id, asset.id));

  await upsertExternalEntityMapping({
    provider: "record360",
    entityType: "asset",
    internalId: asset.id,
    externalId: result.data.unitId,
    payload: result.data.payload,
  });

  await pushAudit({
    entityType: "asset",
    entityId: asset.id,
    eventType: "record360_unit_synced",
    metadata: {
      unitId: result.data.unitId,
      requestId: result.data.requestId,
      mode: result.mode,
    },
  });

  return result;
}

export async function syncInspectionRequestToRecord360(inspectionId: string) {
  const inspection = await getInspectionRow(inspectionId);
  const asset = await getAssetByIdOrNumber(inspection.assetId);
  const contract = inspection.contractId
    ? await getContractByIdOrNumber(inspection.contractId)
    : null;
  const location = inspection.customerLocationId
    ? await getCustomerLocationByIdOrName(inspection.customerLocationId).catch(() => null)
    : null;
  const unitSync = await syncAssetUnitToRecord360(asset.id);
  const result = await buildRecord360InspectionRequest({
    assetNumber: asset.assetNumber,
    contractNumber: contract?.contractNumber ?? "UNASSIGNED",
    inspectionType: inspection.inspectionType,
    customerSite: location?.name ?? null,
    externalUnitId: unitSync.data.unitId,
  });

  await db
    .update(schema.inspections)
    .set({
      externalInspectionId: result.data.requestId,
      record360Payload: result.data.payload,
      status: inspection.status === "requested" ? "in_progress" : inspection.status,
      updatedAt: now(),
    })
    .where(eq(schema.inspections.id, inspection.id));

  await upsertExternalEntityMapping({
    provider: "record360",
    entityType: "inspection",
    internalId: inspection.id,
    externalId: result.data.requestId,
    payload: result.data.payload,
  });

  await pushAudit({
    entityType: "inspection",
    entityId: inspection.id,
    eventType: "record360_requested",
    metadata: {
      requestId: result.data.requestId,
      unitId: result.data.externalUnitId,
      mode: result.mode,
    },
  });

  return result;
}

export async function processRecord360WebhookReceipt(receiptId: string) {
  const receipt = requireRecord(
    await getWebhookReceipt(receiptId),
    `Record360 webhook receipt ${receiptId} not found.`,
  );
  const parsed = extractRecord360InspectionResult(
    receipt.payload as Record<string, unknown>,
  );
  const inspection = await resolveInspectionForRecord360Event(parsed);
  if (!inspection) {
    throw new ApiError(404, "No matching inspection found for Record360 webhook.", {
      receiptId,
      externalInspectionId: parsed.externalInspectionId,
      assetNumber: parsed.assetNumber,
      contractNumber: parsed.contractNumber,
    });
  }

  if (parsed.externalInspectionId) {
    await upsertExternalEntityMapping({
      provider: "record360",
      entityType: "inspection",
      internalId: inspection.id,
      externalId: parsed.externalInspectionId,
      payload: parsed.payload,
    });
  }

  if (parsed.externalUnitId) {
    await db
      .update(schema.assets)
      .set({
        record360UnitId: parsed.externalUnitId,
        updatedAt: now(),
      })
      .where(eq(schema.assets.id, inspection.assetId));

    await upsertExternalEntityMapping({
      provider: "record360",
      entityType: "asset",
      internalId: inspection.assetId,
      externalId: parsed.externalUnitId,
      payload: parsed.payload,
    });
  }

  return completeInspection(
    inspection.id,
    {
      status: parsed.status as "passed" | "failed" | "needs_review",
      damageSummary: parsed.damageSummary,
      photos: parsed.photos,
      damageScore: parsed.damageScore ?? undefined,
      media: parsed.media,
      externalInspectionId: parsed.externalInspectionId ?? undefined,
    },
    undefined,
  );
}

export async function listCollectionCases(filters?: {
  status?: string;
  owner?: string;
}) {
  const persistedRows = await db
    .select({
      id: schema.collectionCases.id,
      customerName: schema.customers.name,
      invoiceNumber: schema.invoices.invoiceNumber,
      status: schema.collectionCases.status,
      ownerName: schema.users.name,
      balanceAmount: schema.invoices.balanceAmount,
      dueDate: schema.invoices.dueDate,
      lastContactAt: schema.collectionCases.lastContactAt,
      promisedPaymentDate: schema.collectionCases.promisedPaymentDate,
      notes: schema.collectionCases.notes,
    })
    .from(schema.collectionCases)
    .innerJoin(schema.customers, eq(schema.collectionCases.customerId, schema.customers.id))
    .leftJoin(schema.invoices, eq(schema.collectionCases.invoiceId, schema.invoices.id))
    .leftJoin(schema.users, eq(schema.collectionCases.ownerUserId, schema.users.id))
    .orderBy(desc(schema.collectionCases.updatedAt));

  const analytics = await getCollectionCaseAnalytics(persistedRows.map((row) => row.id));
  const persisted = persistedRows.map((row) => {
    const insight = analytics.get(row.id);
    const cadence = evaluateCollectionsCadence({
      dueDate: row.dueDate,
      balanceAmount: numericToNumber(row.balanceAmount),
      reminderCount: insight?.reminderCount ?? 0,
      promisedPaymentDate: row.promisedPaymentDate,
      lastContactAt: row.lastContactAt,
    });

    return mapCollectionCaseRow({
      ...row,
      reminderCount: insight?.reminderCount ?? 0,
      latestActivityType: insight?.latestActivityType ?? null,
      latestActivityAt: insight?.latestActivityAt ?? null,
      promisedPaymentAmount: insight?.promisedPaymentAmount ?? null,
      nextAction: cadence.nextAction,
    });
  });
  const persistedInvoiceNumbers = new Set(persisted.map((row) => row.invoiceNumber));

  const derivedRows = await db
    .select({
      id: schema.invoices.id,
      customerName: schema.customers.name,
      invoiceNumber: schema.invoices.invoiceNumber,
      balanceAmount: schema.invoices.balanceAmount,
      dueDate: schema.invoices.dueDate,
    })
    .from(schema.invoices)
    .innerJoin(schema.customers, eq(schema.invoices.customerId, schema.customers.id))
    .where(inArray(schema.invoices.status, ["sent", "partially_paid", "overdue"]))
    .orderBy(desc(schema.invoices.dueDate));

  const derived = derivedRows
    .filter(
      (row) =>
        numericToNumber(row.balanceAmount) > 0 &&
        !persistedInvoiceNumbers.has(row.invoiceNumber),
    )
    .map((row) => ({
      id: row.id,
      customerName: row.customerName,
      invoiceNumber: row.invoiceNumber,
      status: "current",
      owner: "Unassigned",
      balanceAmount: numericToNumber(row.balanceAmount),
      lastContactAt: null,
      promisedPaymentDate: null,
      notes: ["Collection case will be created on first collector action."],
      overdueDays: differenceInDays(now(), row.dueDate),
      reminderCount: 0,
      nextAction: evaluateCollectionsCadence({
        dueDate: row.dueDate,
        balanceAmount: numericToNumber(row.balanceAmount),
        reminderCount: 0,
      }).nextAction,
      lastActivityType: null,
      latestActivityAt: null,
      promisedPaymentAmount: null,
    }) satisfies CollectionCaseRecord);

  return [...persisted, ...derived].filter((caseRecord) => {
    if (filters?.status && caseRecord.status !== filters.status) {
      return false;
    }
    if (filters?.owner && caseRecord.owner !== filters.owner) {
      return false;
    }
    return true;
  });
}

export async function sendCollectionsReminder(
  collectionCaseId: string,
  userId?: string,
) {
  const caseRow = await ensureOpenCollectionCase(collectionCaseId, userId);
  const customer = requireRecord(
    await db.query.customers.findFirst({
      where: (table, { eq: localEq }) => localEq(table.id, caseRow.customerId),
    }),
    `Customer for collection case ${caseRow.id} not found.`,
  );
  const invoice = caseRow.invoiceId
    ? await db.query.invoices.findFirst({
        where: (table, { eq: localEq }) => localEq(table.id, caseRow.invoiceId as string),
      })
    : null;

  const reminderSeed = mapCollectionCaseRow({
    id: caseRow.id,
    customerName: customer.name,
    invoiceNumber: invoice?.invoiceNumber ?? "Unassigned",
    status: "reminder_sent",
    ownerName: null,
    balanceAmount: invoice?.balanceAmount ?? "0",
    dueDate: invoice?.dueDate ?? null,
    lastContactAt: now(),
    promisedPaymentDate: caseRow.promisedPaymentDate,
    notes: caseRow.notes ?? [],
    reminderCount: 0,
    latestActivityType: null,
    latestActivityAt: null,
    promisedPaymentAmount: null,
    nextAction: "Reminder dispatched and follow-up scheduled.",
  });
  const reminder = await buildCollectionsReminder(reminderSeed);
  const followUpAt = new Date(now().getTime() + 72 * 60 * 60 * 1000);

  await db.transaction(async (tx) => {
    const nextNotes = [
      "Reminder dispatched from collections workflow.",
      ...(caseRow.notes ?? []),
    ];
    await tx
      .update(schema.collectionCases)
      .set({
        status: "reminder_sent",
        lastContactAt: now(),
        notes: nextNotes,
        updatedAt: now(),
      })
      .where(eq(schema.collectionCases.id, caseRow.id));

    await tx.insert(schema.collectionActivities).values({
      id: createId("collect_activity"),
      collectionCaseId: caseRow.id,
      activityType: "email",
      performedByUserId: userId ?? null,
      note: reminder.data.subject,
      payload: reminder.data,
      createdAt: now(),
    });
  });

  await enqueueCollectionsEvaluationJob({
    collectionCaseId: caseRow.id,
    customerId: caseRow.customerId,
    invoiceId: caseRow.invoiceId ?? null,
    availableAt: followUpAt,
    reason: "post_reminder_follow_up",
  });

  const emailAddress =
    typeof customer.contactInfo?.email === "string" ? customer.contactInfo.email : null;
  if (emailAddress) {
    await sendTransactionalEmail({
      to: emailAddress,
      subject: reminder.data.subject,
      text: reminder.data.body,
      relatedEntityType: "collection_case",
      relatedEntityId: caseRow.id,
    });
  }

  await pushAudit({
    entityType: "collection_case",
    entityId: caseRow.id,
    eventType: "reminder_sent",
    userId,
    metadata: {
      invoiceNumber: invoice?.invoiceNumber ?? null,
    },
  });

  return {
    caseRecord: requireRecord(
      (await listCollectionCases()).find((entry) => entry.id === caseRow.id),
      `Collection case ${caseRow.id} not found after reminder.`,
    ),
    reminder: reminder.data,
  };
}

export async function updateCollectionCase(
  collectionCaseId: string,
  payload: UpdateCollectionCaseInput,
  userId?: string,
) {
  const caseRow = await ensureOpenCollectionCase(collectionCaseId, userId);
  const invoice = caseRow.invoiceId
    ? await db.query.invoices.findFirst({
        where: (table, { eq: localEq }) => localEq(table.id, caseRow.invoiceId as string),
      })
    : null;
  const existingNotes = caseRow.notes ?? [];
  const nextNotes = payload.note ? [payload.note, ...existingNotes] : existingNotes;
  const nextStatus = payload.status
    ? normalizeCollectionStatus(payload.status)
    : caseRow.status;
  const promiseDate =
    payload.promisedPaymentDate === undefined
      ? caseRow.promisedPaymentDate
      : payload.promisedPaymentDate
        ? new Date(payload.promisedPaymentDate)
        : null;
  const activityType: typeof schema.collectionActivities.$inferInsert.activityType =
    promiseDate
      ? "promise_to_pay"
      : nextStatus === "disputed"
        ? "dispute"
        : nextStatus === "escalated"
          ? "escalation"
          : "note";

  await db.transaction(async (tx) => {
    await tx
      .update(schema.collectionCases)
      .set({
        status: nextStatus,
        promisedPaymentDate: promiseDate,
        lastContactAt: now(),
        notes: nextNotes,
        updatedAt: now(),
      })
      .where(eq(schema.collectionCases.id, caseRow.id));

    if (payload.note || promiseDate || payload.status) {
      await tx.insert(schema.collectionActivities).values({
        id: createId("collect_activity"),
        collectionCaseId: caseRow.id,
        activityType,
        performedByUserId: userId ?? null,
        note: payload.note ?? `Collection case updated to ${nextStatus}.`,
        payload: {
          status: nextStatus,
          promisedPaymentDate: toIso(promiseDate),
          promisedPaymentAmount: payload.promisedPaymentAmount ?? null,
        },
        createdAt: now(),
      });
    }

    if (promiseDate) {
      await tx.insert(schema.promisedPayments).values({
        id: createId("promise"),
        collectionCaseId: caseRow.id,
        amount: String(
          payload.promisedPaymentAmount ?? numericToNumber(invoice?.balanceAmount),
        ),
        promisedFor: promiseDate,
        status: "open",
        notes: payload.note ?? null,
        createdAt: now(),
      });
    }
  });

  await enqueueCollectionsEvaluationJob({
    collectionCaseId: caseRow.id,
    customerId: caseRow.customerId,
    invoiceId: caseRow.invoiceId ?? null,
    availableAt: promiseDate ?? undefined,
    reason: promiseDate ? "promise_to_pay_recorded" : "case_updated",
  });

  await pushAudit({
    entityType: "collection_case",
    entityId: caseRow.id,
    eventType: "updated",
    userId,
    metadata: {
      status: nextStatus,
      promisedPaymentAmount: payload.promisedPaymentAmount ?? null,
    },
  });

  return requireRecord(
    (await listCollectionCases()).find((entry) => entry.id === caseRow.id),
    `Collection case ${caseRow.id} not found after update.`,
  );
}

export async function listTelematics(assetNumber?: string) {
  const rows = await db
    .select({
      id: schema.telematicsPings.id,
      assetNumber: schema.assets.assetNumber,
      provider: schema.telematicsPings.provider,
      latitude: schema.telematicsPings.latitude,
      longitude: schema.telematicsPings.longitude,
      speedMph: schema.telematicsPings.speedMph,
      heading: schema.telematicsPings.heading,
      capturedAt: schema.telematicsPings.capturedAt,
      gpsDeviceId: schema.assets.gpsDeviceId,
      externalAssetId: schema.assets.skybitzAssetId,
      rawPayload: schema.telematicsPings.rawPayload,
    })
    .from(schema.telematicsPings)
    .innerJoin(schema.assets, eq(schema.telematicsPings.assetId, schema.assets.id))
    .orderBy(desc(schema.telematicsPings.capturedAt));

  return rows
    .map(mapTelematicsRow)
    .filter((record) => (assetNumber ? record.assetNumber === assetNumber : true));
}

export async function scheduleSkybitzPulls(options?: {
  branchId?: string;
  userId?: string;
}) {
  const assets = await db
    .select({
      id: schema.assets.id,
      assetNumber: schema.assets.assetNumber,
      gpsDeviceId: schema.assets.gpsDeviceId,
      skybitzAssetId: schema.assets.skybitzAssetId,
      branchId: schema.assets.branchId,
    })
    .from(schema.assets)
    .where(
      options?.branchId
        ? and(
            eq(schema.assets.branchId, options.branchId),
            or(
              eq(schema.assets.telematicsProvider, "skybitz"),
              isNull(schema.assets.telematicsProvider),
            ),
          )
        : or(
            eq(schema.assets.telematicsProvider, "skybitz"),
            isNull(schema.assets.telematicsProvider),
          ),
    );

  let scheduled = 0;
  for (const asset of assets) {
    if (!asset.gpsDeviceId && !asset.skybitzAssetId) {
      continue;
    }

    await ensureSkybitzMapping(asset);
    await enqueueSkybitzPullJob({
      assetId: asset.id,
      assetNumber: asset.assetNumber,
      gpsDeviceId: asset.gpsDeviceId ?? null,
      externalAssetId: asset.skybitzAssetId ?? null,
      reason: "scheduled_branch_pull",
    });
    scheduled += 1;
  }

  await pushAudit({
    entityType: "asset",
    entityId: options?.branchId ?? "all_branches",
    eventType: "telematics_pull_scheduled",
    userId: options?.userId,
    metadata: {
      branchId: options?.branchId ?? null,
      scheduled,
    },
  });

  return {
    scheduled,
  };
}

export async function syncTelematics(assetNumber: string, userId?: string) {
  const asset = await getAssetByIdOrNumber(assetNumber);
  const mapping = await ensureSkybitzMapping(asset);
  const lastKnown = await getLatestTelematicsPing(asset.id);

  await enqueueSkybitzPullJob({
    assetId: asset.id,
    assetNumber: asset.assetNumber,
    gpsDeviceId: asset.gpsDeviceId ?? null,
    externalAssetId: mapping?.externalId ?? asset.skybitzAssetId ?? null,
    reason: "manual_sync",
  });

  const latitude = lastKnown ? numericToNumber(lastKnown.latitude) : 39.7392;
  const longitude = lastKnown ? numericToNumber(lastKnown.longitude) : -104.9903;
  const pingId = createId("tp");

  await db.insert(schema.telematicsPings).values({
    id: pingId,
    assetId: asset.id,
    provider: "skybitz",
    latitude: latitude.toFixed(6),
    longitude: longitude.toFixed(6),
    heading: lastKnown?.heading ?? 0,
    speedMph: lastKnown?.speedMph ? String(lastKnown.speedMph) : "0.00",
    capturedAt: now(),
    rawPayload: {
      source: "manual_sync_projection",
      assetNumber: asset.assetNumber,
      gpsDeviceId: asset.gpsDeviceId ?? null,
      externalAssetId: mapping?.externalId ?? asset.skybitzAssetId ?? null,
      previousPingId: lastKnown?.id ?? null,
    },
    createdAt: now(),
  });

  await pushAudit({
    entityType: "asset",
    entityId: asset.id,
    eventType: "telematics_synced",
    userId,
    metadata: {
      pingId,
      provider: "skybitz",
      projection: true,
    },
  });

  return requireRecord(
    (await listTelematics(asset.assetNumber)).find((entry) => entry.id === pingId),
    `Telematics ping ${pingId} not found after sync.`,
  );
}

export async function evaluateCollectionsWorklist(collectionCaseId?: string, userId?: string) {
  const cases = collectionCaseId
    ? [await ensureOpenCollectionCase(collectionCaseId, userId)]
    : await db.query.collectionCases.findMany();

  let evaluated = 0;
  let remindersQueued = 0;
  let escalated = 0;

  for (const caseRow of cases) {
    const invoice = caseRow.invoiceId
      ? await db.query.invoices.findFirst({
          where: (table, { eq: localEq }) => localEq(table.id, caseRow.invoiceId as string),
        })
      : null;

    const analytics = await getCollectionCaseAnalytics([caseRow.id]);
    const insight = analytics.get(caseRow.id);
    const cadence = evaluateCollectionsCadence({
      dueDate: invoice?.dueDate ?? null,
      balanceAmount: numericToNumber(invoice?.balanceAmount),
      reminderCount: insight?.reminderCount ?? 0,
      promisedPaymentDate: caseRow.promisedPaymentDate,
      lastContactAt: caseRow.lastContactAt,
    });

    await db
      .update(schema.collectionCases)
      .set({
        status: cadence.suggestedStatus,
        updatedAt: now(),
      })
      .where(eq(schema.collectionCases.id, caseRow.id));

    if (cadence.shouldEscalate) {
      escalated += 1;
      await db.insert(schema.collectionActivities).values({
        id: createId("collect_activity"),
        collectionCaseId: caseRow.id,
        activityType: "escalation",
        performedByUserId: userId ?? null,
        note: cadence.nextAction,
        payload: {
          overdueDays: cadence.overdueDays,
        },
        createdAt: now(),
      });
    }

    if (cadence.shouldRemind && invoice?.balanceAmount) {
      await enqueueCollectionsEvaluationJob({
        collectionCaseId: caseRow.id,
        customerId: caseRow.customerId,
        invoiceId: caseRow.invoiceId ?? null,
        reason: "cadence_reminder_due",
      });
      remindersQueued += 1;
    }

    evaluated += 1;
  }

  await pushAudit({
    entityType: "collection_case",
    entityId: collectionCaseId ?? "all_open_cases",
    eventType: "cadence_evaluated",
    userId,
    metadata: {
      evaluated,
      remindersQueued,
      escalated,
    },
  });

  return { evaluated, remindersQueued, escalated };
}

export async function listIntegrationJobs(filters?: {
  provider?: string;
  status?: string;
}) {
  const syncRows = await db
    .select({
      id: schema.integrationSyncJobs.id,
      provider: schema.integrationSyncJobs.provider,
      entityType: schema.integrationSyncJobs.entityType,
      entityId: schema.integrationSyncJobs.entityId,
      direction: schema.integrationSyncJobs.direction,
      status: schema.integrationSyncJobs.status,
      startedAt: schema.integrationSyncJobs.startedAt,
      finishedAt: schema.integrationSyncJobs.finishedAt,
      lastError: schema.integrationSyncJobs.lastError,
    })
    .from(schema.integrationSyncJobs)
    .orderBy(desc(schema.integrationSyncJobs.startedAt))
    .limit(40);

  const outboxRows = await db
    .select({
      id: schema.outboxJobs.id,
      provider: schema.outboxJobs.provider,
      entityType: schema.outboxJobs.aggregateType,
      entityId: schema.outboxJobs.aggregateId,
      jobType: schema.outboxJobs.jobType,
      status: schema.outboxJobs.status,
      startedAt: schema.outboxJobs.startedAt,
      availableAt: schema.outboxJobs.availableAt,
      finishedAt: schema.outboxJobs.finishedAt,
      lastError: schema.outboxJobs.lastError,
    })
    .from(schema.outboxJobs)
    .where(or(eq(schema.outboxJobs.status, "pending"), eq(schema.outboxJobs.status, "failed")))
    .orderBy(desc(schema.outboxJobs.createdAt))
    .limit(40);

  const mapped = [
    ...syncRows.map(mapIntegrationJobRow),
    ...outboxRows
      .filter((row) => row.provider)
      .map((row) =>
        mapIntegrationJobRow({
          id: row.id,
          provider: row.provider as string,
          entityType: row.entityType,
          entityId: row.entityId,
          direction: row.jobType.startsWith("telematics.pull")
            ? "pull"
            : row.jobType.startsWith("webhook.process")
              ? "webhook"
              : "push",
          status: row.status,
          startedAt: row.startedAt ?? row.availableAt,
          finishedAt: row.finishedAt,
          lastError: row.lastError,
        }),
      ),
  ]
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .slice(0, 40);

  return mapped.filter((job) => {
    if (filters?.provider && job.provider.toLowerCase() !== filters.provider.toLowerCase()) {
      return false;
    }
    if (filters?.status && job.status !== filters.status) {
      return false;
    }
    return true;
  });
}

export async function getCollectionsRecoverySnapshot(assetNumber: string) {
  const asset = await getAssetByIdOrNumber(assetNumber);
  const lastKnown = requireRecord(
    (await listTelematics(asset.assetNumber))[0],
    `No telematics data is available for ${asset.assetNumber}.`,
  );
  const [activeContract] = await db
    .select({
      customerName: schema.customers.name,
      branchName: schema.branches.name,
      customerId: schema.contracts.customerId,
    })
    .from(schema.contractLines)
    .innerJoin(schema.contracts, eq(schema.contractLines.contractId, schema.contracts.id))
    .innerJoin(schema.customers, eq(schema.contracts.customerId, schema.customers.id))
    .innerJoin(schema.branches, eq(schema.contracts.branchId, schema.branches.id))
    .where(
      and(
        eq(schema.contractLines.assetId, asset.id),
        inArray(schema.contracts.status, ["reserved", "active", "completed"]),
      ),
    )
    .orderBy(desc(schema.contracts.updatedAt))
    .limit(1);

  const openInvoices = activeContract
    ? await db
        .select({
          invoiceNumber: schema.invoices.invoiceNumber,
          balanceAmount: schema.invoices.balanceAmount,
          dueDate: schema.invoices.dueDate,
          status: schema.invoices.status,
          promisedPaymentDate: schema.collectionCases.promisedPaymentDate,
        })
        .from(schema.invoices)
        .leftJoin(schema.collectionCases, eq(schema.collectionCases.invoiceId, schema.invoices.id))
        .where(
          and(
            eq(schema.invoices.customerId, activeContract.customerId),
            inArray(schema.invoices.status, ["sent", "partially_paid", "overdue"]),
          ),
        )
        .orderBy(desc(schema.invoices.dueDate))
    : [];

  const totalOverdueBalance = openInvoices.reduce(
    (sum, invoice) => sum + numericToNumber(invoice.balanceAmount),
    0,
  );
  const promisedPaymentDate =
    openInvoices.find((invoice) => invoice.promisedPaymentDate)?.promisedPaymentDate ?? null;
  const stale = lastKnown.stale ?? false;
  const nextAction =
    totalOverdueBalance <= 0
      ? "No overdue balance remains for the current customer."
      : stale
        ? "Telematics is stale and customer balance is open. Escalate recovery outreach and request a fresh SkyBitz ping."
        : "Use the latest telematics position during collections outreach and recovery planning.";

  return buildTelematicsRecoverySnapshot({
    assetNumber: asset.assetNumber,
    lastKnown,
    branchName: activeContract?.branchName ?? null,
    customerName: activeContract?.customerName ?? null,
    openInvoices: openInvoices.map((invoice) => ({
      invoiceNumber: invoice.invoiceNumber,
      balanceAmount: numericToNumber(invoice.balanceAmount),
      dueDate: toIso(invoice.dueDate) ?? new Date(0).toISOString(),
      status: invoice.status,
    })),
    promisedPaymentDate: toIso(promisedPaymentDate),
    totalOverdueBalance,
    stale,
    nextAction,
  });
}

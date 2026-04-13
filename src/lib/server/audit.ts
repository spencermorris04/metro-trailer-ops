import { db, schema } from "@/lib/db";
import { auditDb, isDedicatedAuditStoreConfigured } from "@/lib/server/audit-db";
import { createId, now } from "@/lib/server/production-utils";
import { isProductionRuntime } from "@/lib/server/runtime";

type AuditEnvelope = {
  entityType: typeof schema.auditEvents.$inferInsert.entityType;
  entityId: string;
  eventType: string;
  userId?: string | null;
  metadata?: Record<string, unknown>;
  correlationId?: string | null;
  requestId?: string | null;
};

type PersistedAuditEnvelope = AuditEnvelope & {
  id: string;
  createdAt: Date;
};

function toAuditInsert(envelope: PersistedAuditEnvelope) {
  return {
    id: envelope.id,
    entityType: envelope.entityType,
    entityId: envelope.entityId,
    eventType: envelope.eventType,
    userId: envelope.userId ?? null,
    metadata: envelope.metadata ?? {},
    createdAt: envelope.createdAt,
  };
}

async function shadowWriteAudit(envelope: PersistedAuditEnvelope) {
  await db.insert(schema.auditEvents).values({
    ...toAuditInsert(envelope),
  });
}

async function enqueueAuditRetry(envelope: PersistedAuditEnvelope, error: unknown) {
  await db.insert(schema.outboxJobs).values({
    id: createId("outbox"),
    jobType: "audit.write",
    status: "pending",
    aggregateType: envelope.entityType,
    aggregateId: envelope.entityId,
    provider: "internal",
    correlationId: envelope.correlationId ?? envelope.requestId ?? null,
    payload: {
      envelope: {
        id: envelope.id,
        entityType: envelope.entityType,
        entityId: envelope.entityId,
        eventType: envelope.eventType,
        userId: envelope.userId ?? null,
        metadata: envelope.metadata ?? {},
        createdAt: envelope.createdAt.toISOString(),
      },
      auditFailure: error instanceof Error ? error.message : String(error),
    },
    attempts: 0,
    maxAttempts: 25,
    availableAt: now(),
    deadLetterReason: null,
    createdAt: now(),
  });
}

export async function appendAuditEvent(options: AuditEnvelope) {
  const envelope: PersistedAuditEnvelope = {
    ...options,
    id: createId("audit"),
    createdAt: now(),
  };

  const metadata = {
    ...(options.metadata ?? {}),
    auditContext: {
      correlationId: options.correlationId ?? null,
      requestId: options.requestId ?? null,
      dedicatedAuditStore: isDedicatedAuditStoreConfigured(),
    },
  };
  envelope.metadata = metadata;

  if (!isProductionRuntime()) {
    await shadowWriteAudit(envelope);
    return {
      id: envelope.id,
      deferred: false,
    };
  }

  try {
    await auditDb.insert(schema.auditEvents).values(toAuditInsert(envelope));
  } catch (error) {
    await enqueueAuditRetry(envelope, error);
    console.error(
      JSON.stringify({
        level: "error",
        event: "audit.write.failed",
        auditId: envelope.id,
        entityType: envelope.entityType,
        entityId: envelope.entityId,
        message: error instanceof Error ? error.message : String(error),
      }),
    );

    return {
      id: envelope.id,
      deferred: true,
    };
  }

  await shadowWriteAudit(envelope);

  return {
    id: envelope.id,
    deferred: false,
  };
}

export async function replayDeferredAuditEnvelope(
  envelope: PersistedAuditEnvelope,
) {
  await auditDb.insert(schema.auditEvents).values(toAuditInsert(envelope));

  const existing = await db.query.auditEvents.findFirst({
    where: (table, { eq: localEq }) => localEq(table.id, envelope.id),
  });

  if (!existing) {
    await shadowWriteAudit(envelope);
  }
}

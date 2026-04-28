import { and, asc, eq, inArray, lte } from "drizzle-orm";

import { db, pool, schema } from "@/lib/db";
import { createId, now } from "@/lib/server/production-utils";
import { isProductionRuntime } from "@/lib/server/runtime";

type Provider =
  | "stripe"
  | "quickbooks"
  | "business_central"
  | "record360"
  | "skybitz"
  | "internal_esign"
  | "internal";

type EnqueueOutboxOptions = {
  jobType: string;
  aggregateType: string;
  aggregateId: string;
  provider?: Provider;
  payload: Record<string, unknown>;
  idempotencyKey?: string | null;
  correlationId?: string | null;
  availableAt?: Date;
  maxAttempts?: number;
};

type RecordWebhookReceiptOptions = {
  provider: "stripe" | "quickbooks" | "record360";
  signature?: string | null;
  externalEventId?: string | null;
  headers: Record<string, unknown>;
  payload: Record<string, unknown>;
  verified: boolean;
  verificationError?: string | null;
};

export type OutboxJobRecord = typeof schema.outboxJobs.$inferSelect;
export type WebhookReceiptRecord = typeof schema.webhookReceipts.$inferSelect;

function computeBackoffMinutes(attempts: number) {
  return Math.min(60, Math.max(1, attempts * 5));
}

export async function enqueueOutboxJob(options: EnqueueOutboxOptions) {
  if (!isProductionRuntime()) {
    return null;
  }

  const createdAt = now();
  const outboxId = createId("outbox");

  await db.insert(schema.outboxJobs).values({
    id: outboxId,
    jobType: options.jobType,
    status: "pending",
    aggregateType: options.aggregateType,
    aggregateId: options.aggregateId,
    provider: options.provider ?? null,
    idempotencyKey: options.idempotencyKey ?? null,
    correlationId: options.correlationId ?? null,
    payload: options.payload,
    attempts: 0,
    maxAttempts: options.maxAttempts ?? 10,
    availableAt: options.availableAt ?? createdAt,
    createdAt,
  });

  if (options.provider) {
    const providerEventId =
      typeof options.payload.externalEventId === "string"
        ? options.payload.externalEventId
        : typeof options.payload.providerEventId === "string"
          ? options.payload.providerEventId
          : null;
    await db.insert(schema.integrationSyncJobs).values({
      id: createId("sync"),
      provider: options.provider,
      entityType: options.aggregateType,
      entityId: options.aggregateId,
      direction: options.jobType.startsWith("webhook.process.")
        ? "webhook"
        : options.jobType.startsWith("telematics.pull.")
          ? "pull"
          : "push",
      status: "pending",
      providerEventId,
      providerAttemptCount: 0,
      lastProcessedAt: null,
      payload: {
        outboxJobId: outboxId,
        jobType: options.jobType,
        ...options.payload,
      },
      startedAt: createdAt,
    });
  }

  return outboxId;
}

export async function recordWebhookReceipt(options: RecordWebhookReceiptOptions) {
  if (!isProductionRuntime()) {
    return null;
  }

  const receiptId = createId("wh");

  try {
    await db.insert(schema.webhookReceipts).values({
      id: receiptId,
      provider: options.provider,
      signature: options.signature ?? null,
      externalEventId: options.externalEventId ?? null,
      headers: options.headers,
      payload: options.payload,
      verified: options.verified,
      verificationError: options.verificationError ?? null,
      status: "received",
      attempts: 0,
      receivedAt: now(),
    });

    return receiptId;
  } catch (error) {
    if (!options.externalEventId) {
      throw error;
    }

    const existing = await db.query.webhookReceipts.findFirst({
      where: (table, { and: localAnd, eq: localEq }) =>
        localAnd(
          localEq(table.provider, options.provider),
          localEq(table.externalEventId, options.externalEventId!),
        ),
    });

    if (!existing) {
      throw error;
    }

    return existing.id;
  }
}

export async function getWebhookReceipt(receiptId: string) {
  return db.query.webhookReceipts.findFirst({
    where: (table, { eq: localEq }) => localEq(table.id, receiptId),
  });
}

export async function markWebhookReceiptProcessed(receiptId: string) {
  await db
    .update(schema.webhookReceipts)
    .set({
      status: "processed",
      processedAt: now(),
      lastAttemptAt: now(),
      processingError: null,
    })
    .where(eq(schema.webhookReceipts.id, receiptId));
}

export async function markWebhookReceiptIgnored(
  receiptId: string,
  reason: string | null = null,
) {
  await db
    .update(schema.webhookReceipts)
    .set({
      status: "ignored",
      processedAt: now(),
      processingError: reason,
    })
    .where(eq(schema.webhookReceipts.id, receiptId));
}

export async function markWebhookReceiptFailed(receiptId: string, error: string) {
  await db
    .update(schema.webhookReceipts)
    .set({
      status: "failed",
      processingError: error,
      lastAttemptAt: now(),
    })
    .where(eq(schema.webhookReceipts.id, receiptId));
}

export async function incrementWebhookReceiptAttempt(receiptId: string) {
  const [receipt] = await db
    .select({
      attempts: schema.webhookReceipts.attempts,
    })
    .from(schema.webhookReceipts)
    .where(eq(schema.webhookReceipts.id, receiptId))
    .limit(1);

  const attempts = (receipt?.attempts ?? 0) + 1;

  await db
    .update(schema.webhookReceipts)
    .set({
      attempts,
      lastAttemptAt: now(),
    })
    .where(eq(schema.webhookReceipts.id, receiptId));

  return attempts;
}

export async function getOutboxJob(jobId: string) {
  return db.query.outboxJobs.findFirst({
    where: (table, { eq: localEq }) => localEq(table.id, jobId),
  });
}

export async function claimOutboxJobs(options: {
  workerId: string;
  limit: number;
  jobTypes?: string[];
}) {
  if (!isProductionRuntime()) {
    return [];
  }

  const params: unknown[] = [options.workerId, options.limit];
  const jobTypeSql =
    options.jobTypes && options.jobTypes.length > 0
      ? `and job_type = any($3::text[])`
      : "";

  if (options.jobTypes && options.jobTypes.length > 0) {
    params.push(options.jobTypes);
  }

  const query = `
    with candidates as (
      select id
      from outbox_jobs
      where status in ('pending', 'failed')
        and available_at <= now()
        and dead_lettered_at is null
        ${jobTypeSql}
      order by available_at asc, created_at asc
      for update skip locked
      limit $2
    )
    update outbox_jobs
    set
      status = 'processing',
      locked_by = $1,
      started_at = now(),
      last_attempt_at = now()
    where id in (select id from candidates)
    returning
      id,
      job_type as "jobType",
      status,
      aggregate_type as "aggregateType",
      aggregate_id as "aggregateId",
      provider,
      idempotency_key as "idempotencyKey",
      correlation_id as "correlationId",
      payload,
      attempts,
      max_attempts as "maxAttempts",
      available_at as "availableAt",
      locked_by as "lockedBy",
      started_at as "startedAt",
      last_attempt_at as "lastAttemptAt",
      finished_at as "finishedAt",
      last_error as "lastError",
      dead_lettered_at as "deadLetteredAt",
      dead_letter_reason as "deadLetterReason",
      created_at as "createdAt"
  `;

  const result = await pool.query<OutboxJobRecord>(query, params);
  return result.rows;
}

export async function markOutboxJobSucceeded(
  jobId: string,
  details?: Record<string, unknown>,
) {
  const job = await getOutboxJob(jobId);
  if (!job) {
    return;
  }

  await db
    .update(schema.outboxJobs)
    .set({
      status: "succeeded",
      lockedBy: null,
      finishedAt: now(),
      lastError: null,
      payload: details ? { ...job.payload, result: details } : job.payload,
    })
    .where(eq(schema.outboxJobs.id, jobId));
}

export async function markOutboxJobFailed(jobId: string, error: string) {
  const job = await getOutboxJob(jobId);
  if (!job) {
    return;
  }

  const attempts = job.attempts + 1;
  const deadLetter = attempts >= job.maxAttempts;
  const availableAt = new Date(now().getTime() + computeBackoffMinutes(attempts) * 60_000);

  await db
    .update(schema.outboxJobs)
    .set({
      status: deadLetter ? "dead_letter" : "failed",
      attempts,
      lockedBy: null,
      availableAt: deadLetter ? job.availableAt : availableAt,
      finishedAt: deadLetter ? now() : null,
      lastError: error,
      deadLetteredAt: deadLetter ? now() : null,
      deadLetterReason: deadLetter ? error : null,
    })
    .where(eq(schema.outboxJobs.id, jobId));
}

export async function replayOutboxJob(jobId: string) {
  const job = await getOutboxJob(jobId);
  if (!job) {
    return null;
  }

  await db
    .update(schema.outboxJobs)
    .set({
      status: "pending",
      lockedBy: null,
      startedAt: null,
      finishedAt: null,
      lastError: null,
      availableAt: now(),
      deadLetteredAt: null,
      deadLetterReason: null,
    })
    .where(eq(schema.outboxJobs.id, jobId));

  return getOutboxJob(jobId);
}

export async function replayWebhookReceipt(receiptId: string) {
  const receipt = await getWebhookReceipt(receiptId);
  if (!receipt) {
    return null;
  }

  await db
    .update(schema.webhookReceipts)
    .set({
      status: "received",
      processingError: null,
      processedAt: null,
      lastAttemptAt: null,
    })
    .where(eq(schema.webhookReceipts.id, receiptId));

  await enqueueOutboxJob({
    jobType: `webhook.process.${receipt.provider}`,
    aggregateType: "webhook_receipt",
    aggregateId: receiptId,
    provider: receipt.provider,
    payload: {
      receiptId,
      externalEventId: receipt.externalEventId,
      providerEventId: receipt.externalEventId,
      verified: receipt.verified,
    },
  });

  return getWebhookReceipt(receiptId);
}

export async function listPendingOutboxJobs(jobTypes?: string[]) {
  const predicates = [
    inArray(schema.outboxJobs.status, ["pending", "failed"]),
    lte(schema.outboxJobs.availableAt, now()),
  ];

  if (jobTypes && jobTypes.length > 0) {
    predicates.push(inArray(schema.outboxJobs.jobType, jobTypes));
  }

  return db
    .select()
    .from(schema.outboxJobs)
    .where(and(...predicates))
    .orderBy(asc(schema.outboxJobs.availableAt), asc(schema.outboxJobs.createdAt));
}

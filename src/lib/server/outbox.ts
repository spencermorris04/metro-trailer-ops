import { db, schema } from "@/lib/db";
import { createId, now } from "@/lib/server/production-utils";
import { isProductionRuntime } from "@/lib/server/runtime";

type EnqueueOutboxOptions = {
  jobType: string;
  aggregateType: string;
  aggregateId: string;
  provider?: "stripe" | "quickbooks" | "record360" | "skybitz" | "internal_esign" | "internal";
  payload: Record<string, unknown>;
  idempotencyKey?: string | null;
};

export async function enqueueOutboxJob(options: EnqueueOutboxOptions) {
  if (!isProductionRuntime()) {
    return null;
  }

  const startedAt = now();
  const outboxId = createId("outbox");

  await db.insert(schema.outboxJobs).values({
    id: outboxId,
    jobType: options.jobType,
    status: "pending",
    aggregateType: options.aggregateType,
    aggregateId: options.aggregateId,
    provider: options.provider ?? null,
    idempotencyKey: options.idempotencyKey ?? null,
    payload: options.payload,
    attempts: 0,
    availableAt: startedAt,
    createdAt: startedAt,
  });

  if (options.provider) {
    await db.insert(schema.integrationSyncJobs).values({
      id: createId("sync"),
      provider: options.provider,
      entityType: options.aggregateType,
      entityId: options.aggregateId,
      direction: "push",
      status: "pending",
      payload: options.payload,
      startedAt,
    });
  }

  return outboxId;
}

export async function recordWebhookReceipt(options: {
  provider: "stripe" | "quickbooks" | "record360";
  signature?: string | null;
  externalEventId?: string | null;
  headers: Record<string, unknown>;
  payload: Record<string, unknown>;
}) {
  if (!isProductionRuntime()) {
    return null;
  }

  const receiptId = createId("wh");
  await db.insert(schema.webhookReceipts).values({
    id: receiptId,
    provider: options.provider,
    signature: options.signature ?? null,
    externalEventId: options.externalEventId ?? null,
    headers: options.headers,
    payload: options.payload,
    status: "received",
    receivedAt: now(),
  });

  return receiptId;
}

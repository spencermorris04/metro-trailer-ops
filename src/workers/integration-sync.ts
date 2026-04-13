import { eq } from "drizzle-orm";

import { db, schema } from "@/lib/db";
import { createId, now } from "@/lib/server/production-utils";

export async function markLatestIntegrationSyncJob(options: {
  provider: typeof schema.integrationSyncJobs.$inferInsert.provider;
  entityType: string;
  entityId: string;
  status: typeof schema.integrationSyncJobs.$inferInsert.status;
  lastError?: string | null;
  payloadPatch?: Record<string, unknown>;
}) {
  const job = await db.query.integrationSyncJobs.findFirst({
    where: (table, { and, eq: localEq }) =>
      and(
        localEq(table.provider, options.provider),
        localEq(table.entityType, options.entityType),
        localEq(table.entityId, options.entityId),
      ),
    orderBy: (table, { desc: localDesc }) => [localDesc(table.startedAt)],
  });

  if (!job) {
    return null;
  }

  const payload =
    job.payload && typeof job.payload === "object"
      ? (job.payload as Record<string, unknown>)
      : {};

  await db
    .update(schema.integrationSyncJobs)
    .set({
      status: options.status,
      lastError: options.lastError ?? null,
      finishedAt: now(),
      payload: options.payloadPatch ? { ...payload, ...options.payloadPatch } : payload,
    })
    .where(eq(schema.integrationSyncJobs.id, job.id));

  return job.id;
}

export async function appendIntegrationSyncJob(options: {
  provider: typeof schema.integrationSyncJobs.$inferInsert.provider;
  entityType: string;
  entityId: string;
  direction: typeof schema.integrationSyncJobs.$inferInsert.direction;
  payload?: Record<string, unknown>;
}) {
  await db.insert(schema.integrationSyncJobs).values({
    id: createId("sync"),
    provider: options.provider,
    entityType: options.entityType,
    entityId: options.entityId,
    direction: options.direction,
    status: "pending",
    payload: options.payload ?? {},
    startedAt: now(),
  });
}

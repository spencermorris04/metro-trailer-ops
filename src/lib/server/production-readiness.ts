import { and, desc, eq, sql } from "drizzle-orm";

import { db, schema } from "@/lib/db";
import { getAuditStoreReadiness } from "@/lib/server/audit-db";
import { getWorkflowFlags, type WorkflowKey } from "@/lib/server/feature-flags";
import { getS3Bucket, isS3StorageEnabled } from "@/lib/server/object-storage";
import { getObservabilityConfig } from "@/lib/server/observability";
import { isProductionRuntime } from "@/lib/server/runtime";

type ReadinessStatus = "ready" | "degraded" | "missing" | "disabled";

function hasEnv(name: string) {
  return Boolean(process.env[name]?.trim());
}

function buildCheck(
  status: ReadinessStatus,
  required: boolean,
  details: Record<string, unknown> = {},
) {
  return {
    status,
    required,
    details,
  };
}

function getWorkflowStatus(workflow: WorkflowKey) {
  return getWorkflowFlags().workflows[workflow];
}

export async function buildDependencyReadiness() {
  const auditStore = getAuditStoreReadiness();
  const checks = {
    database: buildCheck(hasEnv("DATABASE_URL") ? "ready" : "missing", true),
    auditStore: buildCheck(
      auditStore.productionSafe
        ? "ready"
        : auditStore.sameDatabase || auditStore.requiredInProduction
          ? "degraded"
          : "missing",
      isProductionRuntime(),
      auditStore,
    ),
    workers: buildCheck(
      hasEnv("METRO_TRAILER_WORKER_ENABLED") || hasEnv("METRO_TRAILER_WORKER_ID")
        ? "ready"
        : "degraded",
      isProductionRuntime(),
    ),
    stripe: buildCheck(
      !getWorkflowStatus("payments")
        ? "disabled"
        : hasEnv("STRIPE_SECRET_KEY") &&
            hasEnv("STRIPE_WEBHOOK_SECRET") &&
            hasEnv("APP_URL")
          ? "ready"
          : "degraded",
      getWorkflowStatus("payments"),
      {
        secretKey: hasEnv("STRIPE_SECRET_KEY"),
        webhookSecret: hasEnv("STRIPE_WEBHOOK_SECRET"),
      },
    ),
    quickbooks: buildCheck(
      !getWorkflowStatus("quickbooks")
        ? "disabled"
        : hasEnv("QUICKBOOKS_CLIENT_ID") &&
            hasEnv("QUICKBOOKS_CLIENT_SECRET") &&
            hasEnv("QUICKBOOKS_REDIRECT_URI") &&
            hasEnv("QUICKBOOKS_WEBHOOK_VERIFIER_TOKEN")
          ? "ready"
          : "degraded",
      getWorkflowStatus("quickbooks"),
      {
        clientId: hasEnv("QUICKBOOKS_CLIENT_ID"),
        clientSecret: hasEnv("QUICKBOOKS_CLIENT_SECRET"),
        redirectUri: hasEnv("QUICKBOOKS_REDIRECT_URI"),
        webhookVerifier: hasEnv("QUICKBOOKS_WEBHOOK_VERIFIER_TOKEN"),
      },
    ),
    record360: buildCheck(
      !getWorkflowStatus("record360")
        ? "disabled"
        : hasEnv("RECORD360_API_KEY") &&
            hasEnv("RECORD360_ACCOUNT_ID") &&
            hasEnv("RECORD360_WEBHOOK_SECRET")
          ? "ready"
          : "degraded",
      getWorkflowStatus("record360"),
      {
        apiKey: hasEnv("RECORD360_API_KEY"),
        accountId: hasEnv("RECORD360_ACCOUNT_ID"),
        webhookSecret: hasEnv("RECORD360_WEBHOOK_SECRET"),
      },
    ),
    telematics: buildCheck(
      !getWorkflowStatus("telematics")
        ? "disabled"
        : hasEnv("SKYBITZ_API_URL") && hasEnv("SKYBITZ_API_TOKEN")
          ? "ready"
          : "degraded",
      getWorkflowStatus("telematics"),
      {
        apiUrl: hasEnv("SKYBITZ_API_URL"),
        apiToken: hasEnv("SKYBITZ_API_TOKEN"),
      },
    ),
    objectStorage: buildCheck(
      !getWorkflowStatus("documents") && !getWorkflowStatus("signatures")
        ? "disabled"
        : isS3StorageEnabled() && Boolean(getS3Bucket()) && hasEnv("S3_OBJECT_LOCK_MODE")
          ? "ready"
          : "degraded",
      getWorkflowStatus("documents") || getWorkflowStatus("signatures"),
      {
        s3Enabled: isS3StorageEnabled(),
        bucket: getS3Bucket(),
        objectLockMode: process.env.S3_OBJECT_LOCK_MODE ?? null,
      },
    ),
    email: buildCheck(
      !getWorkflowStatus("signatures") && !getWorkflowStatus("collections")
        ? "disabled"
        : hasEnv("RESEND_API_KEY") ||
            (hasEnv("SES_REGION") && hasEnv("SES_FROM_EMAIL"))
          ? "ready"
          : "degraded",
      getWorkflowStatus("signatures") || getWorkflowStatus("collections"),
      {
        resend: hasEnv("RESEND_API_KEY"),
        ses: hasEnv("SES_REGION") && hasEnv("SES_FROM_EMAIL"),
      },
    ),
    observability: buildCheck(
      getObservabilityConfig().sentry.configured ||
        getObservabilityConfig().cloudWatch.configured
        ? "ready"
        : "degraded",
      false,
      getObservabilityConfig(),
    ),
  };

  return checks;
}

export async function buildIntegrationHealthSnapshot() {
  const providers = ["stripe", "quickbooks", "record360", "skybitz"] as const;

  const [outboxRows, syncRows, webhookRows] = await Promise.all([
    db
      .select({
        provider: schema.outboxJobs.provider,
        status: schema.outboxJobs.status,
        availableAt: schema.outboxJobs.availableAt,
      })
      .from(schema.outboxJobs)
      .where(sql`${schema.outboxJobs.provider} is not null`),
    db
      .select({
        provider: schema.integrationSyncJobs.provider,
        status: schema.integrationSyncJobs.status,
        startedAt: schema.integrationSyncJobs.startedAt,
        finishedAt: schema.integrationSyncJobs.finishedAt,
      })
      .from(schema.integrationSyncJobs)
      .orderBy(desc(schema.integrationSyncJobs.startedAt)),
    db
      .select({
        provider: schema.webhookReceipts.provider,
        status: schema.webhookReceipts.status,
      })
      .from(schema.webhookReceipts),
  ]);

  return Object.fromEntries(
    providers.map((provider) => {
      const providerOutbox = outboxRows.filter((row) => row.provider === provider);
      const providerSyncRows = syncRows.filter((row) => row.provider === provider);
      const providerWebhooks = webhookRows.filter((row) => row.provider === provider);
      const pendingJobs = providerOutbox.filter((row) =>
        ["pending", "failed", "processing"].includes(row.status),
      );
      const deadLetterCount = providerOutbox.filter(
        (row) => row.status === "dead_letter",
      ).length;
      const lastSuccessfulSync = providerSyncRows.find((row) => row.status === "success");
      const failureCount =
        providerSyncRows.filter((row) => row.status === "failed").length +
        providerWebhooks.filter((row) => row.status === "failed").length +
        deadLetterCount;
      const oldestPendingAgeMinutes =
        pendingJobs.length === 0
          ? null
          : Math.max(
              0,
              ...pendingJobs.map((row) =>
                Math.floor((Date.now() - row.availableAt.getTime()) / 60_000),
              ),
            );

      return [
        provider,
        {
          queueDepth: pendingJobs.length,
          oldestPendingAgeMinutes,
          deadLetterCount,
          failureCount,
          lastSuccessfulSyncAt:
            lastSuccessfulSync?.finishedAt?.toISOString() ??
            lastSuccessfulSync?.startedAt.toISOString() ??
            null,
          webhookFailureCount: providerWebhooks.filter((row) => row.status === "failed")
            .length,
        },
      ];
    }),
  );
}

export async function buildRecord360ReceiptReviewQueue() {
  const receipts = await db
    .select()
    .from(schema.webhookReceipts)
    .where(
      and(
        eq(schema.webhookReceipts.provider, "record360"),
        sql`${schema.webhookReceipts.status} in ('received', 'failed')`,
      ),
    )
    .orderBy(desc(schema.webhookReceipts.receivedAt))
    .limit(50);

  return receipts.map((receipt) => ({
    id: receipt.id,
    providerEventId: receipt.externalEventId,
    status: receipt.status,
    verified: receipt.verified,
    processingError: receipt.processingError,
    receivedAt: receipt.receivedAt.toISOString(),
    lastAttemptAt: receipt.lastAttemptAt?.toISOString() ?? null,
  }));
}

import { desc, eq, isNull, or } from "drizzle-orm";

import { db, schema } from "@/lib/db";
import { toIso } from "@/lib/server/production-utils";

export type WorkspaceNotification = {
  id: string;
  title: string;
  body: string;
  tone: "critical" | "warning" | "info" | "success";
  href: string;
  source: string;
  createdAt: string | null;
};

function notificationTime(value: Date | string | null | undefined) {
  return value instanceof Date ? toIso(value) : value ?? null;
}

export async function listWorkspaceNotifications(dismissedIds: string[] = []) {
  const dismissed = new Set(dismissedIds);
  const [failedNotifications, importErrors, failedSyncJobs, failedImportRuns] =
    await Promise.all([
      db
        .select({
          id: schema.notifications.id,
          subject: schema.notifications.subject,
          body: schema.notifications.body,
          status: schema.notifications.status,
          errorMessage: schema.notifications.errorMessage,
          createdAt: schema.notifications.createdAt,
        })
        .from(schema.notifications)
        .where(or(eq(schema.notifications.status, "failed"), eq(schema.notifications.status, "queued")))
        .orderBy(desc(schema.notifications.createdAt))
        .limit(8),
      db
        .select({
          id: schema.bcImportErrors.id,
          entityType: schema.bcImportErrors.entityType,
          externalId: schema.bcImportErrors.externalId,
          errorCode: schema.bcImportErrors.errorCode,
          message: schema.bcImportErrors.message,
          createdAt: schema.bcImportErrors.createdAt,
        })
        .from(schema.bcImportErrors)
        .where(isNull(schema.bcImportErrors.resolvedAt))
        .orderBy(desc(schema.bcImportErrors.createdAt))
        .limit(8),
      db
        .select({
          id: schema.integrationSyncJobs.id,
          provider: schema.integrationSyncJobs.provider,
          entityType: schema.integrationSyncJobs.entityType,
          entityId: schema.integrationSyncJobs.entityId,
          lastError: schema.integrationSyncJobs.lastError,
          startedAt: schema.integrationSyncJobs.startedAt,
        })
        .from(schema.integrationSyncJobs)
        .where(eq(schema.integrationSyncJobs.status, "failed"))
        .orderBy(desc(schema.integrationSyncJobs.startedAt))
        .limit(8),
      db
        .select({
          id: schema.bcImportRuns.id,
          entityType: schema.bcImportRuns.entityType,
          status: schema.bcImportRuns.status,
          errorSummary: schema.bcImportRuns.errorSummary,
          startedAt: schema.bcImportRuns.startedAt,
        })
        .from(schema.bcImportRuns)
        .where(eq(schema.bcImportRuns.status, "failed"))
        .orderBy(desc(schema.bcImportRuns.startedAt))
        .limit(5),
    ]);

  const items: WorkspaceNotification[] = [
    ...importErrors.map((error) => ({
      id: `bc-error:${error.id}`,
      title: `BC ${error.entityType} import issue`,
      body: `${error.errorCode ?? "Import error"}${
        error.externalId ? ` on ${error.externalId}` : ""
      }: ${error.message}`,
      tone: "critical" as const,
      href: "/integrations/business-central/import-errors",
      source: "Business Central",
      createdAt: notificationTime(error.createdAt),
    })),
    ...failedImportRuns.map((run) => ({
      id: `bc-run:${run.id}`,
      title: `BC ${run.entityType} run failed`,
      body: run.errorSummary ?? `Import run ${run.id} did not complete.`,
      tone: "critical" as const,
      href: "/integrations/business-central/import-runs",
      source: "Business Central",
      createdAt: notificationTime(run.startedAt),
    })),
    ...failedSyncJobs.map((job) => ({
      id: `sync-job:${job.id}`,
      title: `${job.provider} sync failed`,
      body: `${job.entityType} ${job.entityId}: ${job.lastError ?? "No error detail."}`,
      tone: "warning" as const,
      href: "/integrations",
      source: "Integrations",
      createdAt: notificationTime(job.startedAt),
    })),
    ...failedNotifications.map((notification) => ({
      id: `notification:${notification.id}`,
      title:
        notification.status === "failed"
          ? "Message delivery failed"
          : "Message delivery queued",
      body:
        notification.errorMessage ??
        notification.subject ??
        notification.body.slice(0, 160),
      tone: notification.status === "failed" ? ("warning" as const) : ("info" as const),
      href: "/integrations",
      source: "Notifications",
      createdAt: notificationTime(notification.createdAt),
    })),
  ]
    .filter((item) => !dismissed.has(item.id))
    .sort((left, right) => {
      const leftTime = left.createdAt ? Date.parse(left.createdAt) : 0;
      const rightTime = right.createdAt ? Date.parse(right.createdAt) : 0;
      return rightTime - leftTime;
    })
    .slice(0, 20);

  return {
    items,
    summary: {
      total: items.length,
      critical: items.filter((item) => item.tone === "critical").length,
      warning: items.filter((item) => item.tone === "warning").length,
    },
  };
}

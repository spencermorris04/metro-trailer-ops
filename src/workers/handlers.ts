import { getWebhookReceipt, incrementWebhookReceiptAttempt, markWebhookReceiptFailed, markWebhookReceiptIgnored, markWebhookReceiptProcessed, type OutboxJobRecord, enqueueOutboxJob } from "@/lib/server/outbox";
import { deliverQueuedEmail } from "@/lib/server/notification-service";
import {
  processRecord360WebhookReceipt,
  syncAssetUnitToRecord360,
  syncInspectionRequestToRecord360,
} from "@/lib/server/platform-operations.production";
import { replayDeferredAuditEnvelope } from "@/lib/server/audit";
import { appendIntegrationSyncJob, markLatestIntegrationSyncJob } from "@/workers/integration-sync";

function requireString(value: unknown, message: string) {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(message);
  }

  return value;
}

function getPayloadRecord(payload: unknown) {
  return payload && typeof payload === "object"
    ? (payload as Record<string, unknown>)
    : {};
}

async function handleAuditWrite(job: OutboxJobRecord) {
  const payload = getPayloadRecord(job.payload);
  const envelopeRecord = getPayloadRecord(payload.envelope);

  await replayDeferredAuditEnvelope({
    id: requireString(envelopeRecord.id, "Deferred audit envelope is missing an id."),
    entityType: requireString(
      envelopeRecord.entityType,
      "Deferred audit envelope is missing an entityType.",
    ) as "asset" | "customer" | "customer_location" | "contract" | "contract_line" | "financial_event" | "invoice" | "user" | "dispatch_task" | "inspection" | "work_order" | "payment_method" | "collection_case",
    entityId: requireString(
      envelopeRecord.entityId,
      "Deferred audit envelope is missing an entityId.",
    ),
    eventType: requireString(
      envelopeRecord.eventType,
      "Deferred audit envelope is missing an eventType.",
    ),
    userId:
      typeof envelopeRecord.userId === "string" ? envelopeRecord.userId : null,
    metadata: getPayloadRecord(envelopeRecord.metadata),
    createdAt: new Date(
      requireString(
        envelopeRecord.createdAt,
        "Deferred audit envelope is missing a createdAt timestamp.",
      ),
    ),
  });

  return {
    type: "audit.write",
  };
}

async function handleWebhookProcessing(
  job: OutboxJobRecord,
  provider: "stripe" | "quickbooks" | "record360",
) {
  const payload = getPayloadRecord(job.payload);
  const receiptId = requireString(
    payload.receiptId,
    `Webhook job ${job.id} is missing a receiptId.`,
  );
  await incrementWebhookReceiptAttempt(receiptId);

  const receipt = await getWebhookReceipt(receiptId);
  if (!receipt) {
    throw new Error(`Webhook receipt ${receiptId} not found.`);
  }

  if (receipt.status === "processed") {
    return {
      type: `webhook.process.${provider}`,
      receiptId,
      skipped: true,
    };
  }

  if (receipt.status === "ignored") {
    return {
      type: `webhook.process.${provider}`,
      receiptId,
      ignored: true,
    };
  }

  if (!receipt.verified) {
    await markWebhookReceiptIgnored(
      receiptId,
      receipt.verificationError ?? "Webhook retained without provider signature verification.",
    );
    await markLatestIntegrationSyncJob({
      provider,
      entityType: "webhook_receipt",
      entityId: receiptId,
      status: "skipped",
      lastError:
        receipt.verificationError ??
        "Webhook accepted unverified because provider signature validation was unavailable.",
    });

    return {
      type: `webhook.process.${provider}`,
      receiptId,
      ignored: true,
    };
  }

  if (provider === "record360") {
    await enqueueOutboxJob({
      jobType: "inspection.ingest.record360",
      aggregateType: "webhook_receipt",
      aggregateId: receiptId,
      provider: "record360",
      payload: {
        receiptId,
        externalEventId: receipt.externalEventId,
      },
    });
  }

  await markWebhookReceiptProcessed(receiptId);
  await markLatestIntegrationSyncJob({
    provider,
    entityType: "webhook_receipt",
    entityId: receiptId,
    status: "success",
    payloadPatch: {
      processedAt: new Date().toISOString(),
      externalEventId: receipt.externalEventId,
    },
  });

  return {
    type: `webhook.process.${provider}`,
    receiptId,
  };
}

async function handleNotificationSend(job: OutboxJobRecord) {
  const payload = getPayloadRecord(job.payload);
  const notificationId = requireString(
    payload.notificationId,
    `Notification job ${job.id} is missing a notificationId.`,
  );
  const result = await deliverQueuedEmail(notificationId);

  await markLatestIntegrationSyncJob({
    provider: "internal",
    entityType: "notification",
    entityId: notificationId,
    status: result.status === "sent" ? "success" : "skipped",
    lastError:
      result.status === "sent" ? null : "Notification skipped due to missing SES configuration.",
    payloadPatch: {
      providerMessageId: result.providerMessageId,
    },
  });

  return result;
}

async function handleCollectionsEvaluate(job: OutboxJobRecord) {
  const payload = getPayloadRecord(job.payload);

  return {
    type: "collections.evaluate",
    aggregateId: job.aggregateId,
    evaluatedAt: new Date().toISOString(),
    payload,
  };
}

async function handleReportRollup(job: OutboxJobRecord) {
  const payload = getPayloadRecord(job.payload);

  return {
    type: "report.rollup.daily",
    aggregateId: job.aggregateId,
    rolledUpAt: new Date().toISOString(),
    payload,
  };
}

async function handleProviderSync(job: OutboxJobRecord) {
  const payload = getPayloadRecord(job.payload);

  if (job.provider) {
    await markLatestIntegrationSyncJob({
      provider: job.provider,
      entityType: job.aggregateType,
      entityId: job.aggregateId,
      status: "success",
      payloadPatch: {
        processedByJobId: job.id,
        processedAt: new Date().toISOString(),
        payload,
      },
    });
  } else {
    await appendIntegrationSyncJob({
      provider: "internal",
      entityType: job.aggregateType,
      entityId: job.aggregateId,
      direction: "push",
      payload: {
        jobType: job.jobType,
        payload,
      },
    });
  }

  return {
    type: job.jobType,
    aggregateId: job.aggregateId,
  };
}

async function handleRecord360InspectionRequest(job: OutboxJobRecord) {
  const result = await syncInspectionRequestToRecord360(job.aggregateId);

  await markLatestIntegrationSyncJob({
    provider: "record360",
    entityType: job.aggregateType,
    entityId: job.aggregateId,
    status: "success",
    payloadPatch: {
      requestId: result.data.requestId,
      unitId: result.data.externalUnitId,
      mode: result.mode,
    },
  });

  return {
    type: job.jobType,
    aggregateId: job.aggregateId,
    requestId: result.data.requestId,
  };
}

async function handleRecord360InspectionIngest(job: OutboxJobRecord) {
  const payload = getPayloadRecord(job.payload);
  const receiptId = requireString(
    payload.receiptId,
    `Record360 ingest job ${job.id} is missing a receiptId.`,
  );
  const result = await processRecord360WebhookReceipt(receiptId);

  await markLatestIntegrationSyncJob({
    provider: "record360",
    entityType: job.aggregateType,
    entityId: job.aggregateId,
    status: "success",
    payloadPatch: {
      processedReceiptId: receiptId,
    },
  });

  return {
    type: job.jobType,
    aggregateId: job.aggregateId,
    receiptId,
    result,
  };
}

async function handleRecord360AssetSync(job: OutboxJobRecord) {
  const result = await syncAssetUnitToRecord360(job.aggregateId);

  await markLatestIntegrationSyncJob({
    provider: "record360",
    entityType: job.aggregateType,
    entityId: job.aggregateId,
    status: "success",
    payloadPatch: {
      unitId: result.data.unitId,
      requestId: result.data.requestId,
      mode: result.mode,
    },
  });

  return {
    type: job.jobType,
    aggregateId: job.aggregateId,
    unitId: result.data.unitId,
  };
}

export async function processOutboxJob(job: OutboxJobRecord) {
  try {
    switch (job.jobType) {
      case "audit.write":
        return await handleAuditWrite(job);
      case "webhook.process.stripe":
        return await handleWebhookProcessing(job, "stripe");
      case "webhook.process.quickbooks":
        return await handleWebhookProcessing(job, "quickbooks");
      case "webhook.process.record360":
        return await handleWebhookProcessing(job, "record360");
      case "notification.send.email":
        return await handleNotificationSend(job);
      case "collections.evaluate":
        return await handleCollectionsEvaluate(job);
      case "report.rollup.daily":
        return await handleReportRollup(job);
      case "invoice.sync.quickbooks":
      case "payment.sync.quickbooks":
      case "telematics.pull.skybitz":
        return await handleProviderSync(job);
      case "asset.sync.record360":
        return await handleRecord360AssetSync(job);
      case "inspection.request.record360":
        return await handleRecord360InspectionRequest(job);
      case "inspection.ingest.record360":
        return await handleRecord360InspectionIngest(job);
      default:
        return await handleProviderSync(job);
    }
  } catch (error) {
    const payload = getPayloadRecord(job.payload);
    const receiptId =
      typeof payload.receiptId === "string" ? payload.receiptId : null;

    if (
      receiptId &&
      (job.jobType === "webhook.process.stripe" ||
        job.jobType === "webhook.process.quickbooks" ||
        job.jobType === "webhook.process.record360")
    ) {
      await markWebhookReceiptFailed(
        receiptId,
        error instanceof Error ? error.message : String(error),
      );
    }

    if (job.provider) {
      await markLatestIntegrationSyncJob({
        provider: job.provider,
        entityType: job.aggregateType,
        entityId: job.aggregateId,
        status: "failed",
        lastError: error instanceof Error ? error.message : String(error),
      });
    }

    throw error;
  }
}

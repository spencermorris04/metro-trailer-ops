import { errorResponse, ok } from "@/lib/server/api";
import { enqueueOutboxJob, recordWebhookReceipt } from "@/lib/server/outbox";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const notifications = Array.isArray(payload.eventNotifications)
      ? payload.eventNotifications
      : [];
    const firstNotification =
      notifications.length > 0 &&
      notifications[0] &&
      typeof notifications[0] === "object"
        ? (notifications[0] as Record<string, unknown>)
        : null;
    const externalEventId =
      typeof payload.eventId === "string"
        ? payload.eventId
        : typeof firstNotification?.realmId === "string"
          ? String(firstNotification.realmId)
          : null;

    const receiptId = await recordWebhookReceipt({
      provider: "quickbooks",
      signature: request.headers.get("intuit-signature"),
      externalEventId,
      headers: Object.fromEntries(request.headers.entries()),
      payload,
    });

    if (receiptId) {
      await enqueueOutboxJob({
        jobType: "webhook.process.quickbooks",
        aggregateType: "webhook_receipt",
        aggregateId: receiptId,
        provider: "quickbooks",
        payload: {
          receiptId,
          externalEventId,
        },
      });
    }

    return ok({
      received: true,
      receiptId,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

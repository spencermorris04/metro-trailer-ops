import { errorResponse, ok } from "@/lib/server/api";
import { enqueueOutboxJob, recordWebhookReceipt } from "@/lib/server/outbox";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const externalEventId =
      typeof payload.id === "string"
        ? payload.id
        : typeof payload.inspectionId === "string"
          ? payload.inspectionId
          : null;

    const receiptId = await recordWebhookReceipt({
      provider: "record360",
      signature: request.headers.get("x-record360-signature"),
      externalEventId,
      headers: Object.fromEntries(request.headers.entries()),
      payload,
    });

    if (receiptId) {
      await enqueueOutboxJob({
        jobType: "inspection.ingest.record360",
        aggregateType: "webhook_receipt",
        aggregateId: receiptId,
        provider: "record360",
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

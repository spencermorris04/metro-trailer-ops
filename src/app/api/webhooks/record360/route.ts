import { errorResponse, ok } from "@/lib/server/api";
import { enqueueOutboxJob, recordWebhookReceipt } from "@/lib/server/outbox";
import { validateRecord360Webhook } from "@/lib/server/webhooks";

export async function POST(request: Request) {
  try {
    const validated = await validateRecord360Webhook(request);

    const receiptId = await recordWebhookReceipt({
      provider: "record360",
      signature: validated.signature,
      externalEventId: validated.externalEventId,
      headers: Object.fromEntries(request.headers.entries()),
      payload: validated.payload,
      verified: validated.verified,
      verificationError: validated.verificationError,
    });

    if (receiptId) {
      await enqueueOutboxJob({
        jobType: "webhook.process.record360",
        aggregateType: "webhook_receipt",
        aggregateId: receiptId,
        provider: "record360",
        payload: {
          receiptId,
          externalEventId: validated.externalEventId,
          verified: validated.verified,
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

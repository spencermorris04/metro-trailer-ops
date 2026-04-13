import { errorResponse, ok } from "@/lib/server/api";
import { enqueueOutboxJob, recordWebhookReceipt } from "@/lib/server/outbox";
import { validateQuickBooksWebhook } from "@/lib/server/webhooks";

export async function POST(request: Request) {
  try {
    const validated = await validateQuickBooksWebhook(request);

    const receiptId = await recordWebhookReceipt({
      provider: "quickbooks",
      signature: validated.signature,
      externalEventId: validated.externalEventId,
      headers: Object.fromEntries(request.headers.entries()),
      payload: validated.payload,
      verified: validated.verified,
      verificationError: validated.verificationError,
    });

    if (receiptId) {
      await enqueueOutboxJob({
        jobType: "webhook.process.quickbooks",
        aggregateType: "webhook_receipt",
        aggregateId: receiptId,
        provider: "quickbooks",
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

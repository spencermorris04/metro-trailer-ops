import Stripe from "stripe";

import { errorResponse, ok } from "@/lib/server/api";
import { enqueueOutboxJob, recordWebhookReceipt } from "@/lib/server/outbox";

function getStripeClient() {
  const apiKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!apiKey) {
    return null;
  }

  return new Stripe(apiKey, {
    apiVersion: "2026-03-25.dahlia",
  });
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("stripe-signature");
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
    const stripe = getStripeClient();

    let payload: Record<string, unknown>;
    let externalEventId: string | null = null;

    if (stripe && webhookSecret && signature) {
      const event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
      payload = event as unknown as Record<string, unknown>;
      externalEventId = event.id;
    } else {
      payload = JSON.parse(rawBody) as Record<string, unknown>;
      externalEventId =
        typeof payload.id === "string" ? payload.id : null;
    }

    const receiptId = await recordWebhookReceipt({
      provider: "stripe",
      signature,
      externalEventId,
      headers: Object.fromEntries(request.headers.entries()),
      payload,
    });

    if (receiptId) {
      await enqueueOutboxJob({
        jobType: "webhook.process.stripe",
        aggregateType: "webhook_receipt",
        aggregateId: receiptId,
        provider: "stripe",
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

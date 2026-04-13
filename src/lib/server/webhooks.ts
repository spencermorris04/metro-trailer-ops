import { createHmac, timingSafeEqual } from "node:crypto";

import Stripe from "stripe";

import { ApiError } from "@/lib/server/api";
import { isProductionRuntime } from "@/lib/server/runtime";

function safeCompareStrings(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

function computeHmac(body: string, secret: string, encoding: "hex" | "base64") {
  return createHmac("sha256", secret).update(body).digest(encoding);
}

export async function validateStripeWebhook(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  const apiKey = process.env.STRIPE_SECRET_KEY?.trim();

  if (apiKey && webhookSecret && signature) {
    const stripe = new Stripe(apiKey, {
      apiVersion: "2026-03-25.dahlia",
    });
    const event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);

    return {
      rawBody,
      signature,
      externalEventId: event.id,
      payload: event as unknown as Record<string, unknown>,
      verified: true,
      verificationError: null,
    };
  }

  if (isProductionRuntime()) {
    throw new ApiError(
      401,
      "Stripe webhook verification requires STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, and stripe-signature.",
    );
  }

  return {
    rawBody,
    signature,
    externalEventId: null,
    payload: JSON.parse(rawBody) as Record<string, unknown>,
    verified: false,
    verificationError: webhookSecret
      ? "Stripe webhook secret or signature missing; payload accepted unverified."
      : "Stripe webhook secret not configured; payload accepted unverified.",
  };
}

export async function validateQuickBooksWebhook(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("intuit-signature");
  const verifierToken =
    process.env.QUICKBOOKS_WEBHOOK_VERIFIER_TOKEN?.trim() ??
    process.env.QUICKBOOKS_WEBHOOK_VERIFIER?.trim();

  let verified = false;
  let verificationError: string | null = null;

  if (verifierToken) {
    if (!signature) {
      throw new ApiError(401, "QuickBooks webhook signature is required.");
    }

    const expected = computeHmac(rawBody, verifierToken, "base64");
    verified = safeCompareStrings(expected, signature);

    if (!verified) {
      throw new ApiError(401, "QuickBooks webhook signature is invalid.");
    }
  } else {
    verificationError =
      "QuickBooks webhook verifier is not configured; payload accepted unverified.";
  }

  const payload = JSON.parse(rawBody) as Record<string, unknown>;
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

  return {
    rawBody,
    signature,
    externalEventId,
    payload,
    verified,
    verificationError,
  };
}

export async function validateRecord360Webhook(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-record360-signature");
  const secret = process.env.RECORD360_WEBHOOK_SECRET?.trim();

  let verified = false;
  let verificationError: string | null = null;

  if (secret) {
    if (!signature) {
      throw new ApiError(401, "Record360 webhook signature is required.");
    }

    const normalizedSignature = signature.replace(/^sha256=/i, "");
    const validSignatures = [
      computeHmac(rawBody, secret, "hex"),
      computeHmac(rawBody, secret, "base64"),
    ];
    verified = validSignatures.some((candidate) =>
      safeCompareStrings(candidate, normalizedSignature),
    );

    if (!verified) {
      throw new ApiError(401, "Record360 webhook signature is invalid.");
    }
  } else {
    verificationError =
      "Record360 webhook secret is not configured; payload accepted unverified.";
  }

  const payload = JSON.parse(rawBody) as Record<string, unknown>;
  const externalEventId =
    typeof payload.id === "string"
      ? payload.id
      : typeof payload.inspectionId === "string"
        ? payload.inspectionId
        : null;

  return {
    rawBody,
    signature,
    externalEventId,
    payload,
    verified,
    verificationError,
  };
}

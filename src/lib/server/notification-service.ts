import { SendEmailCommand, SESClient } from "@aws-sdk/client-ses";
import { eq } from "drizzle-orm";
import { Resend } from "resend";

import { db, schema } from "@/lib/db";
import { enqueueOutboxJob } from "@/lib/server/outbox";
import { createId, now, nowIso } from "@/lib/server/production-utils";
import { isProductionRuntime } from "@/lib/server/runtime";

type EmailProvider = "auto" | "resend" | "ses";

type EmailOptions = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  provider?: EmailProvider;
  relatedEntityType?: string;
  relatedEntityId?: string;
};

declare global {
  var __metroTrailerSesClient: SESClient | undefined;
  var __metroTrailerResendClient: Resend | undefined;
}

function getSesRegion() {
  return process.env.SES_REGION?.trim() || process.env.AWS_REGION?.trim() || null;
}

function getSesFromEmail() {
  return process.env.SES_FROM_EMAIL?.trim() || null;
}

function getResendApiKey() {
  return process.env.RESEND_API_KEY?.trim() || null;
}

function getResendFromEmail() {
  return process.env.RESEND_FROM_EMAIL?.trim() || getSesFromEmail();
}

function getSesClient() {
  const region = getSesRegion();
  if (!region) {
    return null;
  }

  if (!globalThis.__metroTrailerSesClient) {
    globalThis.__metroTrailerSesClient = new SESClient({ region });
  }

  return globalThis.__metroTrailerSesClient;
}

function getResendClient() {
  const apiKey = getResendApiKey();
  if (!apiKey) {
    return null;
  }

  if (!globalThis.__metroTrailerResendClient) {
    globalThis.__metroTrailerResendClient = new Resend(apiKey);
  }

  return globalThis.__metroTrailerResendClient;
}

function isMissingEmailConfigError(error: unknown) {
  return error instanceof Error && error.message === "Email configuration is incomplete.";
}

async function deliverViaSes(options: EmailOptions) {
  const fromAddress = getSesFromEmail();
  const ses = getSesClient();

  if (!fromAddress || !ses) {
    throw new Error("Email configuration is incomplete.");
  }

  const response = await ses.send(
    new SendEmailCommand({
      Source: fromAddress,
      Destination: {
        ToAddresses: [options.to],
      },
      Message: {
        Subject: {
          Data: options.subject,
        },
        Body: {
          Text: {
            Data: options.text,
          },
          Html: options.html
            ? {
                Data: options.html,
              }
            : undefined,
        },
      },
    }),
  );

  return {
    providerMessageId: response.MessageId ?? null,
  };
}

async function deliverViaResend(options: EmailOptions) {
  const resend = getResendClient();
  const fromAddress = getResendFromEmail();

  if (!resend || !fromAddress) {
    throw new Error("Email configuration is incomplete.");
  }

  const response = await resend.emails.send({
    from: fromAddress,
    to: [options.to],
    subject: options.subject,
    text: options.text,
    html: options.html,
  });

  if (response.error) {
    throw new Error(response.error.message);
  }

  return {
    providerMessageId: response.data?.id ?? null,
  };
}

async function deliverEmail(options: EmailOptions) {
  const preferredProvider = options.provider ?? "auto";

  if (preferredProvider === "resend") {
    return deliverViaResend(options);
  }

  if (preferredProvider === "ses") {
    return deliverViaSes(options);
  }

  if (getResendClient() && getResendFromEmail()) {
    return deliverViaResend(options);
  }

  if (getSesClient() && getSesFromEmail()) {
    return deliverViaSes(options);
  }

  throw new Error("Email configuration is incomplete.");
}

export async function sendTransactionalEmail(options: EmailOptions) {
  const notificationId = createId("notif");
  const createdAt = now();

  if (isProductionRuntime()) {
    await db.insert(schema.notifications).values({
      id: notificationId,
      channel: "email",
      status: "queued",
      toAddress: options.to,
      subject: options.subject,
      body: options.text,
      relatedEntityType: options.relatedEntityType ?? null,
      relatedEntityId: options.relatedEntityId ?? null,
      payload: {
        html: options.html ?? null,
        provider: options.provider ?? "auto",
      },
      createdAt,
    });
    await enqueueOutboxJob({
      jobType: "notification.send.email",
      aggregateType: "notification",
      aggregateId: notificationId,
      provider: "internal",
      payload: {
        notificationId,
      },
      maxAttempts: 12,
    });

    return {
      id: notificationId,
      status: "queued",
      sentAt: null,
      providerMessageId: null,
    };
  }

  let providerMessageId: string | null = null;
  try {
    const response = await deliverEmail(options);
    providerMessageId = response.providerMessageId;
  } catch (error) {
    if (!isMissingEmailConfigError(error)) {
      throw error;
    }

    return {
      id: notificationId,
      status: "skipped",
      sentAt: null,
      providerMessageId: null,
    };
  }

  if (isProductionRuntime()) {
    await db
      .update(schema.notifications)
      .set({
        status: "sent",
        providerMessageId,
        sentAt: now(),
      })
      .where(eq(schema.notifications.id, notificationId));
  }

  return {
    id: notificationId,
    status: "sent",
    sentAt: nowIso(),
    providerMessageId,
  };
}

export async function deliverQueuedEmail(notificationId: string) {
  const notification = await db.query.notifications.findFirst({
    where: (table, { eq: localEq }) => localEq(table.id, notificationId),
  });

  if (!notification) {
    throw new Error(`Notification ${notificationId} not found.`);
  }

  try {
    const payload =
      notification.payload && typeof notification.payload === "object"
        ? (notification.payload as Record<string, unknown>)
        : {};
    const html = typeof payload.html === "string" ? payload.html : undefined;
    const provider =
      payload.provider === "resend" || payload.provider === "ses"
        ? payload.provider
        : "auto";
    const response = await deliverEmail({
      to: notification.toAddress,
      subject: notification.subject ?? "(no subject)",
      text: notification.body,
      html,
      provider,
    });

    await db
      .update(schema.notifications)
      .set({
        status: "sent",
        providerMessageId: response.providerMessageId,
        sentAt: now(),
        failedAt: null,
        errorMessage: null,
      })
      .where(eq(schema.notifications.id, notificationId));

    return {
      id: notificationId,
      status: "sent" as const,
      providerMessageId: response.providerMessageId,
    };
  } catch (error) {
    if (isMissingEmailConfigError(error)) {
      await db
        .update(schema.notifications)
        .set({
          status: "skipped",
          failedAt: now(),
          errorMessage: "Email configuration is incomplete.",
        })
        .where(eq(schema.notifications.id, notificationId));

      return {
        id: notificationId,
        status: "skipped" as const,
        providerMessageId: null,
      };
    }

    await db
      .update(schema.notifications)
      .set({
        status: "failed",
        failedAt: now(),
        errorMessage: error instanceof Error ? error.message : String(error),
      })
      .where(eq(schema.notifications.id, notificationId));

    throw error;
  }
}

import { SendEmailCommand, SESClient } from "@aws-sdk/client-ses";
import { eq } from "drizzle-orm";

import { db, schema } from "@/lib/db";
import { enqueueOutboxJob } from "@/lib/server/outbox";
import { createId, now, nowIso } from "@/lib/server/production-utils";
import { isProductionRuntime } from "@/lib/server/runtime";

type EmailOptions = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
};

declare global {
  var __metroTrailerSesClient: SESClient | undefined;
}

function getSesRegion() {
  return process.env.SES_REGION?.trim() || process.env.AWS_REGION?.trim() || null;
}

function getSesFromEmail() {
  return process.env.SES_FROM_EMAIL?.trim() || null;
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

  const fromAddress = getSesFromEmail();
  const ses = getSesClient();

  if (!fromAddress || !ses) {
    return {
      id: notificationId,
      status: "skipped",
      sentAt: null,
      providerMessageId: null,
    };
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

  if (isProductionRuntime()) {
    await db
      .update(schema.notifications)
      .set({
        status: "sent",
        providerMessageId: response.MessageId ?? null,
        sentAt: now(),
      })
      .where(eq(schema.notifications.id, notificationId));
  }

  return {
    id: notificationId,
    status: "sent",
    sentAt: nowIso(),
    providerMessageId: response.MessageId ?? null,
  };
}

export async function deliverQueuedEmail(notificationId: string) {
  const notification = await db.query.notifications.findFirst({
    where: (table, { eq: localEq }) => localEq(table.id, notificationId),
  });

  if (!notification) {
    throw new Error(`Notification ${notificationId} not found.`);
  }

  const fromAddress = getSesFromEmail();
  const ses = getSesClient();

  if (!fromAddress || !ses) {
    await db
      .update(schema.notifications)
      .set({
        status: "skipped",
        errorMessage: "SES configuration is incomplete.",
        failedAt: now(),
      })
      .where(eq(schema.notifications.id, notificationId));

    return {
      id: notificationId,
      status: "skipped" as const,
      providerMessageId: null,
    };
  }

  try {
    const payload =
      notification.payload && typeof notification.payload === "object"
        ? (notification.payload as Record<string, unknown>)
        : {};
    const html = typeof payload.html === "string" ? payload.html : undefined;

    const response = await ses.send(
      new SendEmailCommand({
        Source: fromAddress,
        Destination: {
          ToAddresses: [notification.toAddress],
        },
        Message: {
          Subject: {
            Data: notification.subject ?? "(no subject)",
          },
          Body: {
            Text: {
              Data: notification.body,
            },
            Html: html
              ? {
                  Data: html,
                }
              : undefined,
          },
        },
      }),
    );

    await db
      .update(schema.notifications)
      .set({
        status: "sent",
        providerMessageId: response.MessageId ?? null,
        sentAt: now(),
        failedAt: null,
        errorMessage: null,
      })
      .where(eq(schema.notifications.id, notificationId));

    return {
      id: notificationId,
      status: "sent" as const,
      providerMessageId: response.MessageId ?? null,
    };
  } catch (error) {
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

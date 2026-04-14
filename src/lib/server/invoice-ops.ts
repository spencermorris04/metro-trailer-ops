import { and, eq } from "drizzle-orm";

import { db, schema } from "@/lib/db";
import { createId, now } from "@/lib/server/production-utils";

type InvoiceRow = typeof schema.invoices.$inferSelect;

export function deriveInvoiceReconciliationState(options: {
  quickBooksSyncStatus: string | null | undefined;
  quickBooksLastError: string | null | undefined;
  openIssueCount: number;
}) {
  if (options.openIssueCount > 0) {
    return "exception";
  }

  if (options.quickBooksLastError) {
    return "failed";
  }

  if (options.quickBooksSyncStatus === "success") {
    return "reconciled";
  }

  return "pending";
}

export function isInvoicePayable(invoice: InvoiceRow) {
  return (
    !["draft", "voided", "paid"].includes(invoice.status) &&
    invoice.deliveryStatus !== "voided"
  );
}

export async function listOpenAccountingIssueReasonCodesForInvoice(invoiceId: string) {
  const rows = await db
    .select({
      reasonCode: schema.accountingSyncIssues.reasonCode,
    })
    .from(schema.accountingSyncIssues)
    .where(
      and(
        eq(schema.accountingSyncIssues.provider, "quickbooks"),
        eq(schema.accountingSyncIssues.entityType, "invoice"),
        eq(schema.accountingSyncIssues.internalEntityId, invoiceId),
        eq(schema.accountingSyncIssues.status, "open"),
      ),
    );

  return rows.map((row) => row.reasonCode);
}

export async function recordInvoiceHistoryEvent(options: {
  invoiceId: string;
  eventType: string;
  actorUserId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  await db.insert(schema.invoiceHistory).values({
    id: createId("invhist"),
    invoiceId: options.invoiceId,
    eventType: options.eventType,
    actorUserId: options.actorUserId ?? null,
    metadata: options.metadata ?? {},
    createdAt: now(),
  });
}

export async function listInvoiceHistory(invoiceId: string) {
  const rows = await db
    .select({
      id: schema.invoiceHistory.id,
      eventType: schema.invoiceHistory.eventType,
      actorUserId: schema.invoiceHistory.actorUserId,
      metadata: schema.invoiceHistory.metadata,
      createdAt: schema.invoiceHistory.createdAt,
    })
    .from(schema.invoiceHistory)
    .where(eq(schema.invoiceHistory.invoiceId, invoiceId))
    .orderBy(schema.invoiceHistory.createdAt);

  return rows.map((row) => ({
    id: row.id,
    eventType: row.eventType,
    actorUserId: row.actorUserId,
    metadata: row.metadata ?? {},
    createdAt: row.createdAt.toISOString(),
  }));
}

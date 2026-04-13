import { enqueueOutboxJob } from "@/lib/server/outbox";

const REMINDER_THRESHOLDS_DAYS = [3, 7, 14, 21] as const;

export type CollectionsCadenceInput = {
  dueDate: Date | null;
  balanceAmount: number;
  reminderCount: number;
  promisedPaymentDate?: Date | null;
  lastContactAt?: Date | null;
};

export type CollectionsCadenceResult = {
  overdueDays: number;
  shouldRemind: boolean;
  shouldEscalate: boolean;
  suggestedStatus:
    | "current"
    | "reminder_sent"
    | "promise_to_pay"
    | "escalated"
    | "resolved";
  nextAction: string;
};

function daysBetween(a: Date, b: Date) {
  return Math.max(0, Math.floor((a.getTime() - b.getTime()) / 86_400_000));
}

export function evaluateCollectionsCadence(
  input: CollectionsCadenceInput,
): CollectionsCadenceResult {
  if (input.balanceAmount <= 0) {
    return {
      overdueDays: 0,
      shouldRemind: false,
      shouldEscalate: false,
      suggestedStatus: "resolved",
      nextAction: "Case can be resolved because the invoice balance is zero.",
    };
  }

  const today = new Date();
  const overdueDays = input.dueDate ? daysBetween(today, input.dueDate) : 0;

  if (
    input.promisedPaymentDate &&
    input.promisedPaymentDate.getTime() >= today.getTime()
  ) {
    return {
      overdueDays,
      shouldRemind: false,
      shouldEscalate: false,
      suggestedStatus: "promise_to_pay",
      nextAction: `Await promised payment due ${input.promisedPaymentDate.toISOString()}.`,
    };
  }

  const nextThreshold = REMINDER_THRESHOLDS_DAYS[input.reminderCount] ?? null;
  const shouldRemind = overdueDays > 0 && nextThreshold !== null && overdueDays >= nextThreshold;
  const shouldEscalate = overdueDays >= 30 || input.reminderCount >= REMINDER_THRESHOLDS_DAYS.length;

  if (shouldEscalate) {
    return {
      overdueDays,
      shouldRemind,
      shouldEscalate: true,
      suggestedStatus: "escalated",
      nextAction: "Escalate to collections recovery workflow and review latest telematics.",
    };
  }

  if (shouldRemind) {
    return {
      overdueDays,
      shouldRemind: true,
      shouldEscalate: false,
      suggestedStatus: "reminder_sent",
      nextAction: "Send the next collections reminder and schedule follow-up.",
    };
  }

  return {
    overdueDays,
    shouldRemind: false,
    shouldEscalate: false,
    suggestedStatus: overdueDays > 0 ? "current" : "current",
    nextAction:
      overdueDays > 0
        ? "Monitor balance and wait for the next reminder threshold."
        : "Invoice is not yet due; no collections action is required.",
  };
}

export async function enqueueCollectionsEvaluationJob(options: {
  collectionCaseId: string;
  customerId: string;
  invoiceId?: string | null;
  availableAt?: Date;
  correlationId?: string | null;
  reason: string;
}) {
  return enqueueOutboxJob({
    jobType: "collections.evaluate",
    aggregateType: "collection_case",
    aggregateId: options.collectionCaseId,
    provider: "internal",
    availableAt: options.availableAt,
    correlationId: options.correlationId ?? null,
    payload: {
      collectionCaseId: options.collectionCaseId,
      customerId: options.customerId,
      invoiceId: options.invoiceId ?? null,
      reason: options.reason,
    },
  });
}

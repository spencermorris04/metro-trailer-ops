import { desc, eq } from "drizzle-orm";
import type Stripe from "stripe";

import { db, schema } from "@/lib/db";
import type { InvoiceRecord } from "@/lib/domain/models";
import type {
  PaymentMethodRecord,
  PaymentTransactionRecord,
} from "@/lib/platform-types";
import { ApiError } from "@/lib/server/api";
import {
  attachStripePaymentMethod,
  createStripePaymentIntent,
  createStripePortalSession,
  createStripeRefund,
  createStripeSetupIntent,
  ensureStripeCustomer,
} from "@/lib/server/integration-clients";
import { enqueueOutboxJob } from "@/lib/server/outbox";
import {
  createId,
  now,
  numericToNumber,
  toIso,
} from "@/lib/server/production-utils";

type CustomerRow = typeof schema.customers.$inferSelect;
type InvoiceRow = typeof schema.invoices.$inferSelect;
type StripePaymentMethodLike =
  | Stripe.PaymentMethod
  | {
      id: string;
      type: string;
      card?: {
        brand: string;
        last4: string;
      };
      us_bank_account?: {
        last4: string;
        bank_name?: string | null;
      };
    };

export type AddPaymentMethodInput = {
  customerNumber: string;
  stripePaymentMethodId?: string;
  methodType?: "card" | "ach" | "wire" | "check";
  label?: string;
  last4?: string;
  isDefault?: boolean;
};

export type CreatePaymentIntentInput = {
  invoiceId: string;
  paymentMethodId?: string;
};

export type ListPaymentTransactionFilters = {
  customerNumber?: string;
  invoiceId?: string;
};

function requireRecord<T>(value: T | undefined, message: string) {
  if (!value) {
    throw new ApiError(404, message);
  }

  return value;
}

async function pushAudit(event: {
  entityType: typeof schema.auditEvents.$inferInsert.entityType;
  entityId: string;
  eventType: string;
  userId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  await db.insert(schema.auditEvents).values({
    id: createId("audit"),
    entityType: event.entityType,
    entityId: event.entityId,
    eventType: event.eventType,
    userId: event.userId ?? null,
    metadata: event.metadata ?? {},
    createdAt: now(),
  });
}

async function getCustomerByIdOrNumber(customerId: string) {
  const customer = await db.query.customers.findFirst({
    where: (table, { eq: localEq, or: localOr }) =>
      localOr(
        localEq(table.id, customerId),
        localEq(table.customerNumber, customerId),
        localEq(table.name, customerId),
      ),
  });

  return requireRecord(customer, `Customer ${customerId} not found.`);
}

async function getInvoiceByIdOrNumber(invoiceId: string) {
  const invoice = await db.query.invoices.findFirst({
    where: (table, { eq: localEq, or: localOr }) =>
      localOr(localEq(table.id, invoiceId), localEq(table.invoiceNumber, invoiceId)),
  });

  return requireRecord(invoice, `Invoice ${invoiceId} not found.`);
}

async function getPaymentMethodById(paymentMethodId: string) {
  const paymentMethod = await db.query.paymentMethods.findFirst({
    where: (table, { eq: localEq, or: localOr }) =>
      localOr(
        localEq(table.id, paymentMethodId),
        localEq(table.stripePaymentMethodId, paymentMethodId),
      ),
  });

  return requireRecord(paymentMethod, `Payment method ${paymentMethodId} not found.`);
}

async function getStripeCustomerMapping(customerId: string) {
  return db.query.externalEntityMappings.findFirst({
    where: (table, { and: localAnd, eq: localEq }) =>
      localAnd(
        localEq(table.provider, "stripe"),
        localEq(table.entityType, "customer"),
        localEq(table.internalId, customerId),
      ),
  });
}

async function getCustomerByStripeCustomerId(stripeCustomerId: string) {
  const mapping = await db.query.externalEntityMappings.findFirst({
    where: (table, { and: localAnd, eq: localEq }) =>
      localAnd(
        localEq(table.provider, "stripe"),
        localEq(table.entityType, "customer"),
        localEq(table.externalId, stripeCustomerId),
      ),
  });

  if (!mapping) {
    return null;
  }

  return db.query.customers.findFirst({
    where: (table, { eq: localEq }) => localEq(table.id, mapping.internalId),
  });
}

async function upsertStripeCustomerMapping(
  customerId: string,
  stripeCustomerId: string,
  payload: Record<string, unknown> = {},
) {
  const existing = await getStripeCustomerMapping(customerId);

  if (existing) {
    await db
      .update(schema.externalEntityMappings)
      .set({
        externalId: stripeCustomerId,
        payload,
        updatedAt: now(),
      })
      .where(eq(schema.externalEntityMappings.id, existing.id));
    return stripeCustomerId;
  }

  await db.insert(schema.externalEntityMappings).values({
    id: createId("map"),
    provider: "stripe",
    entityType: "customer",
    internalId: customerId,
    externalId: stripeCustomerId,
    payload,
    createdAt: now(),
    updatedAt: now(),
  });

  return stripeCustomerId;
}

async function ensureStripeCustomerId(customer: CustomerRow) {
  const existing = await getStripeCustomerMapping(customer.id);
  const ensured = await ensureStripeCustomer({
    stripeCustomerId: existing?.externalId ?? null,
    customerNumber: customer.customerNumber,
    customerName: customer.name,
    email:
      typeof customer.contactInfo?.email === "string"
        ? customer.contactInfo.email
        : null,
  });

  await upsertStripeCustomerMapping(customer.id, ensured.data.customerId, {
    customerNumber: customer.customerNumber,
    customerName: customer.name,
    mode: ensured.mode,
  });

  return ensured.data.customerId;
}

function getPaymentMethodType(paymentMethod: StripePaymentMethodLike) {
  if (paymentMethod.type === "us_bank_account") {
    return "ach" as const;
  }

  return "card" as const;
}

function getPaymentMethodLast4(paymentMethod: StripePaymentMethodLike) {
  if (paymentMethod.type === "us_bank_account") {
    return paymentMethod.us_bank_account?.last4 ?? "0000";
  }

  return paymentMethod.card?.last4 ?? "0000";
}

function getPaymentMethodLabel(paymentMethod: StripePaymentMethodLike) {
  if (paymentMethod.type === "us_bank_account") {
    return paymentMethod.us_bank_account?.bank_name ?? "ACH";
  }

  return paymentMethod.card?.brand ?? "Card";
}

async function syncPaymentMethodRow(options: {
  customerId: string;
  customerNumber: string;
  paymentMethod: StripePaymentMethodLike;
  isDefault: boolean;
}) {
  const existing = await db.query.paymentMethods.findFirst({
    where: (table, { eq: localEq }) =>
      localEq(table.stripePaymentMethodId, options.paymentMethod.id),
  });

  if (options.isDefault) {
    await db
      .update(schema.paymentMethods)
      .set({
        isDefault: false,
        updatedAt: now(),
      })
      .where(eq(schema.paymentMethods.customerId, options.customerId));
  }

  const values = {
    customerId: options.customerId,
    provider: "stripe" as const,
    methodType: getPaymentMethodType(options.paymentMethod),
    stripePaymentMethodId: options.paymentMethod.id,
    last4: getPaymentMethodLast4(options.paymentMethod),
    brand: getPaymentMethodLabel(options.paymentMethod),
    achBankName:
      options.paymentMethod.type === "us_bank_account"
        ? (options.paymentMethod.us_bank_account?.bank_name ?? null)
        : null,
    isDefault: options.isDefault,
    updatedAt: now(),
  };

  const id = existing?.id ?? createId("pm");

  if (existing) {
    await db
      .update(schema.paymentMethods)
      .set(values)
      .where(eq(schema.paymentMethods.id, existing.id));
  } else {
    await db.insert(schema.paymentMethods).values({
      id,
      ...values,
      createdAt: now(),
    });
  }

  const record = await listPaymentMethods(options.customerNumber);
  return requireRecord(
    record.find((entry) => entry.id === id),
    `Payment method ${id} not found after sync.`,
  );
}

function toInvoiceRecord(invoice: InvoiceRow, customerName: string): InvoiceRecord {
  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    customerName,
    contractNumber: invoice.contractId ?? "Unassigned",
    status: invoice.status,
    invoiceDate: toIso(invoice.invoiceDate) ?? new Date(0).toISOString(),
    dueDate: toIso(invoice.dueDate) ?? new Date(0).toISOString(),
    totalAmount: numericToNumber(invoice.totalAmount),
    balanceAmount: numericToNumber(invoice.balanceAmount),
  };
}

function mapPaymentMethodRow(row: {
  id: string;
  customerNumber: string;
  provider: string;
  methodType: string;
  label: string | null;
  last4: string | null;
  isDefault: boolean;
}): PaymentMethodRecord {
  return {
    id: row.id,
    customerNumber: row.customerNumber,
    provider: row.provider,
    methodType: row.methodType,
    label: row.label ?? "Payment method",
    last4: row.last4 ?? "0000",
    isDefault: row.isDefault,
  };
}

function mapPaymentTransactionRow(row: {
  id: string;
  invoiceNumber: string | null;
  customerNumber: string | null;
  provider: string;
  transactionType: string;
  status: string;
  amount: string | number;
  currency: string;
  paymentMethodLabel: string | null;
  externalId: string | null;
  errorMessage: string | null;
  createdAt: Date;
  settledAt: Date | null;
}): PaymentTransactionRecord {
  return {
    id: row.id,
    invoiceNumber: row.invoiceNumber,
    customerNumber: row.customerNumber,
    provider: row.provider,
    transactionType: row.transactionType,
    status: row.status,
    amount: numericToNumber(row.amount),
    currency: row.currency,
    paymentMethodLabel: row.paymentMethodLabel,
    externalId: row.externalId,
    errorMessage: row.errorMessage,
    createdAt: toIso(row.createdAt) ?? new Date(0).toISOString(),
    settledAt: toIso(row.settledAt),
  };
}

async function applyInvoiceBalanceUpdate(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  invoice: InvoiceRow,
  amountDelta: number,
) {
  const totalAmount = numericToNumber(invoice.totalAmount);
  const balanceAmount = numericToNumber(invoice.balanceAmount);
  const nextBalance = Math.min(Math.max(balanceAmount + amountDelta, 0), totalAmount);

  let nextStatus = invoice.status;
  if (nextBalance === 0) {
    nextStatus = "paid";
  } else if (nextBalance < totalAmount) {
    nextStatus = "partially_paid";
  } else if (["paid", "partially_paid"].includes(invoice.status)) {
    nextStatus = "sent";
  }

  await tx
    .update(schema.invoices)
    .set({
      balanceAmount: nextBalance.toFixed(2),
      status: nextStatus,
      updatedAt: now(),
    })
    .where(eq(schema.invoices.id, invoice.id));

  return {
    nextBalance,
    nextStatus,
  };
}

export async function listPaymentMethods(customerNumber?: string) {
  const rows = await db
    .select({
      id: schema.paymentMethods.id,
      customerNumber: schema.customers.customerNumber,
      provider: schema.paymentMethods.provider,
      methodType: schema.paymentMethods.methodType,
      label: schema.paymentMethods.brand,
      last4: schema.paymentMethods.last4,
      isDefault: schema.paymentMethods.isDefault,
    })
    .from(schema.paymentMethods)
    .innerJoin(schema.customers, eq(schema.paymentMethods.customerId, schema.customers.id))
    .orderBy(desc(schema.paymentMethods.isDefault), desc(schema.paymentMethods.createdAt));

  return rows
    .map(mapPaymentMethodRow)
    .filter((method) =>
      customerNumber ? method.customerNumber === customerNumber : true,
    );
}

export async function addPaymentMethod(payload: AddPaymentMethodInput, userId?: string) {
  const customer = await getCustomerByIdOrNumber(payload.customerNumber);

  if (!payload.stripePaymentMethodId) {
    throw new ApiError(
      400,
      "stripePaymentMethodId is required when Metro Trailer runs in production mode.",
    );
  }

  const stripeCustomerId = await ensureStripeCustomerId(customer);
  const attached = await attachStripePaymentMethod({
    stripeCustomerId,
    paymentMethodId: payload.stripePaymentMethodId,
    makeDefault: payload.isDefault ?? false,
  });
  const paymentMethod: StripePaymentMethodLike =
    attached.mode === "live"
      ? (attached.data as Stripe.PaymentMethod)
      : {
          id: payload.stripePaymentMethodId,
          type: payload.methodType ?? "card",
          customer: stripeCustomerId,
          card: {
            brand: "unknown",
            last4: payload.last4 ?? "0000",
          },
        };

  const isDefault =
    payload.isDefault ??
    !(await db.query.paymentMethods.findFirst({
      where: (table, { eq: localEq }) => localEq(table.customerId, customer.id),
    }));

  const record = await syncPaymentMethodRow({
    customerId: customer.id,
    customerNumber: customer.customerNumber,
    paymentMethod,
    isDefault,
  });

  await pushAudit({
    entityType: "payment_method",
    entityId: record.id,
    eventType: "created",
    userId,
    metadata: {
      customerNumber: customer.customerNumber,
      stripePaymentMethodId: paymentMethod.id,
      isDefault,
    },
  });

  return record;
}

export async function setDefaultPaymentMethod(paymentMethodId: string, userId?: string) {
  const paymentMethod = await getPaymentMethodById(paymentMethodId);
  const customer = requireRecord(
    await db.query.customers.findFirst({
      where: (table, { eq: localEq }) => localEq(table.id, paymentMethod.customerId),
    }),
    `Customer ${paymentMethod.customerId} not found.`,
  );

  if (!paymentMethod.stripePaymentMethodId) {
    throw new ApiError(409, "Payment method is missing a Stripe payment method ID.");
  }

  const stripeCustomerId = await ensureStripeCustomerId(customer);
  await attachStripePaymentMethod({
    stripeCustomerId,
    paymentMethodId: paymentMethod.stripePaymentMethodId,
    makeDefault: true,
  });

  await db.transaction(async (tx) => {
    await tx
      .update(schema.paymentMethods)
      .set({
        isDefault: false,
        updatedAt: now(),
      })
      .where(eq(schema.paymentMethods.customerId, customer.id));

    await tx
      .update(schema.paymentMethods)
      .set({
        isDefault: true,
        updatedAt: now(),
      })
      .where(eq(schema.paymentMethods.id, paymentMethod.id));
  });

  await pushAudit({
    entityType: "payment_method",
    entityId: paymentMethod.id,
    eventType: "default_set",
    userId,
    metadata: {
      customerNumber: customer.customerNumber,
    },
  });

  const methods = await listPaymentMethods(customer.customerNumber);
  return requireRecord(
    methods.find((entry) => entry.id === paymentMethod.id),
    `Payment method ${paymentMethod.id} not found after default update.`,
  );
}

export async function createPaymentIntentForInvoice(
  input: CreatePaymentIntentInput | string,
) {
  const invoiceId = typeof input === "string" ? input : input.invoiceId;
  const requestedPaymentMethodId =
    typeof input === "string" ? undefined : input.paymentMethodId;

  const invoice = await getInvoiceByIdOrNumber(invoiceId);
  const customer = requireRecord(
    await db.query.customers.findFirst({
      where: (table, { eq: localEq }) => localEq(table.id, invoice.customerId),
    }),
    `Customer ${invoice.customerId} not found.`,
  );
  const stripeCustomerId = await ensureStripeCustomerId(customer);

  const localPaymentMethod = requestedPaymentMethodId
    ? await getPaymentMethodById(requestedPaymentMethodId)
    : await db.query.paymentMethods.findFirst({
        where: (table, { and: localAnd, eq: localEq }) =>
          localAnd(localEq(table.customerId, customer.id), localEq(table.isDefault, true)),
      });

  const result = await createStripePaymentIntent({
    invoice: toInvoiceRecord(invoice, customer.name),
    customerName: customer.name,
    customerNumber: customer.customerNumber,
    stripeCustomerId,
    stripePaymentMethodId: localPaymentMethod?.stripePaymentMethodId ?? null,
  });

  await db.transaction(async (tx) => {
    await tx
      .update(schema.invoices)
      .set({
        stripePaymentIntentId: result.data.paymentIntentId,
        updatedAt: now(),
      })
      .where(eq(schema.invoices.id, invoice.id));

    const existing = await tx.query.paymentTransactions.findFirst({
      where: (table, { eq: localEq }) =>
        localEq(table.externalId, result.data.paymentIntentId),
    });

    if (!existing) {
      await tx.insert(schema.paymentTransactions).values({
        id: createId("pay"),
        invoiceId: invoice.id,
        customerId: customer.id,
        paymentMethodId: localPaymentMethod?.id ?? null,
        provider: "stripe",
        transactionType: "payment_intent",
        status: "pending",
        externalId: result.data.paymentIntentId,
        amount: (result.data.amount / 100).toFixed(2),
        currency: result.data.currency,
        payload: {
          invoiceNumber: invoice.invoiceNumber,
          customerNumber: customer.customerNumber,
        },
        createdAt: now(),
      });
    }
  });

  return result;
}

export async function createSetupIntentForCustomer(customerNumber: string) {
  const customer = await getCustomerByIdOrNumber(customerNumber);
  const stripeCustomerId = await ensureStripeCustomerId(customer);
  return createStripeSetupIntent({
    stripeCustomerId,
    customerNumber: customer.customerNumber,
  });
}

export async function createCustomerPortalSession(customerNumber: string, returnUrl: string) {
  const customer = await getCustomerByIdOrNumber(customerNumber);
  const stripeCustomerId = await ensureStripeCustomerId(customer);
  return createStripePortalSession({
    customerName: customer.name,
    returnUrl,
    stripeCustomerId,
  });
}

export async function listPaymentTransactions(filters?: ListPaymentTransactionFilters) {
  const rows = await db
    .select({
      id: schema.paymentTransactions.id,
      invoiceNumber: schema.invoices.invoiceNumber,
      customerNumber: schema.customers.customerNumber,
      provider: schema.paymentTransactions.provider,
      transactionType: schema.paymentTransactions.transactionType,
      status: schema.paymentTransactions.status,
      amount: schema.paymentTransactions.amount,
      currency: schema.paymentTransactions.currency,
      paymentMethodLabel: schema.paymentMethods.brand,
      externalId: schema.paymentTransactions.externalId,
      errorMessage: schema.paymentTransactions.errorMessage,
      createdAt: schema.paymentTransactions.createdAt,
      settledAt: schema.paymentTransactions.settledAt,
    })
    .from(schema.paymentTransactions)
    .leftJoin(schema.invoices, eq(schema.paymentTransactions.invoiceId, schema.invoices.id))
    .leftJoin(schema.customers, eq(schema.paymentTransactions.customerId, schema.customers.id))
    .leftJoin(
      schema.paymentMethods,
      eq(schema.paymentTransactions.paymentMethodId, schema.paymentMethods.id),
    )
    .orderBy(desc(schema.paymentTransactions.createdAt));

  return rows
    .filter((row) => {
      if (filters?.customerNumber && row.customerNumber !== filters.customerNumber) {
        return false;
      }
      if (
        filters?.invoiceId &&
        row.invoiceNumber !== filters.invoiceId &&
        row.id !== filters.invoiceId
      ) {
        return false;
      }
      return true;
    })
    .map(mapPaymentTransactionRow);
}

export async function refundPaymentTransaction(
  transactionId: string,
  amount?: number,
  userId?: string,
) {
  const transaction = requireRecord(
    await db.query.paymentTransactions.findFirst({
      where: (table, { eq: localEq, or: localOr }) =>
        localOr(localEq(table.id, transactionId), localEq(table.externalId, transactionId)),
    }),
    `Payment transaction ${transactionId} not found.`,
  );

  if (!transaction.externalId) {
    throw new ApiError(409, "Transaction cannot be refunded because it has no Stripe external ID.");
  }

  const amountToRefund = amount
    ? Math.min(amount, numericToNumber(transaction.amount))
    : numericToNumber(transaction.amount);

  const refund = await createStripeRefund({
    paymentIntentId:
      transaction.transactionType === "payment_intent" ? transaction.externalId : null,
    chargeId: transaction.transactionType === "charge" ? transaction.externalId : null,
    amountCents: Math.round(amountToRefund * 100),
    metadata: {
      sourceTransactionId: transaction.id,
    },
  });

  await db.transaction(async (tx) => {
    await tx.insert(schema.paymentTransactions).values({
      id: createId("pay"),
      invoiceId: transaction.invoiceId,
      customerId: transaction.customerId,
      paymentMethodId: transaction.paymentMethodId,
      provider: "stripe",
      transactionType: "refund",
      status:
        refund.data.status === "succeeded" ? "refunded" : "pending",
      externalId: refund.data.refundId,
      amount: amountToRefund.toFixed(2),
      currency: transaction.currency,
      payload: {
        sourceTransactionId: transaction.id,
      },
      createdAt: now(),
      settledAt: refund.data.status === "succeeded" ? now() : null,
    });

    if (transaction.invoiceId) {
      const invoice = requireRecord(
        await tx.query.invoices.findFirst({
          where: (table, { eq: localEq }) => localEq(table.id, transaction.invoiceId as string),
        }),
        `Invoice ${transaction.invoiceId} not found for refund.`,
      );
      await applyInvoiceBalanceUpdate(tx, invoice, amountToRefund);
      await enqueueOutboxJob({
        jobType: "payment.sync.quickbooks",
        aggregateType: "invoice",
        aggregateId: invoice.id,
        provider: "quickbooks",
        payload: {
          invoiceNumber: invoice.invoiceNumber,
          amount: amountToRefund,
          event: "refund",
        },
      });
    }
  });

  await pushAudit({
    entityType: "invoice",
    entityId: transaction.invoiceId ?? transaction.id,
    eventType: "refund_recorded",
    userId,
    metadata: {
      sourceTransactionId: transaction.id,
      refundId: refund.data.refundId,
      amount: amountToRefund,
    },
  });

  return refund;
}

async function applySuccessfulPaymentIntent(event: Stripe.Event) {
  const paymentIntent = event.data.object as Stripe.PaymentIntent;
  const applicationExternalId = `${paymentIntent.id}:application`;
  const invoiceId =
    typeof paymentIntent.metadata?.invoiceId === "string"
      ? paymentIntent.metadata.invoiceId
      : null;
  const invoice =
    invoiceId !== null
      ? await db.query.invoices.findFirst({
          where: (table, { eq: localEq }) => localEq(table.id, invoiceId),
        })
      : await db.query.invoices.findFirst({
          where: (table, { eq: localEq }) => localEq(table.stripePaymentIntentId, paymentIntent.id),
        });

  if (!invoice) {
    return;
  }

  const existing = await db.query.paymentTransactions.findFirst({
    where: (table, { and: localAnd, eq: localEq }) =>
      localAnd(
        localEq(table.provider, "stripe"),
        localEq(table.externalId, paymentIntent.id),
      ),
  });
  const amountReceived = (paymentIntent.amount_received || paymentIntent.amount || 0) / 100;

  await db.transaction(async (tx) => {
    if (existing) {
      await tx
        .update(schema.paymentTransactions)
        .set({
          status: "succeeded",
          payload: {
            ...(existing.payload ?? {}),
            webhookEventId: event.id,
          },
          settledAt: now(),
        })
        .where(eq(schema.paymentTransactions.id, existing.id));
    } else {
      await tx.insert(schema.paymentTransactions).values({
        id: createId("pay"),
        invoiceId: invoice.id,
        customerId: invoice.customerId,
        provider: "stripe",
        transactionType: "payment_intent",
        status: "succeeded",
        externalId: paymentIntent.id,
        amount: amountReceived.toFixed(2),
        currency: paymentIntent.currency,
        payload: {
          invoiceNumber: invoice.invoiceNumber,
          webhookEventId: event.id,
        },
        createdAt: now(),
        settledAt: now(),
      });
    }

    const paymentApplication = await tx.query.paymentTransactions.findFirst({
      where: (table, { and: localAnd, eq: localEq }) =>
        localAnd(
          localEq(table.provider, "stripe"),
          localEq(table.transactionType, "payment_application"),
          localEq(table.externalId, applicationExternalId),
        ),
    });

    if (!paymentApplication) {
      await applyInvoiceBalanceUpdate(tx, invoice, -amountReceived);
      await tx.insert(schema.paymentTransactions).values({
        id: createId("pay"),
        invoiceId: invoice.id,
        customerId: invoice.customerId,
        provider: "stripe",
        transactionType: "payment_application",
        status: "succeeded",
        externalId: applicationExternalId,
        amount: amountReceived.toFixed(2),
        currency: paymentIntent.currency,
        payload: {
          invoiceNumber: invoice.invoiceNumber,
          webhookEventId: event.id,
        },
        createdAt: now(),
        settledAt: now(),
      });
    }
  });

  await enqueueOutboxJob({
    jobType: "payment.sync.quickbooks",
    aggregateType: "invoice",
    aggregateId: invoice.id,
    provider: "quickbooks",
    payload: {
      invoiceNumber: invoice.invoiceNumber,
      amount: amountReceived,
      source: "stripe_webhook",
    },
  });
}

async function applyFailedPaymentIntent(event: Stripe.Event) {
  const paymentIntent = event.data.object as Stripe.PaymentIntent;
  const existing = await db.query.paymentTransactions.findFirst({
    where: (table, { eq: localEq }) => localEq(table.externalId, paymentIntent.id),
  });

  if (!existing) {
    return;
  }

  await db
    .update(schema.paymentTransactions)
    .set({
      status: "failed",
      errorMessage: paymentIntent.last_payment_error?.message ?? "Stripe payment failed.",
    })
    .where(eq(schema.paymentTransactions.id, existing.id));
}

async function applyChargeRefunded(event: Stripe.Event) {
  const charge = event.data.object as Stripe.Charge;
  const sourcePayment = await db.query.paymentTransactions.findFirst({
    where: (table, { eq: localEq }) => localEq(table.externalId, charge.payment_intent as string),
  });
  const invoice =
    sourcePayment?.invoiceId
      ? await db.query.invoices.findFirst({
          where: (table, { eq: localEq }) => localEq(table.id, sourcePayment.invoiceId as string),
        })
      : null;

  if (!invoice) {
    return;
  }

  const refunds = charge.refunds?.data ?? [];
  for (const refund of refunds) {
    if (refund.status !== "succeeded") {
      continue;
    }

    const existingRefund = await db.query.paymentTransactions.findFirst({
      where: (table, { eq: localEq }) => localEq(table.externalId, refund.id),
    });

    if (existingRefund) {
      continue;
    }

    const amount = refund.amount / 100;
    await db.transaction(async (tx) => {
      await applyInvoiceBalanceUpdate(tx, invoice, amount);
      await tx.insert(schema.paymentTransactions).values({
        id: createId("pay"),
        invoiceId: invoice.id,
        customerId: invoice.customerId,
        provider: "stripe",
        transactionType: "refund",
        status: "refunded",
        externalId: refund.id,
        amount: amount.toFixed(2),
        currency: refund.currency,
        payload: {
          chargeId: charge.id,
          webhookEventId: event.id,
        },
        createdAt: now(),
        settledAt: now(),
      });
    });
  }
}

export async function processStripeWebhookReceipt(receiptId: string) {
  const receipt = requireRecord(
    await db.query.webhookReceipts.findFirst({
      where: (table, { eq: localEq }) => localEq(table.id, receiptId),
    }),
    `Webhook receipt ${receiptId} not found.`,
  );

  if (receipt.provider !== "stripe") {
    throw new ApiError(400, `Webhook receipt ${receiptId} is not a Stripe receipt.`);
  }

  const event = receipt.payload as unknown as Stripe.Event;

  try {
    if (event.type === "payment_intent.succeeded") {
      await applySuccessfulPaymentIntent(event);
    } else if (event.type === "payment_intent.payment_failed") {
      await applyFailedPaymentIntent(event);
    } else if (event.type === "charge.refunded") {
      await applyChargeRefunded(event);
    } else if (event.type === "payment_method.attached") {
      const paymentMethod = event.data.object as Stripe.PaymentMethod;
      const stripeCustomerId =
        typeof paymentMethod.customer === "string" ? paymentMethod.customer : null;
      if (stripeCustomerId) {
        const customer = await getCustomerByStripeCustomerId(stripeCustomerId);
        if (customer) {
          await syncPaymentMethodRow({
            customerId: customer.id,
            customerNumber: customer.customerNumber,
            paymentMethod,
            isDefault: false,
          });
        }
      }
    }

    await db
      .update(schema.webhookReceipts)
      .set({
        status: "processed",
        processedAt: now(),
        processingError: null,
      })
      .where(eq(schema.webhookReceipts.id, receipt.id));

    return { processed: true, eventType: event.type };
  } catch (error) {
    await db
      .update(schema.webhookReceipts)
      .set({
        status: "failed",
        processedAt: now(),
        processingError: error instanceof Error ? error.message : "Unknown Stripe webhook error.",
      })
      .where(eq(schema.webhookReceipts.id, receipt.id));
    throw error;
  }
}

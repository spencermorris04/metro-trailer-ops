import { and, desc, eq, inArray, isNull } from "drizzle-orm";

import { db, schema } from "@/lib/db";
import { ApiError } from "@/lib/server/api";
import { decryptSecret, encryptSecret } from "@/lib/server/credential-crypto";
import {
  createOrUpdateQuickBooksInvoice,
  createQuickBooksAuthorizationUrl,
  createQuickBooksCustomer,
  createQuickBooksPayment,
  exchangeQuickBooksAuthorizationCode,
  fetchQuickBooksCompanyInfo,
  fetchQuickBooksEntity,
  refreshQuickBooksAccessToken,
  verifyQuickBooksWebhookSignature,
  type QuickBooksConnectionInput,
  type QuickBooksEnvironment,
} from "@/lib/server/integration-clients";
import {
  claimOutboxJobs,
  enqueueOutboxJob,
  getOutboxJob,
  getWebhookReceipt,
  listPendingOutboxJobs,
  markOutboxJobFailed,
  markOutboxJobSucceeded,
  markWebhookReceiptFailed,
  markWebhookReceiptIgnored,
  markWebhookReceiptProcessed,
  recordWebhookReceipt,
} from "@/lib/server/outbox";
import { createId, numericToNumber, now, toIso } from "@/lib/server/production-utils";
import { isProductionRuntime } from "@/lib/server/runtime";

type JsonRecord = Record<string, unknown>;
type ConnectionRow = typeof schema.quickbooksConnections.$inferSelect;
type OutboxJobRow = typeof schema.outboxJobs.$inferSelect;

function getQuickBooksRuntimeEnvironment(): QuickBooksEnvironment {
  return process.env.QUICKBOOKS_ENVIRONMENT?.trim().toLowerCase() === "production"
    ? "production"
    : "sandbox";
}

function parseProviderPayload(value: unknown): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as JsonRecord;
}

function toQuickBooksConnectionInput(connection: ConnectionRow): QuickBooksConnectionInput {
  const accessToken = decryptSecret(connection.accessTokenEncrypted);
  const refreshToken = decryptSecret(connection.refreshTokenEncrypted);

  if (!accessToken || !refreshToken) {
    throw new ApiError(503, "QuickBooks connection tokens are unavailable.");
  }

  return {
    realmId: connection.realmId,
    accessToken,
    refreshToken,
    environment: connection.environment,
  };
}

async function getSyncJobForOutboxJob(jobId: string) {
  const rows = await db
    .select()
    .from(schema.integrationSyncJobs)
    .where(eq(schema.integrationSyncJobs.provider, "quickbooks"))
    .orderBy(desc(schema.integrationSyncJobs.startedAt));

  return (
    rows.find((row) => parseProviderPayload(row.payload).outboxJobId === jobId) ?? null
  );
}

async function updateSyncJobForOutbox(options: {
  outboxJobId: string;
  status: typeof schema.integrationSyncJobs.$inferInsert.status;
  lastError?: string | null;
  payloadPatch?: JsonRecord;
}) {
  const syncJob = await getSyncJobForOutboxJob(options.outboxJobId);
  if (!syncJob) {
    return null;
  }

  const payload = parseProviderPayload(syncJob.payload);
  await db
    .update(schema.integrationSyncJobs)
    .set({
      status: options.status,
      lastError: options.lastError ?? null,
      payload:
        options.payloadPatch && Object.keys(options.payloadPatch).length > 0
          ? {
              ...payload,
              ...options.payloadPatch,
            }
          : payload,
      finishedAt:
        options.status === "success" || options.status === "failed" ? now() : null,
    })
    .where(eq(schema.integrationSyncJobs.id, syncJob.id));

  return syncJob.id;
}

async function getMapping(options: {
  entityType: string;
  internalId?: string;
  externalId?: string;
}) {
  return db.query.externalEntityMappings.findFirst({
    where: (table, { and: localAnd, eq: localEq }) =>
      localAnd(
        localEq(table.provider, "quickbooks"),
        localEq(table.entityType, options.entityType),
        options.internalId
          ? localEq(table.internalId, options.internalId)
          : localEq(table.externalId, options.externalId ?? ""),
      ),
  });
}

async function upsertMapping(options: {
  entityType: string;
  internalId: string;
  externalId: string;
  payload?: JsonRecord;
}) {
  const existing = await getMapping({
    entityType: options.entityType,
    internalId: options.internalId,
  });

  if (existing) {
    await db
      .update(schema.externalEntityMappings)
      .set({
        externalId: options.externalId,
        payload: options.payload ?? existing.payload,
        updatedAt: now(),
      })
      .where(eq(schema.externalEntityMappings.id, existing.id));
    return existing.id;
  }

  const id = createId("map");
  await db.insert(schema.externalEntityMappings).values({
    id,
    provider: "quickbooks",
    entityType: options.entityType,
    internalId: options.internalId,
    externalId: options.externalId,
    payload: options.payload ?? {},
    createdAt: now(),
    updatedAt: now(),
  });
  return id;
}

async function createAccountingIssue(options: {
  connectionId?: string | null;
  syncJobId?: string | null;
  entityType: string;
  internalEntityId?: string | null;
  externalEntityId?: string | null;
  reasonCode: string;
  summary: string;
  details?: JsonRecord;
}) {
  const existing = await db.query.accountingSyncIssues.findFirst({
    where: (table, { and: localAnd, eq: localEq }) =>
      localAnd(
        localEq(table.provider, "quickbooks"),
        localEq(table.entityType, options.entityType),
        localEq(table.reasonCode, options.reasonCode),
        localEq(table.status, "open"),
        options.internalEntityId != null
          ? localEq(table.internalEntityId, options.internalEntityId)
          : isNull(table.internalEntityId),
      ),
  });

  if (existing) {
    await db
      .update(schema.accountingSyncIssues)
      .set({
        connectionId: options.connectionId ?? existing.connectionId,
        syncJobId: options.syncJobId ?? existing.syncJobId,
        externalEntityId: options.externalEntityId ?? existing.externalEntityId,
        summary: options.summary,
        details: options.details ?? existing.details,
        updatedAt: now(),
      })
      .where(eq(schema.accountingSyncIssues.id, existing.id));
    return existing.id;
  }

  const id = createId("acct_issue");
  await db.insert(schema.accountingSyncIssues).values({
    id,
    provider: "quickbooks",
    connectionId: options.connectionId ?? null,
    syncJobId: options.syncJobId ?? null,
    entityType: options.entityType,
    internalEntityId: options.internalEntityId ?? null,
    externalEntityId: options.externalEntityId ?? null,
    status: "open",
    reasonCode: options.reasonCode,
    summary: options.summary,
    details: options.details ?? {},
    createdAt: now(),
    updatedAt: now(),
  });
  return id;
}

async function clearAccountingIssues(options: {
  entityType: string;
  internalEntityId?: string | null;
  reasonCodes?: string[];
}) {
  const predicates = [
    eq(schema.accountingSyncIssues.provider, "quickbooks"),
    eq(schema.accountingSyncIssues.entityType, options.entityType),
    eq(schema.accountingSyncIssues.status, "open"),
  ];
  if (options.internalEntityId !== undefined) {
    predicates.push(
      options.internalEntityId != null
        ? eq(schema.accountingSyncIssues.internalEntityId, options.internalEntityId)
        : isNull(schema.accountingSyncIssues.internalEntityId),
    );
  }
  if (options.reasonCodes && options.reasonCodes.length > 0) {
    predicates.push(inArray(schema.accountingSyncIssues.reasonCode, options.reasonCodes));
  }

  await db
    .update(schema.accountingSyncIssues)
    .set({
      status: "resolved",
      resolvedAt: now(),
      updatedAt: now(),
    })
    .where(and(...predicates));
}

async function getActiveQuickBooksConnection() {
  const rows = await db
    .select()
    .from(schema.quickbooksConnections)
    .where(
      inArray(schema.quickbooksConnections.status, ["active", "refresh_required"]),
    )
    .orderBy(desc(schema.quickbooksConnections.updatedAt))
    .limit(1);

  return rows[0] ?? null;
}

async function refreshConnection(connectionId: string) {
  const connection = await db.query.quickbooksConnections.findFirst({
    where: (table, { eq: localEq }) => localEq(table.id, connectionId),
  });
  if (!connection) {
    throw new ApiError(404, "QuickBooks connection not found.");
  }

  const refreshToken = decryptSecret(connection.refreshTokenEncrypted);
  if (!refreshToken) {
    throw new ApiError(503, "QuickBooks refresh token is unavailable.");
  }

  const refreshed = await refreshQuickBooksAccessToken({ refreshToken });
  await db
    .update(schema.quickbooksConnections)
    .set({
      accessTokenEncrypted: encryptSecret(refreshed.data.accessToken),
      refreshTokenEncrypted: encryptSecret(refreshed.data.refreshToken),
      tokenType: refreshed.data.tokenType,
      scopes: refreshed.data.scopes,
      accessTokenExpiresAt: refreshed.data.accessTokenExpiresAt,
      refreshTokenExpiresAt: refreshed.data.refreshTokenExpiresAt,
      lastRefreshedAt: now(),
      status: "active",
      metadata: refreshed.data.raw,
      updatedAt: now(),
    })
    .where(eq(schema.quickbooksConnections.id, connection.id));

  return {
    connection: {
      ...connection,
      environment: connection.environment,
    },
    input: {
      realmId: connection.realmId,
      accessToken: refreshed.data.accessToken,
      refreshToken: refreshed.data.refreshToken,
      environment: connection.environment,
    } satisfies QuickBooksConnectionInput,
  };
}

async function ensureQuickBooksConnection() {
  const connection = await getActiveQuickBooksConnection();
  if (!connection) {
    throw new ApiError(503, "QuickBooks is not connected.");
  }

  if (
    connection.status === "refresh_required" ||
    (connection.accessTokenExpiresAt &&
      connection.accessTokenExpiresAt.getTime() <= Date.now() + 60_000)
  ) {
    return refreshConnection(connection.id);
  }

  return {
    connection,
    input: toQuickBooksConnectionInput(connection),
  };
}

async function ensureCustomerMapping(customerId: string) {
  const mapping = await getMapping({
    entityType: "customer",
    internalId: customerId,
  });
  if (mapping) {
    return mapping;
  }

  const customer = await db.query.customers.findFirst({
    where: (table, { eq: localEq }) => localEq(table.id, customerId),
  });
  if (!customer) {
    throw new ApiError(404, "Customer not found for QuickBooks sync.");
  }

  const { input } = await ensureQuickBooksConnection();
  const contactInfo = parseProviderPayload(customer.contactInfo);
  const billingAddress = parseProviderPayload(customer.billingAddress);
  const response = await createQuickBooksCustomer({
    connection: input,
    payload: {
      DisplayName: customer.name,
      CompanyName: customer.name,
      PrimaryEmailAddr:
        typeof contactInfo.email === "string"
          ? {
              Address: contactInfo.email,
            }
          : undefined,
      BillAddr: {
        Line1: typeof billingAddress.line1 === "string" ? billingAddress.line1 : "",
        City: typeof billingAddress.city === "string" ? billingAddress.city : "",
        CountrySubDivisionCode:
          typeof billingAddress.state === "string" ? billingAddress.state : "",
        PostalCode:
          typeof billingAddress.postalCode === "string"
            ? billingAddress.postalCode
            : "",
        Country: typeof billingAddress.country === "string" ? billingAddress.country : "US",
      },
      Notes: customer.notes ?? undefined,
    },
  });
  const quickBooksCustomer = parseProviderPayload(response.data.Customer);
  const externalId = String(quickBooksCustomer.Id ?? "");
  if (!externalId) {
    throw new ApiError(502, "QuickBooks customer sync returned no Id.");
  }

  await upsertMapping({
    entityType: "customer",
    internalId: customer.id,
    externalId,
    payload: quickBooksCustomer,
  });
  await clearAccountingIssues({
    entityType: "customer",
    internalEntityId: customer.id,
  });

  const created = await getMapping({
    entityType: "customer",
    internalId: customer.id,
  });
  if (!created) {
    throw new ApiError(500, "QuickBooks customer mapping was not created.");
  }

  return created;
}

function buildQuickBooksInvoiceLine(options: {
  description: string;
  quantity: number;
  unitPrice: number;
}) {
  return {
    DetailType: "SalesItemLineDetail",
    Amount: Number((options.quantity * options.unitPrice).toFixed(2)),
    Description: options.description,
    SalesItemLineDetail: {
      Qty: options.quantity,
      UnitPrice: Number(options.unitPrice.toFixed(2)),
    },
  };
}

async function createQuickBooksInvoicePayload(invoiceId: string) {
  const invoice = await db.query.invoices.findFirst({
    where: (table, { eq: localEq }) => localEq(table.id, invoiceId),
  });
  if (!invoice) {
    throw new ApiError(404, "Invoice not found for QuickBooks sync.");
  }

  const [customer, lines, existingMapping] = await Promise.all([
    db.query.customers.findFirst({
      where: (table, { eq: localEq }) => localEq(table.id, invoice.customerId),
    }),
    db
      .select()
      .from(schema.invoiceLines)
      .where(eq(schema.invoiceLines.invoiceId, invoice.id)),
    getMapping({
      entityType: "invoice",
      internalId: invoice.id,
    }),
  ]);

  if (!customer) {
    throw new ApiError(404, "Customer not found for QuickBooks invoice sync.");
  }

  const customerMapping = await ensureCustomerMapping(customer.id);
  const existingPayload = parseProviderPayload(existingMapping?.payload);
  const contactInfo = parseProviderPayload(customer.contactInfo);

  return {
    invoice,
    payload: {
      ...(typeof existingPayload.SyncToken === "string"
        ? {
            sparse: true,
            Id: existingMapping?.externalId,
            SyncToken: String(existingPayload.SyncToken),
          }
        : {}),
      DocNumber: invoice.invoiceNumber,
      TxnDate:
        toIso(invoice.invoiceDate)?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
      DueDate:
        toIso(invoice.dueDate)?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
      CustomerRef: {
        value: customerMapping.externalId,
        name: customer.name,
      },
      Line: lines.map((line) =>
        buildQuickBooksInvoiceLine({
          description: line.description,
          quantity: numericToNumber(line.quantity, 1),
          unitPrice: numericToNumber(line.unitPrice),
        }),
      ),
      BillEmail:
        typeof contactInfo.email === "string"
          ? {
              Address: contactInfo.email,
            }
          : undefined,
      CustomerMemo: {
        value: `Metro Trailer invoice ${invoice.invoiceNumber}`,
      },
      PrivateNote: `Metro Trailer invoice ${invoice.invoiceNumber}`,
    },
  };
}

async function createQuickBooksPaymentPayload(paymentTransactionId: string) {
  const payment = await db.query.paymentTransactions.findFirst({
    where: (table, { eq: localEq }) => localEq(table.id, paymentTransactionId),
  });
  if (!payment || !payment.invoiceId || !payment.customerId) {
    throw new ApiError(404, "Payment transaction not found for QuickBooks sync.");
  }

  const [invoice, customer, invoiceMapping, customerMapping] = await Promise.all([
    db.query.invoices.findFirst({
      where: (table, { eq: localEq }) => localEq(table.id, payment.invoiceId!),
    }),
    db.query.customers.findFirst({
      where: (table, { eq: localEq }) => localEq(table.id, payment.customerId!),
    }),
    getMapping({
      entityType: "invoice",
      internalId: payment.invoiceId,
    }),
    ensureCustomerMapping(payment.customerId),
  ]);

  if (!invoice || !customer) {
    throw new ApiError(404, "Invoice or customer not found for QuickBooks payment sync.");
  }
  if (!invoiceMapping) {
    throw new ApiError(409, "Invoice must be synced to QuickBooks before payment sync.");
  }

  return {
    payment,
    payload: {
      TotalAmt: numericToNumber(payment.amount),
      TxnDate:
        toIso(payment.settledAt ?? payment.createdAt)?.slice(0, 10) ??
        new Date().toISOString().slice(0, 10),
      CustomerRef: {
        value: customerMapping.externalId,
        name: customer.name,
      },
      PrivateNote: `Metro Trailer payment ${payment.id}`,
      Line: [
        {
          Amount: numericToNumber(payment.amount),
          LinkedTxn: [
            {
              TxnId: invoiceMapping.externalId,
              TxnType: "Invoice",
            },
          ],
        },
      ],
    },
  };
}

export async function listQuickBooksConnections() {
  const rows = await db
    .select()
    .from(schema.quickbooksConnections)
    .orderBy(desc(schema.quickbooksConnections.updatedAt));

  return rows.map((row) => ({
    id: row.id,
    realmId: row.realmId,
    companyName: row.companyName ?? "Unknown company",
    environment: row.environment,
    status: row.status,
    scopes: row.scopes ?? [],
    connectedAt: toIso(row.connectedAt),
    lastRefreshedAt: toIso(row.lastRefreshedAt),
    disconnectedAt: toIso(row.disconnectedAt),
  }));
}

export async function beginQuickBooksOAuth(options?: {
  userId?: string | null;
  redirectPath?: string | null;
}) {
  if (!isProductionRuntime()) {
    throw new ApiError(501, "QuickBooks OAuth is not available in demo runtime.");
  }

  const state = createId("qbo_state");
  const authorization = createQuickBooksAuthorizationUrl({
    state,
  });
  if (!authorization) {
    throw new ApiError(503, "QuickBooks OAuth configuration is incomplete.");
  }

  await db.insert(schema.quickbooksAuthStates).values({
    id: createId("qbo_auth"),
    state,
    requestedByUserId: options?.userId ?? null,
    redirectPath: options?.redirectPath ?? null,
    expiresAt: new Date(Date.now() + 15 * 60_000),
    createdAt: now(),
  });

  return {
    state,
    url: authorization.data.url,
    environment: authorization.data.environment,
  };
}

export async function completeQuickBooksOAuth(options: {
  code: string;
  state: string;
  realmId: string;
}) {
  const authState = await db.query.quickbooksAuthStates.findFirst({
    where: (table, { eq: localEq }) => localEq(table.state, options.state),
  });
  if (!authState || authState.consumedAt || authState.expiresAt.getTime() < Date.now()) {
    throw new ApiError(400, "QuickBooks OAuth state is invalid or expired.");
  }

  const tokens = await exchangeQuickBooksAuthorizationCode({
    code: options.code,
  });
  const environment = getQuickBooksRuntimeEnvironment();

  let companyName: string | null = null;
  try {
    const companyInfo = await fetchQuickBooksCompanyInfo({
      realmId: options.realmId,
      accessToken: tokens.data.accessToken,
      refreshToken: tokens.data.refreshToken,
      environment,
    });
    companyName =
      typeof companyInfo.data.CompanyInfo?.CompanyName === "string"
        ? String(companyInfo.data.CompanyInfo.CompanyName)
        : null;
  } catch {
    companyName = null;
  }

  const existing = await db.query.quickbooksConnections.findFirst({
    where: (table, { eq: localEq }) => localEq(table.realmId, options.realmId),
  });

  const values = {
    realmId: options.realmId,
    companyName,
    environment,
    status: "active" as const,
    scopes: tokens.data.scopes,
    tokenType: tokens.data.tokenType,
    accessTokenEncrypted: encryptSecret(tokens.data.accessToken),
    refreshTokenEncrypted: encryptSecret(tokens.data.refreshToken),
    accessTokenExpiresAt: tokens.data.accessTokenExpiresAt,
    refreshTokenExpiresAt: tokens.data.refreshTokenExpiresAt,
    connectedByUserId: authState.requestedByUserId ?? null,
    connectedAt: now(),
    lastRefreshedAt: now(),
    disconnectedAt: null,
    metadata: tokens.data.raw,
    updatedAt: now(),
  };

  if (existing) {
    await db
      .update(schema.quickbooksConnections)
      .set(values)
      .where(eq(schema.quickbooksConnections.id, existing.id));
  } else {
    await db.insert(schema.quickbooksConnections).values({
      id: createId("qbo"),
      ...values,
      createdAt: now(),
    });
  }

  await db
    .update(schema.quickbooksAuthStates)
    .set({
      consumedAt: now(),
    })
    .where(eq(schema.quickbooksAuthStates.id, authState.id));

  return {
    realmId: options.realmId,
    companyName,
    redirectPath: authState.redirectPath,
  };
}

export async function disconnectQuickBooksConnection() {
  const connection = await getActiveQuickBooksConnection();
  if (!connection) {
    return {
      disconnected: false,
    };
  }

  const refreshToken = decryptSecret(connection.refreshTokenEncrypted);
  if (refreshToken) {
    try {
      const { revokeQuickBooksToken } = await import("@/lib/server/integration-clients");
      await revokeQuickBooksToken({ refreshToken });
    } catch {
      // Best effort.
    }
  }

  await db
    .update(schema.quickbooksConnections)
    .set({
      status: "disconnected",
      disconnectedAt: now(),
      updatedAt: now(),
    })
    .where(eq(schema.quickbooksConnections.id, connection.id));

  return {
    disconnected: true,
    connectionId: connection.id,
  };
}

export async function listAccountingSyncIssues(filters?: {
  status?: "open" | "resolved" | "ignored";
}) {
  const rows = await db
    .select()
    .from(schema.accountingSyncIssues)
    .where(
      filters?.status
        ? and(
            eq(schema.accountingSyncIssues.provider, "quickbooks"),
            eq(schema.accountingSyncIssues.status, filters.status),
          )
        : eq(schema.accountingSyncIssues.provider, "quickbooks"),
    )
    .orderBy(desc(schema.accountingSyncIssues.createdAt));

  return rows.map((row) => ({
    id: row.id,
    entityType: row.entityType,
    internalEntityId: row.internalEntityId,
    externalEntityId: row.externalEntityId,
    status: row.status,
    reasonCode: row.reasonCode,
    summary: row.summary,
    details: row.details ?? {},
    createdAt: toIso(row.createdAt),
    resolvedAt: toIso(row.resolvedAt),
  }));
}

export async function resolveAccountingSyncIssue(issueId: string, userId?: string | null) {
  const issue = await db.query.accountingSyncIssues.findFirst({
    where: (table, { eq: localEq }) => localEq(table.id, issueId),
  });
  if (!issue) {
    throw new ApiError(404, "Accounting sync issue not found.");
  }

  await db
    .update(schema.accountingSyncIssues)
    .set({
      status: "resolved",
      resolvedByUserId: userId ?? null,
      resolvedAt: now(),
      updatedAt: now(),
    })
    .where(eq(schema.accountingSyncIssues.id, issue.id));

  return {
    id: issue.id,
    status: "resolved",
  };
}

async function syncInvoiceToQuickBooks(invoiceId: string, outboxJobId?: string) {
  const syncJob = outboxJobId ? await getSyncJobForOutboxJob(outboxJobId) : null;
  try {
    const { connection, input } = await ensureQuickBooksConnection();
    const { invoice, payload } = await createQuickBooksInvoicePayload(invoiceId);
    const response = await createOrUpdateQuickBooksInvoice({
      connection: input,
      payload,
    });
    const quickBooksInvoice = parseProviderPayload(response.data.Invoice);
    const externalId = String(quickBooksInvoice.Id ?? "");
    if (!externalId) {
      throw new Error("QuickBooks invoice sync returned no Id.");
    }

    await upsertMapping({
      entityType: "invoice",
      internalId: invoice.id,
      externalId,
      payload: quickBooksInvoice,
    });
    await db
      .update(schema.invoices)
      .set({
        quickBooksInvoiceId: externalId,
        updatedAt: now(),
      })
      .where(eq(schema.invoices.id, invoice.id));
    await clearAccountingIssues({
      entityType: "invoice",
      internalEntityId: invoice.id,
    });

    if (outboxJobId) {
      await updateSyncJobForOutbox({
        outboxJobId,
        status: "success",
        payloadPatch: {
          externalInvoiceId: externalId,
        },
      });
    }

    return {
      connectionId: connection.id,
      syncJobId: syncJob?.id ?? null,
      invoiceId: invoice.id,
      externalId,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "QuickBooks invoice sync failed.";
    if (outboxJobId) {
      await updateSyncJobForOutbox({
        outboxJobId,
        status: "failed",
        lastError: message,
      });
    }
    await createAccountingIssue({
      syncJobId: syncJob?.id ?? null,
      entityType: "invoice",
      internalEntityId: invoiceId,
      reasonCode: "invoice_sync_failed",
      summary: "Invoice sync to QuickBooks failed.",
      details: {
        message,
      },
    });
    throw error;
  }
}

async function syncPaymentToQuickBooks(paymentTransactionId: string, outboxJobId?: string) {
  const syncJob = outboxJobId ? await getSyncJobForOutboxJob(outboxJobId) : null;
  try {
    const { connection, input } = await ensureQuickBooksConnection();
    let paymentPayload;
    try {
      paymentPayload = await createQuickBooksPaymentPayload(paymentTransactionId);
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.status === 409
      ) {
        const payment = await db.query.paymentTransactions.findFirst({
          where: (table, { eq: localEq }) => localEq(table.id, paymentTransactionId),
        });
        if (payment?.invoiceId) {
          await syncInvoiceToQuickBooks(payment.invoiceId);
          paymentPayload = await createQuickBooksPaymentPayload(paymentTransactionId);
        } else {
          throw error;
        }
      } else {
        throw error;
      }
    }
    const response = await createQuickBooksPayment({
      connection: input,
      payload: paymentPayload.payload,
    });
    const quickBooksPayment = parseProviderPayload(response.data.Payment);
    const externalId = String(quickBooksPayment.Id ?? "");
    if (!externalId) {
      throw new Error("QuickBooks payment sync returned no Id.");
    }

    await upsertMapping({
      entityType: "payment_transaction",
      internalId: paymentPayload.payment.id,
      externalId,
      payload: quickBooksPayment,
    });
    await db
      .update(schema.paymentTransactions)
      .set({
        externalId,
        payload: {
          ...parseProviderPayload(paymentPayload.payment.payload),
          quickbooks: quickBooksPayment,
        },
      })
      .where(eq(schema.paymentTransactions.id, paymentPayload.payment.id));
    await clearAccountingIssues({
      entityType: "payment_transaction",
      internalEntityId: paymentPayload.payment.id,
    });

    if (outboxJobId) {
      await updateSyncJobForOutbox({
        outboxJobId,
        status: "success",
        payloadPatch: {
          externalPaymentId: externalId,
        },
      });
    }

    return {
      connectionId: connection.id,
      syncJobId: syncJob?.id ?? null,
      paymentTransactionId: paymentPayload.payment.id,
      externalId,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "QuickBooks payment sync failed.";
    if (outboxJobId) {
      await updateSyncJobForOutbox({
        outboxJobId,
        status: "failed",
        lastError: message,
      });
    }
    await createAccountingIssue({
      syncJobId: syncJob?.id ?? null,
      entityType: "payment_transaction",
      internalEntityId: paymentTransactionId,
      reasonCode: "payment_sync_failed",
      summary: "Payment sync to QuickBooks failed.",
      details: {
        message,
      },
    });
    throw error;
  }
}

async function reconcileInvoiceEntity(connection: ConnectionRow, externalInvoiceId: string) {
  const response = await fetchQuickBooksEntity({
    connection: toQuickBooksConnectionInput(connection),
    entityName: "Invoice",
    entityId: externalInvoiceId,
  });
  const invoiceData = parseProviderPayload(response.data.Invoice);
  const mapping = await getMapping({
    entityType: "invoice",
    externalId: externalInvoiceId,
  });

  if (!mapping) {
    await createAccountingIssue({
      connectionId: connection.id,
      entityType: "invoice",
      externalEntityId: externalInvoiceId,
      reasonCode: "unmapped_invoice",
      summary: "QuickBooks referenced an invoice with no internal mapping.",
      details: parseProviderPayload(invoiceData),
    });
    return;
  }

  const invoice = await db.query.invoices.findFirst({
    where: (table, { eq: localEq }) => localEq(table.id, mapping.internalId),
  });
  if (!invoice) {
    await createAccountingIssue({
      connectionId: connection.id,
      entityType: "invoice",
      internalEntityId: mapping.internalId,
      externalEntityId: externalInvoiceId,
      reasonCode: "missing_internal_invoice",
      summary: "QuickBooks invoice maps to a missing internal invoice.",
      details: parseProviderPayload(invoiceData),
    });
    return;
  }

  const balance = numericToNumber(invoiceData.Balance as string | number | null | undefined);
  const total = numericToNumber(invoiceData.TotalAmt as string | number | null | undefined);
  const internalTotal = numericToNumber(
    invoice.totalAmount as string | number | null | undefined,
  );
  const nextStatus =
    balance === 0 && total > 0
      ? "paid"
      : balance > 0 && balance < total
        ? "partially_paid"
        : invoice.status === "draft"
          ? "draft"
          : "sent";

  await db
    .update(schema.invoices)
    .set({
      balanceAmount: balance.toFixed(2),
      status: nextStatus,
      quickBooksInvoiceId: externalInvoiceId,
      updatedAt: now(),
    })
    .where(eq(schema.invoices.id, invoice.id));
  await upsertMapping({
    entityType: "invoice",
    internalId: invoice.id,
    externalId: externalInvoiceId,
    payload: invoiceData,
  });

  if (Math.abs(total - internalTotal) > 0.01) {
    await createAccountingIssue({
      connectionId: connection.id,
      entityType: "invoice",
      internalEntityId: invoice.id,
      externalEntityId: externalInvoiceId,
      reasonCode: "invoice_total_mismatch",
      summary: "QuickBooks invoice total differs from the internal invoice total.",
      details: {
        quickbooksTotal: total,
        internalTotal,
      },
    });
  } else {
    await clearAccountingIssues({
      entityType: "invoice",
      internalEntityId: invoice.id,
      reasonCodes: ["invoice_total_mismatch", "unmapped_invoice"],
    });
  }
}

async function reconcilePaymentEntity(connection: ConnectionRow, externalPaymentId: string) {
  const response = await fetchQuickBooksEntity({
    connection: toQuickBooksConnectionInput(connection),
    entityName: "Payment",
    entityId: externalPaymentId,
  });
  const paymentData = parseProviderPayload(response.data.Payment);
  const mapping = await getMapping({
    entityType: "payment_transaction",
    externalId: externalPaymentId,
  });

  if (!mapping) {
    await createAccountingIssue({
      connectionId: connection.id,
      entityType: "payment_transaction",
      externalEntityId: externalPaymentId,
      reasonCode: "unmapped_payment",
      summary: "QuickBooks referenced a payment with no internal mapping.",
      details: parseProviderPayload(paymentData),
    });
    return;
  }

  const payment = await db.query.paymentTransactions.findFirst({
    where: (table, { eq: localEq }) => localEq(table.id, mapping.internalId),
  });
  if (!payment) {
    await createAccountingIssue({
      connectionId: connection.id,
      entityType: "payment_transaction",
      internalEntityId: mapping.internalId,
      externalEntityId: externalPaymentId,
      reasonCode: "missing_internal_payment",
      summary: "QuickBooks payment maps to a missing internal payment record.",
      details: parseProviderPayload(paymentData),
    });
    return;
  }

  await db
    .update(schema.paymentTransactions)
    .set({
      externalId: externalPaymentId,
      status: "succeeded",
      payload: {
        ...parseProviderPayload(payment.payload),
        quickbooks: paymentData,
      },
    })
    .where(eq(schema.paymentTransactions.id, payment.id));
  await upsertMapping({
    entityType: "payment_transaction",
    internalId: payment.id,
    externalId: externalPaymentId,
    payload: paymentData,
  });
  await clearAccountingIssues({
    entityType: "payment_transaction",
    internalEntityId: payment.id,
  });
}

async function reconcileCustomerEntity(connection: ConnectionRow, externalCustomerId: string) {
  const response = await fetchQuickBooksEntity({
    connection: toQuickBooksConnectionInput(connection),
    entityName: "Customer",
    entityId: externalCustomerId,
  });
  const customerData = parseProviderPayload(response.data.Customer);
  const mapping = await getMapping({
    entityType: "customer",
    externalId: externalCustomerId,
  });

  if (!mapping) {
    await createAccountingIssue({
      connectionId: connection.id,
      entityType: "customer",
      externalEntityId: externalCustomerId,
      reasonCode: "unmapped_customer",
      summary: "QuickBooks referenced a customer with no internal mapping.",
      details: parseProviderPayload(customerData),
    });
    return;
  }

  await upsertMapping({
    entityType: "customer",
    internalId: mapping.internalId,
    externalId: externalCustomerId,
    payload: customerData,
  });
  await clearAccountingIssues({
    entityType: "customer",
    internalEntityId: mapping.internalId,
  });
}

async function reconcileCreditMemoEntity(connection: ConnectionRow, externalCreditMemoId: string) {
  const response = await fetchQuickBooksEntity({
    connection: toQuickBooksConnectionInput(connection),
    entityName: "CreditMemo",
    entityId: externalCreditMemoId,
  });
  await createAccountingIssue({
    connectionId: connection.id,
    entityType: "credit_memo",
    externalEntityId: externalCreditMemoId,
    reasonCode: "credit_memo_review_required",
    summary: "QuickBooks credit memo requires manual accounting review.",
    details: parseProviderPayload(response.data.CreditMemo),
  });
}

export async function processQuickBooksWebhookReceipt(receiptId: string) {
  const receipt = await getWebhookReceipt(receiptId);
  if (!receipt) {
    throw new ApiError(404, "QuickBooks webhook receipt not found.");
  }
  if (!receipt.verified) {
    await markWebhookReceiptIgnored(
      receipt.id,
      receipt.verificationError ?? "QuickBooks webhook was not verified.",
    );
    return {
      receiptId: receipt.id,
      ignored: true,
    };
  }

  const connection = await getActiveQuickBooksConnection();
  if (!connection) {
    await markWebhookReceiptFailed(receipt.id, "QuickBooks is not connected.");
    throw new ApiError(503, "QuickBooks is not connected.");
  }

  const payload = parseProviderPayload(receipt.payload);
  const notifications = Array.isArray(payload.eventNotifications)
    ? payload.eventNotifications
    : [];
  const processedEntities: Array<{ name: string; id: string }> = [];

  try {
    for (const notification of notifications) {
      if (!notification || typeof notification !== "object") {
        continue;
      }
      const realmId = String((notification as JsonRecord).realmId ?? "");
      if (realmId && realmId !== connection.realmId) {
        continue;
      }
      const dataChangeEvent = (notification as JsonRecord).dataChangeEvent;
      const entities =
        dataChangeEvent &&
        typeof dataChangeEvent === "object" &&
        Array.isArray((dataChangeEvent as JsonRecord).entities)
          ? ((dataChangeEvent as JsonRecord).entities as unknown[])
          : [];

      for (const entity of entities) {
        if (!entity || typeof entity !== "object") {
          continue;
        }
        const entityRecord = entity as JsonRecord;
        const name = String(entityRecord.name ?? "");
        const id = String(entityRecord.id ?? "");
        if (!name || !id) {
          continue;
        }

        switch (name) {
          case "Invoice":
            await reconcileInvoiceEntity(connection, id);
            break;
          case "Payment":
            await reconcilePaymentEntity(connection, id);
            break;
          case "Customer":
            await reconcileCustomerEntity(connection, id);
            break;
          case "CreditMemo":
            await reconcileCreditMemoEntity(connection, id);
            break;
          default:
            break;
        }
        processedEntities.push({ name, id });
      }
    }

    await markWebhookReceiptProcessed(receipt.id);
    return {
      receiptId: receipt.id,
      processed: true,
      entities: processedEntities,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "QuickBooks webhook processing failed.";
    await markWebhookReceiptFailed(receipt.id, message);
    throw error;
  }
}

export async function runQuickBooksReconciliation(limit = 25) {
  const connection = await getActiveQuickBooksConnection();
  if (!connection) {
    throw new ApiError(503, "QuickBooks is not connected.");
  }

  const invoiceMappings = await db
    .select()
    .from(schema.externalEntityMappings)
    .where(
      and(
        eq(schema.externalEntityMappings.provider, "quickbooks"),
        eq(schema.externalEntityMappings.entityType, "invoice"),
      ),
    )
    .orderBy(desc(schema.externalEntityMappings.updatedAt))
    .limit(limit);
  for (const mapping of invoiceMappings) {
    await reconcileInvoiceEntity(connection, mapping.externalId);
  }

  const paymentMappings = await db
    .select()
    .from(schema.externalEntityMappings)
    .where(
      and(
        eq(schema.externalEntityMappings.provider, "quickbooks"),
        eq(schema.externalEntityMappings.entityType, "payment_transaction"),
      ),
    )
    .orderBy(desc(schema.externalEntityMappings.updatedAt))
    .limit(limit);
  for (const mapping of paymentMappings) {
    await reconcilePaymentEntity(connection, mapping.externalId);
  }

  return {
    invoicesChecked: invoiceMappings.length,
    paymentsChecked: paymentMappings.length,
  };
}

async function processQuickBooksOutboxJob(job: OutboxJobRow) {
  switch (job.jobType) {
    case "invoice.sync.quickbooks":
      return syncInvoiceToQuickBooks(job.aggregateId, job.id);
    case "payment.sync.quickbooks":
      return syncPaymentToQuickBooks(job.aggregateId, job.id);
    case "webhook.process.quickbooks": {
      const payload = parseProviderPayload(job.payload);
      const receiptId =
        typeof payload.receiptId === "string" ? payload.receiptId : job.aggregateId;
      return processQuickBooksWebhookReceipt(receiptId);
    }
    case "quickbooks.reconcile.poll": {
      const payload = parseProviderPayload(job.payload);
      const limit =
        typeof payload.limit === "number" ? Number(payload.limit) : 25;
      return runQuickBooksReconciliation(limit);
    }
    default:
      throw new ApiError(400, `Unsupported QuickBooks outbox job type: ${job.jobType}`);
  }
}

export async function processPendingQuickBooksJobs(limit = 10, workerId = "quickbooks-worker") {
  const jobs = await claimOutboxJobs({
    workerId,
    limit,
    jobTypes: [
      "invoice.sync.quickbooks",
      "payment.sync.quickbooks",
      "webhook.process.quickbooks",
      "quickbooks.reconcile.poll",
    ],
  });

  const results: Array<Record<string, unknown>> = [];
  for (const job of jobs) {
    try {
      const result = await processQuickBooksOutboxJob(job);
      await markOutboxJobSucceeded(job.id, result as Record<string, unknown>);
      await updateSyncJobForOutbox({
        outboxJobId: job.id,
        status: "success",
        payloadPatch:
          result && typeof result === "object" && !Array.isArray(result)
            ? (result as JsonRecord)
            : {},
      });
      results.push({
        jobId: job.id,
        status: "succeeded",
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "QuickBooks worker job failed.";
      await markOutboxJobFailed(job.id, message);
      await updateSyncJobForOutbox({
        outboxJobId: job.id,
        status: "failed",
        lastError: message,
      });
      results.push({
        jobId: job.id,
        status: "failed",
        error: message,
      });
    }
  }

  return results;
}

export async function replayQuickBooksJob(jobId: string) {
  const job = await getOutboxJob(jobId);
  if (!job || job.provider !== "quickbooks") {
    throw new ApiError(404, "QuickBooks job not found.");
  }

  const [replayed] = await db
    .update(schema.outboxJobs)
    .set({
      status: "pending",
      lockedBy: null,
      startedAt: null,
      finishedAt: null,
      lastError: null,
      availableAt: now(),
      deadLetteredAt: null,
      deadLetterReason: null,
    })
    .where(eq(schema.outboxJobs.id, jobId))
    .returning();
  if (!replayed) {
    throw new ApiError(404, "QuickBooks job not found.");
  }

  await updateSyncJobForOutbox({
    outboxJobId: jobId,
    status: "pending",
    lastError: null,
  });

  return {
    id: jobId,
    status: "pending" as const,
  };
}

export async function getQuickBooksStatus() {
  const [connections, pendingJobs, issues] = await Promise.all([
    listQuickBooksConnections(),
    listPendingOutboxJobs([
      "invoice.sync.quickbooks",
      "payment.sync.quickbooks",
      "webhook.process.quickbooks",
      "quickbooks.reconcile.poll",
    ]),
    listAccountingSyncIssues({ status: "open" }),
  ]);

  return {
    connected: connections.some((connection) => connection.status === "active"),
    environment: getQuickBooksRuntimeEnvironment(),
    connections,
    pendingJobCount: pendingJobs.filter((job) => job.provider === "quickbooks").length,
    openIssueCount: issues.length,
  };
}

export async function verifyAndStoreQuickBooksWebhook(options: {
  body: string;
  signature: string | null;
  headers: Record<string, unknown>;
  payload: Record<string, unknown>;
  externalEventId?: string | null;
}) {
  const verification = verifyQuickBooksWebhookSignature({
    body: options.body,
    signature: options.signature,
  });
  const receiptId = await recordWebhookReceipt({
    provider: "quickbooks",
    signature: options.signature,
    externalEventId: options.externalEventId ?? null,
    headers: options.headers,
    payload: options.payload,
    verified: verification.verified,
    verificationError: verification.reason,
  });

  if (receiptId) {
    await enqueueOutboxJob({
      jobType: "webhook.process.quickbooks",
      aggregateType: "webhook_receipt",
      aggregateId: receiptId,
      provider: "quickbooks",
      payload: {
        receiptId,
        externalEventId: options.externalEventId ?? null,
      },
    });
  }

  return {
    receiptId,
    verified: verification.verified,
    verificationError: verification.reason,
  };
}

export async function enqueueQuickBooksReconciliation(limit = 25) {
  const connection = await getActiveQuickBooksConnection();
  return enqueueOutboxJob({
    jobType: "quickbooks.reconcile.poll",
    aggregateType: "quickbooks_connection",
    aggregateId: connection?.id ?? "unbound",
    provider: "quickbooks",
    payload: {
      limit,
    },
  });
}

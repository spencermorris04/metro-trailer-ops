import { createHash, createHmac } from "node:crypto";

import Stripe from "stripe";

import type {
  CollectionCaseRecord,
  DocumentRecord,
  PaymentMethodRecord,
  SignatureRequestRecord,
  TelematicsRecord,
} from "@/lib/platform-types";
import type { FinancialEventRecord, InvoiceRecord } from "@/lib/domain/models";
import { ApiError } from "@/lib/server/api";
import { isProductionRuntime } from "@/lib/server/runtime";

export interface IntegrationResult<T> {
  mode: "live" | "demo";
  provider: string;
  data: T;
}

export type QuickBooksEnvironment = "sandbox" | "production";

export interface QuickBooksTokenSet {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  scopes: string[];
  accessTokenExpiresAt: Date | null;
  refreshTokenExpiresAt: Date | null;
  raw: Record<string, unknown>;
}

export interface QuickBooksConnectionInput {
  realmId: string;
  accessToken: string;
  refreshToken?: string | null;
  environment?: QuickBooksEnvironment;
}

export interface QuickBooksInvoicePayload {
  sparse?: boolean;
  Id?: string;
  SyncToken?: string;
  DocNumber: string;
  TxnDate: string;
  DueDate: string;
  CustomerRef: {
    value: string;
    name?: string;
  };
  Line: Array<Record<string, unknown>>;
  BillEmail?: {
    Address: string;
  };
  CustomerMemo?: {
    value: string;
  };
  PrivateNote?: string;
}

export interface QuickBooksPaymentPayload {
  TotalAmt: number;
  TxnDate: string;
  CustomerRef: {
    value: string;
    name?: string;
  };
  PrivateNote?: string;
  PaymentMethodRef?: {
    value: string;
    name?: string;
  };
  Line?: Array<Record<string, unknown>>;
}

function buildHash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function getQuickBooksEnvironment(): QuickBooksEnvironment {
  return process.env.QUICKBOOKS_ENVIRONMENT?.trim().toLowerCase() === "production"
    ? "production"
    : "sandbox";
}

function getQuickBooksClientConfig() {
  const clientId = process.env.QUICKBOOKS_CLIENT_ID?.trim();
  const clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET?.trim();
  const redirectUri = process.env.QUICKBOOKS_REDIRECT_URI?.trim();
  const environment = getQuickBooksEnvironment();

  if (!clientId || !clientSecret || !redirectUri) {
    return null;
  }

  return {
    clientId,
    clientSecret,
    redirectUri,
    environment,
    authBaseUrl: "https://appcenter.intuit.com/connect/oauth2",
    tokenUrl: "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer",
    revokeUrl: "https://developer.api.intuit.com/v2/oauth2/tokens/revoke",
    apiBaseUrl:
      environment === "production"
        ? "https://quickbooks.api.intuit.com"
        : "https://sandbox-quickbooks.api.intuit.com",
  };
}

function getQuickBooksMinorVersion() {
  return process.env.QUICKBOOKS_MINOR_VERSION?.trim() || "75";
}

function getQuickBooksBasicAuth(config: NonNullable<ReturnType<typeof getQuickBooksClientConfig>>) {
  return Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64");
}

async function parseQuickBooksResponse(response: Response) {
  const text = await response.text();
  const data =
    text.length > 0 ? (JSON.parse(text) as Record<string, unknown>) : ({} as Record<string, unknown>);

  if (!response.ok) {
    const fault = data.Fault;
    throw new Error(
      typeof fault === "object" && fault
        ? JSON.stringify(fault)
        : `QuickBooks request failed with status ${response.status}.`,
    );
  }

  return data;
}

function computeExpiryDate(seconds: unknown) {
  if (typeof seconds !== "number" || !Number.isFinite(seconds)) {
    return null;
  }

  return new Date(Date.now() + seconds * 1000);
}

export function createQuickBooksAuthorizationUrl(options?: {
  state?: string;
  scopes?: string[];
  redirectUri?: string;
}) {
  const config = getQuickBooksClientConfig();

  if (!config) {
    return null;
  }

  const url = new URL(config.authBaseUrl);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", options?.redirectUri ?? config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set(
    "scope",
    (options?.scopes ?? ["com.intuit.quickbooks.accounting"]).join(" "),
  );
  if (options?.state) {
    url.searchParams.set("state", options.state);
  }

  return {
    mode: "live",
    provider: "QuickBooks",
    data: {
      url: url.toString(),
      environment: config.environment,
    },
  } satisfies IntegrationResult<{ url: string; environment: QuickBooksEnvironment }>;
}

export async function exchangeQuickBooksAuthorizationCode(options: {
  code: string;
  redirectUri?: string;
}) {
  const config = getQuickBooksClientConfig();
  if (!config) {
    throw new Error(
      "QuickBooks client credentials are not configured. Set QUICKBOOKS_CLIENT_ID, QUICKBOOKS_CLIENT_SECRET, and QUICKBOOKS_REDIRECT_URI.",
    );
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: options.code,
    redirect_uri: options.redirectUri ?? config.redirectUri,
  });

  const response = await fetch(config.tokenUrl, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Basic ${getQuickBooksBasicAuth(config)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const data = await parseQuickBooksResponse(response);
  return {
    mode: "live",
    provider: "QuickBooks",
    data: {
      accessToken: String(data.access_token ?? ""),
      refreshToken: String(data.refresh_token ?? ""),
      tokenType: String(data.token_type ?? "Bearer"),
      scopes:
        typeof data.x_refresh_token_expires_in === "number" || typeof data.scope === "string"
          ? String(data.scope ?? "")
              .split(" ")
              .filter(Boolean)
          : [],
      accessTokenExpiresAt: computeExpiryDate(data.expires_in),
      refreshTokenExpiresAt: computeExpiryDate(data.x_refresh_token_expires_in),
      raw: data,
    } satisfies QuickBooksTokenSet,
  } satisfies IntegrationResult<QuickBooksTokenSet>;
}

export async function refreshQuickBooksAccessToken(options: { refreshToken: string }) {
  const config = getQuickBooksClientConfig();
  if (!config) {
    throw new Error("QuickBooks client credentials are not configured.");
  }

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: options.refreshToken,
  });

  const response = await fetch(config.tokenUrl, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Basic ${getQuickBooksBasicAuth(config)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const data = await parseQuickBooksResponse(response);
  return {
    mode: "live",
    provider: "QuickBooks",
    data: {
      accessToken: String(data.access_token ?? ""),
      refreshToken: String(data.refresh_token ?? options.refreshToken),
      tokenType: String(data.token_type ?? "Bearer"),
      scopes: String(data.scope ?? "")
        .split(" ")
        .filter(Boolean),
      accessTokenExpiresAt: computeExpiryDate(data.expires_in),
      refreshTokenExpiresAt: computeExpiryDate(data.x_refresh_token_expires_in),
      raw: data,
    } satisfies QuickBooksTokenSet,
  } satisfies IntegrationResult<QuickBooksTokenSet>;
}

export async function revokeQuickBooksToken(options: { refreshToken: string }) {
  const config = getQuickBooksClientConfig();
  if (!config) {
    return {
      mode: "demo",
      provider: "QuickBooks",
      data: {
        revoked: false,
      },
    } satisfies IntegrationResult<{ revoked: boolean }>;
  }

  const response = await fetch(config.revokeUrl, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Basic ${getQuickBooksBasicAuth(config)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      token: options.refreshToken,
    }),
  });

  if (!response.ok && response.status !== 200) {
    const body = await response.text();
    throw new Error(
      body.length > 0
        ? `QuickBooks token revoke failed: ${body}`
        : `QuickBooks token revoke failed with status ${response.status}.`,
    );
  }

  return {
    mode: "live",
    provider: "QuickBooks",
    data: {
      revoked: true,
    },
  } satisfies IntegrationResult<{ revoked: boolean }>;
}

async function quickBooksApiRequest<TData extends Record<string, unknown>>(options: {
  connection: QuickBooksConnectionInput;
  path: string;
  method?: "GET" | "POST";
  body?: Record<string, unknown>;
  query?: Record<string, string | number | undefined>;
}) {
  const config = getQuickBooksClientConfig();
  if (!config) {
    throw new Error("QuickBooks client credentials are not configured.");
  }

  const environment = options.connection.environment ?? config.environment;
  const apiBaseUrl =
    environment === "production"
      ? "https://quickbooks.api.intuit.com"
      : "https://sandbox-quickbooks.api.intuit.com";
  const url = new URL(
    `/v3/company/${encodeURIComponent(options.connection.realmId)}${options.path}`,
    apiBaseUrl,
  );
  url.searchParams.set("minorversion", getQuickBooksMinorVersion());
  Object.entries(options.query ?? {}).forEach(([key, value]) => {
    if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  });

  const response = await fetch(url, {
    method: options.method ?? "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${options.connection.accessToken}`,
      "Content-Type": "application/json",
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  return {
    mode: "live",
    provider: "QuickBooks",
    data: (await parseQuickBooksResponse(response)) as TData,
  } satisfies IntegrationResult<TData>;
}

export async function fetchQuickBooksCompanyInfo(connection: QuickBooksConnectionInput) {
  return quickBooksApiRequest<{
    CompanyInfo?: Record<string, unknown>;
    time?: string;
  }>({
    connection,
    path: `/companyinfo/${encodeURIComponent(connection.realmId)}`,
  });
}

export async function createQuickBooksCustomer(options: {
  connection: QuickBooksConnectionInput;
  payload: Record<string, unknown>;
}) {
  return quickBooksApiRequest<{
    Customer?: Record<string, unknown>;
    time?: string;
  }>({
    connection: options.connection,
    method: "POST",
    path: "/customer",
    body: options.payload,
  });
}

export async function createOrUpdateQuickBooksInvoice(options: {
  connection: QuickBooksConnectionInput;
  payload: QuickBooksInvoicePayload;
}) {
  return quickBooksApiRequest<{
    Invoice?: Record<string, unknown>;
    time?: string;
  }>({
    connection: options.connection,
    method: "POST",
    path: "/invoice",
    body: options.payload as unknown as Record<string, unknown>,
  });
}

export async function createQuickBooksPayment(options: {
  connection: QuickBooksConnectionInput;
  payload: QuickBooksPaymentPayload;
}) {
  return quickBooksApiRequest<{
    Payment?: Record<string, unknown>;
    time?: string;
  }>({
    connection: options.connection,
    method: "POST",
    path: "/payment",
    body: options.payload as unknown as Record<string, unknown>,
  });
}

export async function fetchQuickBooksEntity(options: {
  connection: QuickBooksConnectionInput;
  entityName: "Invoice" | "Payment" | "Customer" | "CreditMemo";
  entityId: string;
}) {
  return quickBooksApiRequest<Record<string, Record<string, unknown>>>({
    connection: options.connection,
    path: `/${options.entityName.toLowerCase()}/${encodeURIComponent(options.entityId)}`,
  });
}

export async function queryQuickBooksEntities(options: {
  connection: QuickBooksConnectionInput;
  query: string;
}) {
  return quickBooksApiRequest<Record<string, unknown>>({
    connection: options.connection,
    path: "/query",
    query: {
      query: options.query,
    },
  });
}

export function verifyQuickBooksWebhookSignature(options: {
  body: string;
  signature: string | null;
}) {
  const verifierToken = process.env.QUICKBOOKS_WEBHOOK_VERIFIER_TOKEN?.trim();
  if (!verifierToken) {
    return {
      verified: false,
      reason: "QUICKBOOKS_WEBHOOK_VERIFIER_TOKEN is not configured.",
    };
  }

  if (!options.signature) {
    return {
      verified: false,
      reason: "Missing intuit-signature header.",
    };
  }

  const expected = createHmac("sha256", verifierToken)
    .update(options.body, "utf8")
    .digest("base64");
  return {
    verified: expected === options.signature,
    reason: expected === options.signature ? null : "Webhook signature mismatch.",
  };
}

export function getStripeClient() {
  const apiKey = process.env.STRIPE_SECRET_KEY?.trim();

  if (!apiKey) {
    return null;
  }

  return new Stripe(apiKey, {
    apiVersion: "2026-03-25.dahlia",
  });
}

export function requireStripeClient() {
  const stripe = getStripeClient();

  if (!stripe) {
    throw new ApiError(503, "Stripe is not configured for the current runtime.");
  }

  return stripe;
}

function allowStripeDemoFallback() {
  return !isProductionRuntime();
}

function getStripeClientOrThrow() {
  const stripe = getStripeClient();

  if (stripe) {
    return stripe;
  }

  if (allowStripeDemoFallback()) {
    return null;
  }

  throw new ApiError(
    503,
    "Stripe credentials are required when Metro Trailer runs in production mode.",
  );
}

export async function ensureStripeCustomer(options: {
  stripeCustomerId?: string | null;
  customerNumber: string;
  customerName: string;
  email?: string | null;
}) {
  const stripe = getStripeClientOrThrow();

  if (!stripe) {
    return {
      mode: "demo",
      provider: "Stripe",
      data: {
        customerId: `cus_demo_${options.customerNumber}`,
      },
    } satisfies IntegrationResult<{
      customerId: string;
    }>;
  }

  if (options.stripeCustomerId) {
    return {
      mode: "live",
      provider: "Stripe",
      data: {
        customerId: options.stripeCustomerId,
      },
    } satisfies IntegrationResult<{
      customerId: string;
    }>;
  }

  const customer = await stripe.customers.create({
    name: options.customerName,
    email: options.email ?? undefined,
    metadata: {
      customerNumber: options.customerNumber,
    },
  });

  return {
    mode: "live",
    provider: "Stripe",
    data: {
      customerId: customer.id,
    },
  } satisfies IntegrationResult<{
    customerId: string;
  }>;
}

export async function createStripePaymentIntent(options: {
  invoice: InvoiceRecord;
  customerName: string;
  customerNumber?: string;
  stripeCustomerId?: string | null;
  stripePaymentMethodId?: string | null;
}) {
  const stripe = getStripeClientOrThrow();

  if (!stripe) {
    return {
      mode: "demo",
      provider: "Stripe",
      data: {
        paymentIntentId: `pi_demo_${options.invoice.invoiceNumber}`,
        clientSecret: `pi_demo_${options.invoice.invoiceNumber}_secret`,
        amount: Math.round(options.invoice.balanceAmount * 100),
        currency: "usd",
      },
    } satisfies IntegrationResult<{
      paymentIntentId: string;
      clientSecret: string;
      amount: number;
      currency: string;
    }>;
  }

  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(options.invoice.balanceAmount * 100),
    currency: "usd",
    description: `Metro Trailer invoice ${options.invoice.invoiceNumber}`,
    customer: options.stripeCustomerId ?? undefined,
    payment_method: options.stripePaymentMethodId ?? undefined,
    metadata: {
      invoiceId: options.invoice.id,
      invoiceNumber: options.invoice.invoiceNumber,
      customerName: options.customerName,
      customerNumber: options.customerNumber ?? "",
    },
    automatic_payment_methods: options.stripePaymentMethodId
      ? undefined
      : {
          enabled: true,
        },
  });

  return {
    mode: "live",
    provider: "Stripe",
    data: {
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
    },
  } satisfies IntegrationResult<{
    paymentIntentId: string;
    clientSecret: string | null;
    amount: number;
    currency: string;
  }>;
}

export async function createStripePortalSession(options: {
  customerName: string;
  returnUrl: string;
  stripeCustomerId?: string | null;
}) {
  const stripe = getStripeClientOrThrow();

  if (!stripe) {
    return {
      mode: "demo",
      provider: "Stripe",
      data: {
        url: `${options.returnUrl}?portal=demo&customer=${encodeURIComponent(options.customerName)}`,
      },
    } satisfies IntegrationResult<{ url: string }>;
  }

  if (!options.stripeCustomerId) {
    throw new ApiError(
      400,
      "A Stripe customer ID is required to open the billing portal.",
    );
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: options.stripeCustomerId,
    return_url: options.returnUrl,
  });

  return {
    mode: "live",
    provider: "Stripe",
    data: {
      url: session.url,
    },
  } satisfies IntegrationResult<{ url: string }>;
}

export async function createStripeSetupIntent(options: {
  stripeCustomerId: string;
  customerNumber: string;
}) {
  const stripe = getStripeClientOrThrow();

  if (!stripe) {
    return {
      mode: "demo",
      provider: "Stripe",
      data: {
        setupIntentId: `seti_demo_${options.customerNumber}`,
        clientSecret: `seti_demo_${options.customerNumber}_secret`,
      },
    } satisfies IntegrationResult<{
      setupIntentId: string;
      clientSecret: string | null;
    }>;
  }

  const setupIntent = await stripe.setupIntents.create({
    customer: options.stripeCustomerId,
    payment_method_types: ["card", "us_bank_account"],
    usage: "off_session",
    metadata: {
      customerNumber: options.customerNumber,
    },
  });

  return {
    mode: "live",
    provider: "Stripe",
    data: {
      setupIntentId: setupIntent.id,
      clientSecret: setupIntent.client_secret,
    },
  } satisfies IntegrationResult<{
    setupIntentId: string;
    clientSecret: string | null;
  }>;
}

export async function retrieveStripePaymentMethod(paymentMethodId: string) {
  const stripe = getStripeClientOrThrow();

  if (!stripe) {
    return {
      mode: "demo",
      provider: "Stripe",
      data: {
        id: paymentMethodId,
        type: "card",
        card: {
          brand: "visa",
          last4: "4242",
        },
      },
    } satisfies IntegrationResult<{
      id: string;
      type: string;
      card?: {
        brand: string;
        last4: string;
      };
    }>;
  }

  const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);

  if ("deleted" in paymentMethod) {
    throw new ApiError(404, `Stripe payment method ${paymentMethodId} was deleted.`);
  }

  return {
    mode: "live",
    provider: "Stripe",
    data: paymentMethod,
  } satisfies IntegrationResult<Stripe.PaymentMethod>;
}

export async function attachStripePaymentMethod(options: {
  stripeCustomerId: string;
  paymentMethodId: string;
  makeDefault?: boolean;
}) {
  const stripe = getStripeClientOrThrow();

  if (!stripe) {
    return {
      mode: "demo",
      provider: "Stripe",
      data: {
        id: options.paymentMethodId,
        type: "card",
      },
    } satisfies IntegrationResult<{
      id: string;
      type: string;
    }>;
  }

  const existing = await stripe.paymentMethods.retrieve(options.paymentMethodId);
  if ("deleted" in existing) {
    throw new ApiError(
      404,
      `Stripe payment method ${options.paymentMethodId} was deleted.`,
    );
  }

  const paymentMethod =
    existing.customer === options.stripeCustomerId
      ? existing
      : await stripe.paymentMethods.attach(options.paymentMethodId, {
          customer: options.stripeCustomerId,
        });

  if (options.makeDefault) {
    await stripe.customers.update(options.stripeCustomerId, {
      invoice_settings: {
        default_payment_method: paymentMethod.id,
      },
    });
  }

  return {
    mode: "live",
    provider: "Stripe",
    data: paymentMethod,
  } satisfies IntegrationResult<Stripe.PaymentMethod>;
}

export async function createStripeRefund(options: {
  paymentIntentId?: string | null;
  chargeId?: string | null;
  amountCents?: number;
  reason?: Stripe.RefundCreateParams.Reason;
  metadata?: Record<string, string>;
}) {
  const stripe = getStripeClientOrThrow();

  if (!stripe) {
    return {
      mode: "demo",
      provider: "Stripe",
      data: {
        refundId: `re_demo_${Date.now()}`,
        amount: options.amountCents ?? 0,
        status: "succeeded",
      },
    } satisfies IntegrationResult<{
      refundId: string;
      amount: number;
      status: string;
    }>;
  }

  const refund = await stripe.refunds.create({
    payment_intent: options.paymentIntentId ?? undefined,
    charge: options.chargeId ?? undefined,
    amount: options.amountCents,
    reason: options.reason,
    metadata: options.metadata,
  });

  return {
    mode: "live",
    provider: "Stripe",
    data: {
      refundId: refund.id,
      amount: refund.amount,
      status: refund.status ?? "pending",
    },
  } satisfies IntegrationResult<{
    refundId: string;
    amount: number;
    status: string;
  }>;
}

export async function buildQuickBooksInvoiceSync(invoice: InvoiceRecord) {
  return {
    mode: "demo",
    provider: "QuickBooks",
    data: {
      requestId: `qb_${invoice.invoiceNumber}`,
      payload: {
        DocNumber: invoice.invoiceNumber,
        TxnDate: invoice.invoiceDate,
        DueDate: invoice.dueDate,
        Balance: invoice.balanceAmount,
      },
    },
  } satisfies IntegrationResult<{
    requestId: string;
    payload: Record<string, string | number>;
  }>;
}

export async function buildQuickBooksPaymentSync(invoice: InvoiceRecord) {
  return {
    mode: "demo",
    provider: "QuickBooks",
    data: {
      requestId: `qb_payment_${invoice.invoiceNumber}`,
      payload: {
        invoiceNumber: invoice.invoiceNumber,
        balanceAmount: invoice.balanceAmount,
        status: invoice.status,
      },
    },
  } satisfies IntegrationResult<{
    requestId: string;
    payload: Record<string, string | number>;
  }>;
}

export async function buildRecord360InspectionRequest(options: {
  assetNumber: string;
  contractNumber: string;
  inspectionType: string;
  customerSite?: string | null;
  externalUnitId?: string | null;
}) {
  const apiBaseUrl = process.env.RECORD360_API_BASE_URL?.trim();
  const apiKey = process.env.RECORD360_API_KEY?.trim();
  const inspectionPath =
    process.env.RECORD360_INSPECTION_REQUEST_PATH?.trim() ?? "/inspections";

  if (apiBaseUrl && apiKey) {
    const response = await fetch(new URL(inspectionPath, apiBaseUrl), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        unitNumber: options.assetNumber,
        unitId: options.externalUnitId ?? undefined,
        contractNumber: options.contractNumber,
        inspectionType: options.inspectionType,
        customerSite: options.customerSite ?? undefined,
      }),
    });

    const data =
      response.status === 204
        ? {}
        : ((await response.json()) as Record<string, unknown>);
    if (!response.ok) {
      throw new ApiError(
        response.status,
        "Record360 inspection request failed.",
        data,
      );
    }

    return {
      mode: "live",
      provider: "Record360",
      data: {
        requestId:
          typeof data.id === "string"
            ? data.id
            : typeof data.inspectionId === "string"
              ? data.inspectionId
              : `r360_${options.assetNumber}_${options.inspectionType}`,
        unitNumber:
          typeof data.unitNumber === "string" ? data.unitNumber : options.assetNumber,
        contractNumber:
          typeof data.contractNumber === "string"
            ? data.contractNumber
            : options.contractNumber,
        inspectionType:
          typeof data.inspectionType === "string"
            ? data.inspectionType
            : options.inspectionType,
        externalUnitId:
          typeof data.unitId === "string" ? data.unitId : options.externalUnitId ?? null,
        payload: data,
      },
    } satisfies IntegrationResult<{
      requestId: string;
      unitNumber: string;
      contractNumber: string;
      inspectionType: string;
      externalUnitId: string | null;
      payload: Record<string, unknown>;
    }>;
  }

  if (isProductionRuntime()) {
    throw new ApiError(
      503,
      "Record360 API credentials are required in production mode.",
    );
  }

  return {
    mode: "demo",
    provider: "Record360",
    data: {
      requestId: `r360_${options.assetNumber}_${options.inspectionType}`,
      unitNumber: options.assetNumber,
      contractNumber: options.contractNumber,
      inspectionType: options.inspectionType,
      externalUnitId: options.externalUnitId ?? null,
      payload: {
        customerSite: options.customerSite ?? null,
      },
    },
  } satisfies IntegrationResult<{
    requestId: string;
    unitNumber: string;
    contractNumber: string;
    inspectionType: string;
    externalUnitId: string | null;
    payload: Record<string, unknown>;
  }>;
}

export async function buildRecord360UnitSync(options: {
  assetNumber: string;
  assetType: string;
  status: string;
  branchName?: string | null;
  externalUnitId?: string | null;
  dimensions?: Record<string, unknown> | null;
  features?: string[] | null;
  serialNumber?: string | null;
  gpsDeviceId?: string | null;
}) {
  const apiBaseUrl = process.env.RECORD360_API_BASE_URL?.trim();
  const apiKey = process.env.RECORD360_API_KEY?.trim();
  const unitPath = process.env.RECORD360_UNIT_SYNC_PATH?.trim() ?? "/units";

  if (apiBaseUrl && apiKey) {
    const response = await fetch(new URL(unitPath, apiBaseUrl), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        unitId: options.externalUnitId ?? undefined,
        unitNumber: options.assetNumber,
        assetType: options.assetType,
        status: options.status,
        branchName: options.branchName ?? undefined,
        dimensions: options.dimensions ?? undefined,
        features: options.features ?? undefined,
        serialNumber: options.serialNumber ?? undefined,
        gpsDeviceId: options.gpsDeviceId ?? undefined,
      }),
    });

    const data =
      response.status === 204
        ? {}
        : ((await response.json()) as Record<string, unknown>);
    if (!response.ok) {
      throw new ApiError(response.status, "Record360 unit sync failed.", data);
    }

    return {
      mode: "live",
      provider: "Record360",
      data: {
        requestId:
          typeof data.requestId === "string"
            ? data.requestId
            : `r360_unit_${options.assetNumber}`,
        unitId:
          typeof data.id === "string"
            ? data.id
            : typeof data.unitId === "string"
              ? data.unitId
              : options.externalUnitId ?? options.assetNumber,
        payload: data,
      },
    } satisfies IntegrationResult<{
      requestId: string;
      unitId: string;
      payload: Record<string, unknown>;
    }>;
  }

  if (isProductionRuntime()) {
    throw new ApiError(
      503,
      "Record360 API credentials are required in production mode.",
    );
  }

  return {
    mode: "demo",
    provider: "Record360",
    data: {
      requestId: `r360_unit_${options.assetNumber}`,
      unitId: options.externalUnitId ?? options.assetNumber,
      payload: {
        branchName: options.branchName ?? null,
      },
    },
  } satisfies IntegrationResult<{
    requestId: string;
    unitId: string;
    payload: Record<string, unknown>;
  }>;
}

export function extractRecord360InspectionResult(payload: Record<string, unknown>): {
  externalInspectionId: string | null;
  externalUnitId: string | null;
  assetNumber: string | null;
  contractNumber: string | null;
  inspectionType: string | null;
  status: "passed" | "failed" | "needs_review";
  damageSummary: string;
  damageScore: number | null;
  photos: string[];
  media: Array<Record<string, unknown>>;
  payload: Record<string, unknown>;
} {
  const statusSource =
    typeof payload.status === "string"
      ? payload.status
      : typeof payload.result === "string"
        ? payload.result
        : typeof payload.outcome === "string"
          ? payload.outcome
          : typeof payload.passed === "boolean"
            ? payload.passed
              ? "passed"
              : "failed"
            : "needs_review";

  const normalizedStatus = statusSource.trim().toLowerCase().replace(/[\s-]+/g, "_");
  const rawMedia = Array.isArray(payload.media)
    ? payload.media
    : Array.isArray(payload.photos)
      ? payload.photos
      : [];
  const media = rawMedia.filter(
    (entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object",
  );
  const photos = rawMedia
    .map((entry) => {
      if (typeof entry === "string") {
        return entry;
      }

      if (entry && typeof entry === "object") {
        const record = entry as Record<string, unknown>;

        if (typeof record.url === "string") {
          return record.url;
        }

        if (typeof record.photoUrl === "string") {
          return record.photoUrl;
        }
      }

      return null;
    })
    .filter((value): value is string => Boolean(value));

  const externalInspectionId =
    typeof payload.inspectionId === "string"
      ? payload.inspectionId
      : typeof payload.id === "string"
        ? payload.id
        : null;
  const externalUnitId =
    typeof payload.unitId === "string"
      ? payload.unitId
      : typeof payload.assetId === "string"
        ? payload.assetId
        : null;
  const assetNumber =
    typeof payload.unitNumber === "string"
      ? payload.unitNumber
      : typeof payload.assetNumber === "string"
        ? payload.assetNumber
        : null;
  const contractNumber =
    typeof payload.contractNumber === "string" ? payload.contractNumber : null;
  const inspectionType =
    typeof payload.inspectionType === "string" ? payload.inspectionType : null;
  const damageSummary =
    typeof payload.damageSummary === "string"
      ? payload.damageSummary
      : typeof payload.summary === "string"
        ? payload.summary
        : typeof payload.notes === "string"
          ? payload.notes
          : "Record360 inspection result received.";
  const damageScore =
    typeof payload.damageScore === "number"
      ? payload.damageScore
      : typeof payload.score === "number"
        ? payload.score
        : null;

  return {
    externalInspectionId,
    externalUnitId,
    assetNumber,
    contractNumber,
    inspectionType,
    status:
      normalizedStatus === "passed"
        ? "passed"
        : normalizedStatus === "failed"
          ? "failed"
          : "needs_review",
    damageSummary,
    damageScore,
    photos,
    media,
    payload,
  };
}

export async function buildSkyBitzSync(assetNumber: string) {
  return {
    mode: "demo",
    provider: "SkyBitz",
    data: {
      requestId: `sky_${assetNumber}`,
      assetNumber,
    },
  } satisfies IntegrationResult<{ requestId: string; assetNumber: string }>;
}

export async function buildCollectionsReminder(caseRecord: CollectionCaseRecord) {
  return {
    mode: "demo",
    provider: "Internal",
    data: {
      reminderId: `reminder_${caseRecord.invoiceNumber}`,
      subject: `Payment reminder for ${caseRecord.invoiceNumber}`,
      body: `A reminder has been prepared for ${caseRecord.customerName} regarding balance ${caseRecord.balanceAmount}.`,
    },
  } satisfies IntegrationResult<{
    reminderId: string;
    subject: string;
    body: string;
  }>;
}

export async function buildDocumentRecord(options: {
  contractNumber: string;
  customerName: string;
  documentType: string;
  filename: string;
}) {
  const createdAt = new Date().toISOString();
  const content = Buffer.from(
    `Metro Trailer internal document for ${options.contractNumber}.`,
    "utf8",
  );

  return {
    mode: "demo",
    provider: "Internal",
    data: {
      id: `doc_${Math.random().toString(36).slice(2, 10)}`,
      contractNumber: options.contractNumber,
      customerName: options.customerName,
      documentType: options.documentType,
      status: "draft",
      filename: options.filename,
      objectLocked: true,
      lockedAt: createdAt,
      source: "internal_esign",
      hash: buildHash(`${options.contractNumber}:${options.filename}:${createdAt}`),
      createdAt,
      contentType: "application/pdf",
      sizeBytes: content.byteLength,
      contentBase64: content.toString("base64"),
      storageProvider: "inline",
      storageBucket: null,
      storageKey: null,
      storageVersionId: null,
      storageETag: null,
      retentionUntil: null,
      relatedSignatureRequestId: null,
      supersedesDocumentId: null,
      retentionMode: "compliance",
      metadata: {},
    } satisfies DocumentRecord,
  } satisfies IntegrationResult<DocumentRecord>;
}

export async function buildSignatureRequest(options: {
  contractNumber: string;
  customerName: string;
  signers: string[];
}) {
  const requestedAt = new Date().toISOString();

  return {
    mode: "demo",
    provider: "Metro Trailer",
    data: {
      id: `sig_${Math.random().toString(36).slice(2, 10)}`,
      contractNumber: options.contractNumber,
      customerName: options.customerName,
      provider: "Metro Trailer",
      status: "sent",
      title: `${options.contractNumber} rental agreement`,
      subject: "Please sign your Metro Trailer rental agreement",
      message:
        "This request was generated in demo mode. The bespoke e-sign service owns the production workflow.",
      consentTextVersion: "metro-esign-consent-v1",
      certificationText:
        "By signing electronically, you confirm your authority and intent to sign.",
      documentId: `doc_${Math.random().toString(36).slice(2, 10)}`,
      finalDocumentId: null,
      certificateDocumentId: null,
      signingFields: [],
      expiresAt: null,
      cancelledAt: null,
      signers: options.signers.map((email, index) => ({
        id: `signer_${Math.random().toString(36).slice(2, 10)}`,
        name: email.split("@")[0] ?? email,
        email,
        title: null,
        routingOrder: index + 1,
        status: "pending",
        requestedAt,
        viewedAt: null,
        signedAt: null,
        declinedAt: null,
        reminderCount: 0,
        lastReminderAt: null,
        accessNonce: `nonce_${Math.random().toString(36).slice(2, 10)}`,
        signatureText: null,
        signatureMode: null,
        signatureAppearanceDataUrl: null,
        signatureAppearanceHash: null,
        intentAcceptedAt: null,
        consentAcceptedAt: null,
        certificationAcceptedAt: null,
        otpVerifiedAt: null,
        ipAddress: null,
        userAgent: null,
        evidenceHash: null,
      })),
      events: [],
      evidenceHash: null,
      requestedAt,
      completedAt: null,
    } satisfies SignatureRequestRecord,
  } satisfies IntegrationResult<SignatureRequestRecord>;
}

export async function buildTelematicsRecoverySnapshot(options: {
  assetNumber: string;
  lastKnown?: TelematicsRecord;
  branchName?: string | null;
  customerName?: string | null;
  openInvoices?: Array<{
    invoiceNumber: string;
    balanceAmount: number;
    dueDate: string;
    status: string;
  }>;
  promisedPaymentDate?: string | null;
  totalOverdueBalance?: number;
  stale?: boolean;
  nextAction?: string;
}) {
  const openInvoices = options.openInvoices ?? [];
  const stale =
    options.stale ??
    (options.lastKnown ? options.lastKnown.stale ?? false : true);
  const totalOverdueBalance =
    options.totalOverdueBalance ??
    openInvoices.reduce((sum, invoice) => sum + invoice.balanceAmount, 0);

  return {
    mode: "demo",
    provider: "SkyBitz",
    data: {
      assetNumber: options.assetNumber,
      lastKnown: options.lastKnown ?? null,
      branchName: options.branchName ?? null,
      customerName: options.customerName ?? null,
      openInvoices,
      promisedPaymentDate: options.promisedPaymentDate ?? null,
      totalOverdueBalance,
      stale,
      recommendedAction:
        options.nextAction ??
        (options.lastKnown
          ? stale
            ? "Latest telematics ping is stale. Escalate outreach and request a fresh SkyBitz pull."
            : "Coordinate recovery outreach with the latest known asset position."
          : "No telematics ping is available. Escalate manual recovery workflow."),
    },
  } satisfies IntegrationResult<{
    assetNumber: string;
    lastKnown: TelematicsRecord | null;
    branchName: string | null;
    customerName: string | null;
    openInvoices: Array<{
      invoiceNumber: string;
      balanceAmount: number;
      dueDate: string;
      status: string;
    }>;
    promisedPaymentDate: string | null;
    totalOverdueBalance: number;
    stale: boolean;
    recommendedAction: string;
  }>;
}

export async function buildRevenueExport(events: FinancialEventRecord[]) {
  return {
    mode: "demo",
    provider: "Internal",
    data: {
      rows: events.length,
      exportedAt: new Date().toISOString(),
    },
  } satisfies IntegrationResult<{ rows: number; exportedAt: string }>;
}

export async function buildPaymentMethodRecord(options: {
  customerNumber: string;
  methodType: string;
  label: string;
  last4: string;
}) {
  return {
    mode: "demo",
    provider: "Stripe",
    data: {
      id: `pm_${Math.random().toString(36).slice(2, 10)}`,
      customerNumber: options.customerNumber,
      provider: "Stripe",
      methodType: options.methodType,
      label: options.label,
      last4: options.last4,
      isDefault: false,
    } satisfies PaymentMethodRecord,
  } satisfies IntegrationResult<PaymentMethodRecord>;
}

export * from "@/lib/server/business-central-client";

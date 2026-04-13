import { createHash } from "node:crypto";

import Stripe from "stripe";

import type {
  CollectionCaseRecord,
  DocumentRecord,
  PaymentMethodRecord,
  SignatureRequestRecord,
  TelematicsRecord,
} from "@/lib/platform-types";
import type { FinancialEventRecord, InvoiceRecord } from "@/lib/domain/models";

export interface IntegrationResult<T> {
  mode: "live" | "demo";
  provider: string;
  data: T;
}

function buildHash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function getStripeClient() {
  const apiKey = process.env.STRIPE_SECRET_KEY;

  if (!apiKey) {
    return null;
  }

  return new Stripe(apiKey, {
    apiVersion: "2026-03-25.dahlia",
  });
}

export async function createStripePaymentIntent(options: {
  invoice: InvoiceRecord;
  customerName: string;
}) {
  const stripe = getStripeClient();

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
    metadata: {
      invoiceNumber: options.invoice.invoiceNumber,
      customerName: options.customerName,
    },
    automatic_payment_methods: {
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
}) {
  return {
    mode: "demo",
    provider: "Stripe",
    data: {
      url: `${options.returnUrl}?portal=demo&customer=${encodeURIComponent(options.customerName)}`,
    },
  } satisfies IntegrationResult<{ url: string }>;
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
}) {
  return {
    mode: "demo",
    provider: "Record360",
    data: {
      requestId: `r360_${options.assetNumber}_${options.inspectionType}`,
      unitNumber: options.assetNumber,
      contractNumber: options.contractNumber,
      inspectionType: options.inspectionType,
    },
  } satisfies IntegrationResult<{
    requestId: string;
    unitNumber: string;
    contractNumber: string;
    inspectionType: string;
  }>;
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
      hash: buildHash(`${options.contractNumber}:${options.filename}:${createdAt}`),
      createdAt,
    } satisfies DocumentRecord,
  } satisfies IntegrationResult<DocumentRecord>;
}

export async function buildSignatureRequest(options: {
  contractNumber: string;
  customerName: string;
  signers: string[];
}) {
  return {
    mode: "demo",
    provider: "Dropbox Sign",
    data: {
      id: `sig_${Math.random().toString(36).slice(2, 10)}`,
      contractNumber: options.contractNumber,
      customerName: options.customerName,
      provider: "Dropbox Sign",
      status: "sent",
      signers: options.signers,
      requestedAt: new Date().toISOString(),
      completedAt: null,
    } satisfies SignatureRequestRecord,
  } satisfies IntegrationResult<SignatureRequestRecord>;
}

export async function buildTelematicsRecoverySnapshot(options: {
  assetNumber: string;
  lastKnown?: TelematicsRecord;
}) {
  return {
    mode: "demo",
    provider: "SkyBitz",
    data: {
      assetNumber: options.assetNumber,
      lastKnown: options.lastKnown ?? null,
      recommendedAction: options.lastKnown
        ? "Coordinate recovery outreach with latest known asset position."
        : "No telematics ping available. Escalate manual recovery workflow.",
    },
  } satisfies IntegrationResult<{
    assetNumber: string;
    lastKnown: TelematicsRecord | null;
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

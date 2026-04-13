import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

import { and, desc, eq, or } from "drizzle-orm";

import { db, schema } from "@/lib/db";
import type {
  ContractRecord,
  CustomerRecord,
} from "@/lib/domain/models";
import type {
  DocumentRecord,
  SignatureEventRecord,
  SignatureRequestRecord,
  SignatureSignerRecord,
} from "@/lib/platform-types";
import { ApiError } from "@/lib/server/api";
import { appendAuditEvent } from "@/lib/server/audit";
import { fetchStoredBuffer, storeBuffer } from "@/lib/server/object-storage";
import {
  renderContractSignaturePacketPdf,
  renderOperationalDocumentPdf,
  renderSignatureCertificatePdf,
  renderSignedContractPdf,
} from "@/lib/server/pdf";
import {
  createId,
  hashValue,
  now,
  stableStringify,
  toIso,
} from "@/lib/server/production-utils";
import { sendTransactionalEmail } from "@/lib/server/notification-service";
import {
  listAssets,
  listContracts,
  listCustomers,
} from "@/lib/server/platform-service.production";

const CONSENT_TEXT_VERSION = "metro-esign-consent-v1";
const CERTIFICATION_TEXT =
  "By signing electronically, you confirm your authority to sign this agreement, your intent to adopt your typed name as your signature, and the accuracy of the submitted information.";
const OTP_TTL_MINUTES = 15;

type CreateDocumentInput = {
  contractNumber: string;
  customerName: string;
  documentType: string;
  filename: string;
};

type CreateSignatureRequestInput = {
  contractNumber: string;
  signers: Array<{
    name: string;
    email: string;
    title?: string;
    routingOrder?: number;
  }>;
  title?: string;
  subject?: string;
  message?: string;
  expiresInDays: number;
};

type SignSignatureInput = {
  signerId: string;
  token: string;
  otpCode: string;
  signatureText: string;
  signerTitle?: string;
  intentAccepted: true;
  consentAccepted: true;
  certificationAccepted: true;
};

type RequestMetadata = {
  ipAddress: string | null;
  userAgent: string | null;
};

export type SignatureRequestView = SignatureRequestRecord & {
  packetDocument: DocumentRecord | null;
  finalDocument: DocumentRecord | null;
  certificateDocument: DocumentRecord | null;
  signerLinks: Array<{
    signerId: string;
    signerName: string;
    signerEmail: string;
    signerStatus: string;
    url: string | null;
  }>;
  currentRoutingOrder: number | null;
};

export type SigningSession = {
  request: SignatureRequestView;
  signer: SignatureSignerRecord;
  packetDocument: DocumentRecord;
  canSign: boolean;
};

function requireRecord<T>(value: T | undefined, message: string) {
  if (!value) {
    throw new ApiError(404, message);
  }

  return value;
}

function getAppUrl() {
  return process.env.APP_URL ?? "http://localhost:3000";
}

function getEsignSecret() {
  return process.env.ESIGN_SECRET || process.env.AUTH_SECRET || "metro-trailer-demo-secret";
}

async function pushAudit(event: {
  entityId: string;
  eventType: string;
  userId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  await appendAuditEvent({
    entityType: "contract",
    entityId: event.entityId,
    eventType: event.eventType,
    userId: event.userId ?? null,
    metadata: event.metadata ?? {},
  });
}

function getCurrentRoutingOrder(signers: SignatureSignerRecord[]) {
  const pendingOrders = signers
    .filter((signer) => !["signed", "cancelled", "expired"].includes(signer.status))
    .map((signer) => signer.routingOrder)
    .sort((a, b) => a - b);

  return pendingOrders[0] ?? null;
}

function secureEqualHex(left: string | null | undefined, right: string) {
  if (!left || left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(
    Buffer.from(left, "hex"),
    Buffer.from(right, "hex"),
  );
}

function maskEmailAddress(email: string) {
  const [localPart, domain = ""] = email.split("@");
  const visibleLocal =
    localPart.length <= 2
      ? `${localPart[0] ?? "*"}*`
      : `${localPart.slice(0, 2)}***`;
  const [domainName, tld = ""] = domain.split(".");
  const visibleDomain = domainName ? `${domainName.slice(0, 1)}***` : "***";

  return `${visibleLocal}@${visibleDomain}${tld ? `.${tld}` : ""}`;
}

function createOtpCode() {
  return String(randomInt(100000, 1000000));
}

function createSignedToken(payload: {
  accessTokenId: string;
  signatureRequestId: string;
  signerId: string;
  expiresAt: string | null;
}) {
  const payloadPart = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = createHmac("sha256", getEsignSecret())
    .update(payloadPart)
    .digest("base64url");

  return `${payloadPart}.${signature}`;
}

function parseSignedToken(token: string) {
  const [payloadPart, signaturePart] = token.split(".");
  if (!payloadPart || !signaturePart) {
    throw new ApiError(401, "Invalid signing token.");
  }

  const expected = createHmac("sha256", getEsignSecret()).update(payloadPart).digest();
  const actual = Buffer.from(signaturePart, "base64url");

  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw new ApiError(401, "Invalid signing token.");
  }

  const payload = JSON.parse(
    Buffer.from(payloadPart, "base64url").toString("utf8"),
  ) as {
    accessTokenId: string;
    signatureRequestId: string;
    signerId: string;
    expiresAt: string | null;
  };

  if (payload.expiresAt && new Date(payload.expiresAt).getTime() < Date.now()) {
    throw new ApiError(410, "This signing link has expired.");
  }

  return payload;
}

async function getBaseRequestRow(signatureRequestId: string) {
  const [row] = await db
    .select({
      id: schema.signatureRequests.id,
      contractId: schema.signatureRequests.contractId,
      customerId: schema.signatureRequests.customerId,
      provider: schema.signatureRequests.provider,
      status: schema.signatureRequests.status,
      title: schema.signatureRequests.title,
      subject: schema.signatureRequests.subject,
      message: schema.signatureRequests.message,
      consentTextVersion: schema.signatureRequests.consentTextVersion,
      certificationText: schema.signatureRequests.certificationText,
      documentId: schema.signatureRequests.documentId,
      finalDocumentId: schema.signatureRequests.finalDocumentId,
      certificateDocumentId: schema.signatureRequests.certificateDocumentId,
      expiresAt: schema.signatureRequests.expiresAt,
      cancelledAt: schema.signatureRequests.cancelledAt,
      evidenceHash: schema.signatureRequests.evidenceHash,
      requestedAt: schema.signatureRequests.requestedAt,
      completedAt: schema.signatureRequests.completedAt,
      createdByUserId: schema.signatureRequests.createdByUserId,
      contractNumber: schema.contracts.contractNumber,
      customerName: schema.customers.name,
    })
    .from(schema.signatureRequests)
    .innerJoin(schema.contracts, eq(schema.signatureRequests.contractId, schema.contracts.id))
    .innerJoin(schema.customers, eq(schema.signatureRequests.customerId, schema.customers.id))
    .where(eq(schema.signatureRequests.id, signatureRequestId))
    .limit(1);

  return requireRecord(row, `Signature request ${signatureRequestId} not found.`);
}

function mapDocumentRow(row: {
  id: string;
  contractNumber: string | null;
  customerName: string | null;
  documentType: string;
  status: string;
  filename: string;
  objectLocked: boolean;
  lockedAt: Date | null;
  source: string;
  hash: string;
  createdAt: Date;
  contentType: string;
  sizeBytes: number;
  storageProvider: "inline" | "s3";
  storageBucket: string | null;
  storageKey: string | null;
  storageVersionId: string | null;
  storageETag: string | null;
  retentionUntil: Date | null;
  relatedSignatureRequestId: string | null;
  supersedesDocumentId: string | null;
  retentionMode: "governance" | "compliance" | null;
  metadata: Record<string, unknown> | null;
}) {
  return {
    id: row.id,
    contractNumber: row.contractNumber ?? "Unassigned",
    customerName: row.customerName ?? "Unknown",
    documentType: row.documentType,
    status: row.status,
    filename: row.filename,
    objectLocked: row.objectLocked,
    lockedAt: toIso(row.lockedAt),
    source: row.source,
    hash: row.hash,
    createdAt: toIso(row.createdAt) ?? new Date(0).toISOString(),
    contentType: row.contentType,
    sizeBytes: row.sizeBytes,
    contentBase64: null,
    storageProvider: row.storageProvider,
    storageBucket: row.storageBucket,
    storageKey: row.storageKey,
    storageVersionId: row.storageVersionId,
    storageETag: row.storageETag,
    retentionUntil: toIso(row.retentionUntil),
    relatedSignatureRequestId: row.relatedSignatureRequestId,
    supersedesDocumentId: row.supersedesDocumentId,
    retentionMode: row.retentionMode ?? "compliance",
    metadata: (row.metadata ?? {}) as Record<string, string | number | boolean | null>,
  } satisfies DocumentRecord;
}

function mapSignerRow(
  row: typeof schema.signatureSigners.$inferSelect,
  accessTokenId: string | null,
) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    title: row.title,
    routingOrder: row.routingOrder,
    status: row.status,
    requestedAt: toIso(row.requestedAt) ?? new Date(0).toISOString(),
    viewedAt: toIso(row.viewedAt),
    signedAt: toIso(row.signedAt),
    declinedAt: toIso(row.declinedAt),
    reminderCount: row.reminderCount,
    lastReminderAt: toIso(row.lastReminderAt),
    accessNonce: accessTokenId ?? "",
    signatureText: row.signatureText,
    intentAcceptedAt: toIso(row.intentAcceptedAt),
    consentAcceptedAt: toIso(row.consentAcceptedAt),
    certificationAcceptedAt: toIso(row.certificationAcceptedAt),
    otpVerifiedAt: toIso(row.otpVerifiedAt),
    ipAddress: row.ipAddress,
    userAgent: row.userAgent,
    evidenceHash: row.evidenceHash,
  } satisfies SignatureSignerRecord;
}

function mapEventRow(row: typeof schema.signatureEvents.$inferSelect) {
  return {
    id: row.id,
    type: row.type,
    actor: row.actor,
    timestamp: toIso(row.createdAt) ?? new Date(0).toISOString(),
    metadata: (row.metadata ?? {}) as Record<string, string | number | boolean | null>,
  } satisfies SignatureEventRecord;
}

async function createStoredDocument(options: {
  contractId: string;
  contractNumber: string;
  customerId: string;
  customerName: string;
  documentType: string;
  status: string;
  filename: string;
  buffer: Buffer;
  relatedSignatureRequestId?: string | null;
  supersedesDocumentId?: string | null;
  metadata?: Record<string, string | number | boolean | null>;
}) {
  const documentId = createId("doc");
  const key = `metro-trailer/documents/${options.contractNumber}/${options.documentType}/${documentId}/${options.filename}`;
  const stored = await storeBuffer({
    key,
    body: options.buffer,
    contentType: "application/pdf",
    retentionMode: "compliance",
    metadata: {
      contractNumber: options.contractNumber,
      customerName: options.customerName,
      documentType: options.documentType,
      documentId,
    },
  });

  if (
    stored.storageProvider !== "s3" ||
    !stored.storageBucket ||
    !stored.storageKey
  ) {
    throw new ApiError(
      500,
      "S3-backed storage is required for production document retention.",
    );
  }

  await db.insert(schema.documents).values({
    id: documentId,
    contractId: options.contractId,
    customerId: options.customerId,
    documentType: options.documentType,
    status:
      options.status as typeof schema.documents.$inferInsert.status,
    filename: options.filename,
    source: "internal_esign",
    hash: hashValue(options.buffer),
    contentType: "application/pdf",
    sizeBytes: stored.sizeBytes,
    storageProvider: stored.storageProvider,
    storageBucket: stored.storageBucket,
    storageKey: stored.storageKey,
    storageVersionId: stored.storageVersionId,
    storageETag: stored.storageETag,
    objectLocked: true,
    retentionMode: "compliance",
    retentionUntil: stored.retentionUntil ? new Date(stored.retentionUntil) : null,
    lockedAt: now(),
    relatedSignatureRequestId: options.relatedSignatureRequestId ?? null,
    supersedesDocumentId: options.supersedesDocumentId ?? null,
    metadata: options.metadata ?? {},
    createdAt: now(),
    updatedAt: now(),
  });

  return requireRecord(
    (await listDocuments(options.contractNumber)).find((document) => document.id === documentId),
    `Document ${documentId} not found after creation.`,
  );
}

async function getActiveSignAccessToken(signerId: string) {
  const [token] = await db
    .select()
    .from(schema.signatureAccessTokens)
    .where(
      and(
        eq(schema.signatureAccessTokens.signerId, signerId),
        eq(schema.signatureAccessTokens.purpose, "sign"),
      ),
    )
    .orderBy(desc(schema.signatureAccessTokens.createdAt))
    .limit(1);

  if (!token) {
    return null;
  }

  if (token.consumedAt || token.expiresAt.getTime() < Date.now()) {
    return null;
  }

  return token;
}

async function createSignAccessToken(options: {
  signatureRequestId: string;
  signerId: string;
  expiresAt: Date;
}) {
  const accessTokenId = createId("sigtk");
  const rawToken = createSignedToken({
    accessTokenId,
    signatureRequestId: options.signatureRequestId,
    signerId: options.signerId,
    expiresAt: options.expiresAt.toISOString(),
  });

  await db.insert(schema.signatureAccessTokens).values({
    id: accessTokenId,
    signatureRequestId: options.signatureRequestId,
    signerId: options.signerId,
    purpose: "sign",
    tokenHash: hashValue(rawToken),
    expiresAt: options.expiresAt,
    createdAt: now(),
  });

  return {
    id: accessTokenId,
    rawToken,
  };
}

async function ensureSignToken(options: {
  signatureRequestId: string;
  signerId: string;
  expiresAt: Date;
}) {
  const existing = await getActiveSignAccessToken(options.signerId);
  if (existing) {
    return {
      id: existing.id,
      rawToken: createSignedToken({
        accessTokenId: existing.id,
        signatureRequestId: options.signatureRequestId,
        signerId: options.signerId,
        expiresAt: existing.expiresAt.toISOString(),
      }),
    };
  }

  return createSignAccessToken(options);
}

async function verifySignToken(
  signatureRequestId: string,
  signerId: string,
  token: string,
) {
  const parsed = parseSignedToken(token);
  if (parsed.signatureRequestId !== signatureRequestId || parsed.signerId !== signerId) {
    throw new ApiError(401, "Invalid signing token.");
  }

  const accessToken = requireRecord(
    await db.query.signatureAccessTokens.findFirst({
      where: (table, { eq: localEq }) => localEq(table.id, parsed.accessTokenId),
    }),
    "Signing token is no longer valid.",
  );

  if (
    accessToken.signatureRequestId !== signatureRequestId ||
    accessToken.signerId !== signerId ||
    accessToken.purpose !== "sign"
  ) {
    throw new ApiError(401, "Invalid signing token.");
  }

  if (accessToken.consumedAt) {
    throw new ApiError(409, "This signing link has already been used.");
  }

  if (accessToken.expiresAt.getTime() < Date.now()) {
    throw new ApiError(410, "This signing link has expired.");
  }

  if (accessToken.tokenHash !== hashValue(token)) {
    throw new ApiError(401, "Invalid signing token.");
  }

  return accessToken;
}

async function getActiveOtpToken(options: {
  signatureRequestId: string;
  signerId: string;
  signTokenHash: string;
}) {
  const [otpToken] = await db
    .select()
    .from(schema.signatureAccessTokens)
    .where(
      and(
        eq(schema.signatureAccessTokens.signatureRequestId, options.signatureRequestId),
        eq(schema.signatureAccessTokens.signerId, options.signerId),
        eq(schema.signatureAccessTokens.purpose, "otp"),
        eq(schema.signatureAccessTokens.tokenHash, options.signTokenHash),
      ),
    )
    .orderBy(desc(schema.signatureAccessTokens.createdAt))
    .limit(1);

  if (!otpToken) {
    return null;
  }

  if (otpToken.consumedAt || otpToken.expiresAt.getTime() < Date.now()) {
    return null;
  }

  return otpToken;
}

async function invalidateOtpTokens(options: {
  signatureRequestId: string;
  signerId: string;
}) {
  await db
    .update(schema.signatureAccessTokens)
    .set({
      consumedAt: now(),
    })
    .where(
      and(
        eq(schema.signatureAccessTokens.signatureRequestId, options.signatureRequestId),
        eq(schema.signatureAccessTokens.signerId, options.signerId),
        eq(schema.signatureAccessTokens.purpose, "otp"),
      ),
    );
}

async function verifyOtpCode(options: {
  signatureRequestId: string;
  signerId: string;
  signToken: string;
  otpCode: string;
}) {
  const signTokenHash = hashValue(options.signToken);
  const otpToken = await getActiveOtpToken({
    signatureRequestId: options.signatureRequestId,
    signerId: options.signerId,
    signTokenHash,
  });

  if (!otpToken || !otpToken.otpCodeHash) {
    throw new ApiError(
      401,
      "A valid email verification code is required before signing.",
    );
  }

  if (!secureEqualHex(otpToken.otpCodeHash, hashValue(options.otpCode))) {
    throw new ApiError(401, "The verification code is invalid or expired.");
  }

  return otpToken;
}

async function getContractSnapshot(contractNumber: string) {
  const [contract, customer, assets] = await Promise.all([
    listContracts(),
    listCustomers(),
    listAssets(),
  ]);

  const contractRecord = requireRecord(
    contract.find(
      (entry) => entry.contractNumber === contractNumber || entry.id === contractNumber,
    ),
    `Contract ${contractNumber} not found.`,
  );
  const customerRecord = requireRecord(
    customer.find((entry) => entry.name === contractRecord.customerName),
    `Customer ${contractRecord.customerName} not found.`,
  );
  const assetRecords = assets.filter((asset) =>
    contractRecord.assets.includes(asset.assetNumber),
  );

  return {
    contract: contractRecord,
    customer: customerRecord,
    assets: assetRecords,
  };
}

function buildSignerEvidenceHash(options: {
  request: SignatureRequestRecord;
  signer: SignatureSignerRecord;
  packetHash: string;
}) {
  return hashValue(
    stableStringify({
      signatureRequestId: options.request.id,
      contractNumber: options.request.contractNumber,
      signerId: options.signer.id,
      signerName: options.signer.name,
      signerEmail: options.signer.email,
      signerTitle: options.signer.title,
      routingOrder: options.signer.routingOrder,
      signedAt: options.signer.signedAt,
      signatureText: options.signer.signatureText,
      intentAcceptedAt: options.signer.intentAcceptedAt,
      consentAcceptedAt: options.signer.consentAcceptedAt,
      certificationAcceptedAt: options.signer.certificationAcceptedAt,
      otpVerifiedAt: options.signer.otpVerifiedAt,
      ipAddress: options.signer.ipAddress,
      userAgent: options.signer.userAgent,
      consentVersion: options.request.consentTextVersion,
      packetHash: options.packetHash,
    }),
  );
}

function buildRequestEvidenceHash(
  request: SignatureRequestRecord,
  packetDocument: DocumentRecord,
) {
  return hashValue(
    stableStringify({
      signatureRequestId: request.id,
      contractNumber: request.contractNumber,
      documentId: packetDocument.id,
      packetHash: packetDocument.hash,
      completedAt: request.completedAt,
      signers: request.signers.map((signer) => ({
        signerId: signer.id,
        status: signer.status,
        signedAt: signer.signedAt,
        evidenceHash: signer.evidenceHash,
      })),
      consentVersion: request.consentTextVersion,
    }),
  );
}

async function loadSignatureRequestRecord(signatureRequestId: string) {
  const base = await getBaseRequestRow(signatureRequestId);
  const [signerRows, eventRows, accessTokenRows, documentRows] = await Promise.all([
    db
      .select()
      .from(schema.signatureSigners)
      .where(eq(schema.signatureSigners.signatureRequestId, signatureRequestId))
      .orderBy(schema.signatureSigners.routingOrder),
    db
      .select()
      .from(schema.signatureEvents)
      .where(eq(schema.signatureEvents.signatureRequestId, signatureRequestId))
      .orderBy(desc(schema.signatureEvents.createdAt)),
    db
      .select()
      .from(schema.signatureAccessTokens)
      .where(
        and(
          eq(schema.signatureAccessTokens.signatureRequestId, signatureRequestId),
          eq(schema.signatureAccessTokens.purpose, "sign"),
        ),
      )
      .orderBy(desc(schema.signatureAccessTokens.createdAt)),
    db
      .select({
        id: schema.documents.id,
        contractNumber: schema.contracts.contractNumber,
        customerName: schema.customers.name,
        documentType: schema.documents.documentType,
        status: schema.documents.status,
        filename: schema.documents.filename,
        objectLocked: schema.documents.objectLocked,
        lockedAt: schema.documents.lockedAt,
        source: schema.documents.source,
        hash: schema.documents.hash,
        createdAt: schema.documents.createdAt,
        contentType: schema.documents.contentType,
        sizeBytes: schema.documents.sizeBytes,
        storageProvider: schema.documents.storageProvider,
        storageBucket: schema.documents.storageBucket,
        storageKey: schema.documents.storageKey,
        storageVersionId: schema.documents.storageVersionId,
        storageETag: schema.documents.storageETag,
        retentionUntil: schema.documents.retentionUntil,
        relatedSignatureRequestId: schema.documents.relatedSignatureRequestId,
        supersedesDocumentId: schema.documents.supersedesDocumentId,
        retentionMode: schema.documents.retentionMode,
        metadata: schema.documents.metadata,
      })
      .from(schema.documents)
      .leftJoin(schema.contracts, eq(schema.documents.contractId, schema.contracts.id))
      .leftJoin(schema.customers, eq(schema.documents.customerId, schema.customers.id))
      .where(eq(schema.documents.relatedSignatureRequestId, signatureRequestId)),
  ]);

  const accessTokensBySignerId = new Map<string, typeof accessTokenRows[number]>();
  for (const token of accessTokenRows) {
    if (!token.consumedAt && token.expiresAt.getTime() >= Date.now()) {
      accessTokensBySignerId.set(token.signerId, token);
    }
  }

  const signers = signerRows.map((row) =>
    mapSignerRow(row, accessTokensBySignerId.get(row.id)?.id ?? null),
  );
  const events = eventRows.map(mapEventRow);
  const documents = documentRows.map(mapDocumentRow);

  return {
    base,
    signers,
    events,
    documents,
  };
}

async function buildSignatureView(signatureRequestId: string) {
  const { base, signers, events, documents } = await loadSignatureRequestRecord(
    signatureRequestId,
  );
  const packetDocument =
    documents.find((document) => document.id === base.documentId) ?? null;
  const finalDocument = base.finalDocumentId
    ? documents.find((document) => document.id === base.finalDocumentId) ?? null
    : null;
  const certificateDocument = base.certificateDocumentId
    ? documents.find((document) => document.id === base.certificateDocumentId) ?? null
    : null;
  const currentRoutingOrder = getCurrentRoutingOrder(signers);

  const signerLinks = await Promise.all(
    signers.map(async (signer) => {
      const actionable =
        !["signed", "cancelled", "expired"].includes(signer.status) &&
        !["completed", "cancelled", "expired"].includes(base.status);

      if (!actionable || !base.expiresAt || signer.routingOrder !== currentRoutingOrder) {
        return {
          signerId: signer.id,
          signerName: signer.name,
          signerEmail: signer.email,
          signerStatus: signer.status,
          url: null,
        };
      }

      const token = await ensureSignToken({
        signatureRequestId: base.id,
        signerId: signer.id,
        expiresAt: new Date(base.expiresAt),
      });

      return {
        signerId: signer.id,
        signerName: signer.name,
        signerEmail: signer.email,
        signerStatus: signer.status,
        url: `${getAppUrl()}/sign/${base.id}?signer=${signer.id}&token=${encodeURIComponent(token.rawToken)}`,
      };
    }),
  );

  return {
    id: base.id,
    contractNumber: base.contractNumber,
    customerName: base.customerName,
    provider: base.provider,
    status: base.status,
    title: base.title,
    subject: base.subject,
    message: base.message,
    consentTextVersion: base.consentTextVersion,
    certificationText: base.certificationText,
    documentId: base.documentId ?? "",
    finalDocumentId: base.finalDocumentId,
    certificateDocumentId: base.certificateDocumentId,
    expiresAt: toIso(base.expiresAt),
    cancelledAt: toIso(base.cancelledAt),
    signers,
    events,
    evidenceHash: base.evidenceHash,
    requestedAt: toIso(base.requestedAt) ?? new Date(0).toISOString(),
    completedAt: toIso(base.completedAt),
    packetDocument,
    finalDocument,
    certificateDocument,
    signerLinks,
    currentRoutingOrder,
  } satisfies SignatureRequestView;
}

async function finalizeSignatureRequest(signatureRequestId: string) {
  const request = await buildSignatureView(signatureRequestId);
  const packetDocument = requireRecord(
    request.packetDocument ?? undefined,
    "Signature packet document not found.",
  );
  const { contract, customer, assets } = await getContractSnapshot(request.contractNumber);
  const completedAt = new Date();

  const requestRecord: SignatureRequestRecord = {
    ...request,
    signers: request.signers,
    events: request.events,
    completedAt: completedAt.toISOString(),
    evidenceHash: null,
  };
  requestRecord.evidenceHash = buildRequestEvidenceHash(requestRecord, packetDocument);

  const [signedPdf, certificatePdf] = await Promise.all([
    renderSignedContractPdf({
      contract,
      customer,
      assets,
      request: requestRecord,
    }),
    renderSignatureCertificatePdf({
      request: requestRecord,
    }),
  ]);

  const signedDocument = await createStoredDocument({
    contractId: baseContractId(contract),
    contractNumber: request.contractNumber,
    customerId: baseCustomerId(customer),
    customerName: request.customerName,
    documentType: "signed_contract",
    status: "signed",
    filename: `${request.contractNumber}-signed-rental-agreement.pdf`,
    buffer: signedPdf,
    relatedSignatureRequestId: request.id,
    supersedesDocumentId: packetDocument.id,
    metadata: {
      evidenceHash: requestRecord.evidenceHash,
      packetDocumentId: packetDocument.id,
      packetDocumentHash: packetDocument.hash,
      signerCount: request.signers.length,
    },
  });
  const certificateDocument = await createStoredDocument({
    contractId: baseContractId(contract),
    contractNumber: request.contractNumber,
    customerId: baseCustomerId(customer),
    customerName: request.customerName,
    documentType: "signature_certificate",
    status: "signed",
    filename: `${request.contractNumber}-signature-certificate.pdf`,
    buffer: certificatePdf,
    relatedSignatureRequestId: request.id,
    metadata: {
      evidenceHash: requestRecord.evidenceHash,
      packetDocumentId: packetDocument.id,
      packetDocumentHash: packetDocument.hash,
      signerCount: request.signers.length,
    },
  });

  await db.transaction(async (tx) => {
    await tx
      .update(schema.documents)
      .set({
        status: "evidence_locked",
        metadata: {
          evidenceHash: requestRecord.evidenceHash,
          supersededBy: signedDocument.id,
        },
        updatedAt: now(),
      })
      .where(eq(schema.documents.id, packetDocument.id));

    await tx
      .update(schema.signatureRequests)
      .set({
        status: "completed",
        finalDocumentId: signedDocument.id,
        certificateDocumentId: certificateDocument.id,
        evidenceHash: requestRecord.evidenceHash,
        completedAt,
        updatedAt: now(),
      })
      .where(eq(schema.signatureRequests.id, request.id));

    await tx.insert(schema.signatureEvents).values({
      id: createId("sig_event"),
      signatureRequestId: request.id,
      type: "completed",
      actor: "Metro Trailer",
      metadata: {
        finalDocumentId: signedDocument.id,
        certificateDocumentId: certificateDocument.id,
        finalDocumentHash: signedDocument.hash,
        certificateDocumentHash: certificateDocument.hash,
        evidenceHash: requestRecord.evidenceHash,
      },
      createdAt: now(),
    });
  });

  await pushAudit({
    entityId: request.contractNumber,
    eventType: "signature_completed",
    metadata: {
      signatureRequestId: request.id,
      finalDocumentId: signedDocument.id,
    },
  });

  return buildSignatureView(request.id);
}

function baseContractId(contract: ContractRecord) {
  return contract.id;
}

function baseCustomerId(customer: CustomerRecord) {
  return customer.id;
}

export async function listDocuments(contractNumber?: string) {
  const rows = await db
    .select({
      id: schema.documents.id,
      contractNumber: schema.contracts.contractNumber,
      customerName: schema.customers.name,
      documentType: schema.documents.documentType,
      status: schema.documents.status,
      filename: schema.documents.filename,
      objectLocked: schema.documents.objectLocked,
      lockedAt: schema.documents.lockedAt,
      source: schema.documents.source,
      hash: schema.documents.hash,
      createdAt: schema.documents.createdAt,
      contentType: schema.documents.contentType,
      sizeBytes: schema.documents.sizeBytes,
      storageProvider: schema.documents.storageProvider,
      storageBucket: schema.documents.storageBucket,
      storageKey: schema.documents.storageKey,
      storageVersionId: schema.documents.storageVersionId,
      storageETag: schema.documents.storageETag,
      retentionUntil: schema.documents.retentionUntil,
      relatedSignatureRequestId: schema.documents.relatedSignatureRequestId,
      supersedesDocumentId: schema.documents.supersedesDocumentId,
      retentionMode: schema.documents.retentionMode,
      metadata: schema.documents.metadata,
    })
    .from(schema.documents)
    .leftJoin(schema.contracts, eq(schema.documents.contractId, schema.contracts.id))
    .leftJoin(schema.customers, eq(schema.documents.customerId, schema.customers.id))
    .orderBy(desc(schema.documents.createdAt));

  return rows
    .map(mapDocumentRow)
    .filter((document) =>
      contractNumber ? document.contractNumber === contractNumber : true,
    );
}

export async function createDocument(
  payload: CreateDocumentInput,
  userId = "system",
) {
  const { contract, customer } = await getContractSnapshot(payload.contractNumber);
  const buffer = await renderOperationalDocumentPdf(payload);
  const document = await createStoredDocument({
    contractId: baseContractId(contract),
    contractNumber: contract.contractNumber,
    customerId: baseCustomerId(customer),
    customerName: customer.name,
    documentType: payload.documentType,
    status: "draft",
    filename: payload.filename,
    buffer,
    metadata: {
      manuallyCreated: true,
    },
  });

  await pushAudit({
    entityId: contract.contractNumber,
    eventType: "document_created",
    userId,
    metadata: {
      documentId: document.id,
      documentType: document.documentType,
    },
  });

  return document;
}

export async function markDocumentArchived(documentId: string, userId = "system") {
  const [row] = await db
    .select({
      id: schema.documents.id,
      status: schema.documents.status,
      contractNumber: schema.contracts.contractNumber,
    })
    .from(schema.documents)
    .leftJoin(schema.contracts, eq(schema.documents.contractId, schema.contracts.id))
    .where(eq(schema.documents.id, documentId))
    .limit(1);
  const document = requireRecord(row, `Document ${documentId} not found.`);

  if (["signed", "evidence_locked"].includes(document.status)) {
    throw new ApiError(
      409,
      "Signed and evidence-locked documents cannot be archived through this endpoint.",
    );
  }

  await db
    .update(schema.documents)
    .set({
      status: "archived",
      updatedAt: now(),
    })
    .where(eq(schema.documents.id, document.id));

  await pushAudit({
    entityId: document.contractNumber ?? document.id,
    eventType: "document_archived",
    userId,
    metadata: {
      documentId: document.id,
    },
  });

  return requireRecord(
    (await listDocuments()).find((entry) => entry.id === document.id),
    `Document ${document.id} not found after archive.`,
  );
}

export async function listSignatureRequests(contractNumber?: string) {
  const rows = await db
    .select({ id: schema.signatureRequests.id, contractNumber: schema.contracts.contractNumber })
    .from(schema.signatureRequests)
    .innerJoin(schema.contracts, eq(schema.signatureRequests.contractId, schema.contracts.id))
    .orderBy(desc(schema.signatureRequests.requestedAt));

  const filtered = rows.filter((row) =>
    contractNumber ? row.contractNumber === contractNumber : true,
  );

  return Promise.all(filtered.map((row) => buildSignatureView(row.id)));
}

export async function getSignatureRequest(signatureRequestId: string) {
  return buildSignatureView(signatureRequestId);
}

export async function getDocumentDownload(documentId: string) {
  const [row] = await db
    .select({
      id: schema.documents.id,
      contractNumber: schema.contracts.contractNumber,
      customerName: schema.customers.name,
      documentType: schema.documents.documentType,
      status: schema.documents.status,
      filename: schema.documents.filename,
      objectLocked: schema.documents.objectLocked,
      lockedAt: schema.documents.lockedAt,
      source: schema.documents.source,
      hash: schema.documents.hash,
      createdAt: schema.documents.createdAt,
      contentType: schema.documents.contentType,
      sizeBytes: schema.documents.sizeBytes,
      storageProvider: schema.documents.storageProvider,
      storageBucket: schema.documents.storageBucket,
      storageKey: schema.documents.storageKey,
      storageVersionId: schema.documents.storageVersionId,
      storageETag: schema.documents.storageETag,
      retentionUntil: schema.documents.retentionUntil,
      relatedSignatureRequestId: schema.documents.relatedSignatureRequestId,
      supersedesDocumentId: schema.documents.supersedesDocumentId,
      retentionMode: schema.documents.retentionMode,
      metadata: schema.documents.metadata,
    })
    .from(schema.documents)
    .leftJoin(schema.contracts, eq(schema.documents.contractId, schema.contracts.id))
    .leftJoin(schema.customers, eq(schema.documents.customerId, schema.customers.id))
    .where(eq(schema.documents.id, documentId))
    .limit(1);

  const document = mapDocumentRow(requireRecord(row, `Document ${documentId} not found.`));
  const body = await fetchStoredBuffer({
    storageBucket: document.storageBucket,
    storageKey: document.storageKey,
    storageVersionId: document.storageVersionId,
  });

  return {
    document,
    body,
  };
}

export async function createSignatureRequestForContract(
  payload: CreateSignatureRequestInput,
  userId = "system",
) {
  const { contract, customer, assets } = await getContractSnapshot(payload.contractNumber);
  const requestId = createId("sig");
  const requestedAt = now();
  const expiresAt = new Date(Date.now() + payload.expiresInDays * 24 * 60 * 60 * 1000);
  const title = payload.title ?? `${contract.contractNumber} rental agreement`;
  const subject =
    payload.subject ?? "Please review and sign your Metro Trailer rental agreement";
  const message =
    payload.message ??
    "Review the contract packet, consent to electronic business, and complete your signature to activate this agreement.";

  const sortedSigners = payload.signers
    .map((signer, index) => ({
      id: createId("signer"),
      name: signer.name.trim(),
      email: signer.email.trim().toLowerCase(),
      title: signer.title?.trim() || null,
      routingOrder: signer.routingOrder ?? index + 1,
    }))
    .sort((a, b) => a.routingOrder - b.routingOrder);

  const packetPdf = await renderContractSignaturePacketPdf({
    contract,
    customer,
    assets,
    title,
    subject,
    message,
    signers: sortedSigners.map((signer) => ({
      id: signer.id,
      name: signer.name,
      email: signer.email,
      title: signer.title,
      routingOrder: signer.routingOrder,
      status: "pending",
      requestedAt: requestedAt.toISOString(),
      viewedAt: null,
      signedAt: null,
      declinedAt: null,
      reminderCount: 0,
      lastReminderAt: null,
      accessNonce: "",
      signatureText: null,
      intentAcceptedAt: null,
      consentAcceptedAt: null,
      certificationAcceptedAt: null,
      otpVerifiedAt: null,
      ipAddress: null,
      userAgent: null,
      evidenceHash: null,
    })),
  });

  const packetDocument = await createStoredDocument({
    contractId: contract.id,
    contractNumber: contract.contractNumber,
    customerId: customer.id,
    customerName: customer.name,
    documentType: "contract_packet",
    status: "ready_for_signature",
    filename: `${contract.contractNumber}-signature-packet.pdf`,
    buffer: packetPdf,
    relatedSignatureRequestId: requestId,
    metadata: {
      title,
      signerCount: sortedSigners.length,
    },
  });

  await db.transaction(async (tx) => {
    await tx.insert(schema.signatureRequests).values({
      id: requestId,
      contractId: contract.id,
      customerId: customer.id,
      provider: "Metro Trailer",
      status: "sent",
      title,
      subject,
      message,
      consentTextVersion: CONSENT_TEXT_VERSION,
      certificationText: CERTIFICATION_TEXT,
      documentId: packetDocument.id,
      expiresAt,
      requestedAt,
      createdByUserId: userId === "system" ? null : userId,
      updatedAt: now(),
    });

    await tx.insert(schema.signatureSigners).values(
      sortedSigners.map((signer) => ({
        id: signer.id,
        signatureRequestId: requestId,
        name: signer.name,
        email: signer.email,
        title: signer.title,
        routingOrder: signer.routingOrder,
        status: "pending" as const,
        requestedAt,
        updatedAt: now(),
      })),
    );

    await tx.insert(schema.signatureEvents).values({
      id: createId("sig_event"),
      signatureRequestId: requestId,
      type: "requested",
      actor: "Metro Trailer",
      metadata: {
        signerCount: sortedSigners.length,
        documentId: packetDocument.id,
      },
      createdAt: now(),
    });
  });

  for (const signer of sortedSigners) {
    await ensureSignToken({
      signatureRequestId: requestId,
      signerId: signer.id,
      expiresAt,
    });
  }

  const view = await buildSignatureView(requestId);
  const firstWave = view.signerLinks.filter(
    (link) => link.url && view.currentRoutingOrder !== null &&
      view.signers.find((signer) => signer.id === link.signerId)?.routingOrder ===
        view.currentRoutingOrder,
  );

  await Promise.all(
    firstWave.map((link) =>
      sendTransactionalEmail({
        to: link.signerEmail,
        subject,
        text: `${message}\n\nOpen signing session: ${link.url}`,
        relatedEntityType: "signature_request",
        relatedEntityId: requestId,
      }),
    ),
  );

  await pushAudit({
    entityId: contract.contractNumber,
    eventType: "signature_requested",
    userId,
    metadata: {
      signatureRequestId: requestId,
      signerCount: sortedSigners.length,
    },
  });

  return view;
}

export async function sendSignatureReminder(
  signatureRequestId: string,
  signerId?: string,
  userId = "system",
) {
  const request = await buildSignatureView(signatureRequestId);

  if (["completed", "cancelled", "expired"].includes(request.status)) {
    throw new ApiError(409, "This signature request is no longer actionable.");
  }

  const recipients = request.signers.filter((signer) => {
    if (signerId && signer.id !== signerId) {
      return false;
    }

    return (
      signer.status !== "signed" &&
      request.currentRoutingOrder !== null &&
      signer.routingOrder === request.currentRoutingOrder
    );
  });

  if (recipients.length === 0) {
    throw new ApiError(404, "No actionable signer found for a reminder.");
  }

  for (const signer of recipients) {
    const token = await ensureSignToken({
      signatureRequestId: request.id,
      signerId: signer.id,
      expiresAt: request.expiresAt ? new Date(request.expiresAt) : new Date(Date.now() + 14 * 86400000),
    });

    await db.transaction(async (tx) => {
      await tx
        .update(schema.signatureSigners)
        .set({
          reminderCount: signer.reminderCount + 1,
          lastReminderAt: now(),
          updatedAt: now(),
        })
        .where(eq(schema.signatureSigners.id, signer.id));

      await tx.insert(schema.signatureEvents).values({
        id: createId("sig_event"),
        signatureRequestId: request.id,
        signerId: signer.id,
        type: "reminder_sent",
        actor: "Metro Trailer",
        metadata: {
          signerEmail: signer.email,
          reminderCount: signer.reminderCount + 1,
        },
        createdAt: now(),
      });
    });

    await sendTransactionalEmail({
      to: signer.email,
      subject: request.subject,
      text: `${request.message}\n\nOpen signing session: ${getAppUrl()}/sign/${request.id}?signer=${signer.id}&token=${encodeURIComponent(token.rawToken)}`,
      relatedEntityType: "signature_request",
      relatedEntityId: request.id,
    });
  }

  await pushAudit({
    entityId: request.contractNumber,
    eventType: "signature_reminder_sent",
    userId,
    metadata: {
      signatureRequestId: request.id,
      recipientCount: recipients.length,
    },
  });

  return buildSignatureView(request.id);
}

export async function cancelSignatureRequest(
  signatureRequestId: string,
  reason: string,
  userId = "system",
) {
  const request = await buildSignatureView(signatureRequestId);

  if (["completed", "cancelled"].includes(request.status)) {
    throw new ApiError(409, "This signature request can no longer be cancelled.");
  }

  await db.transaction(async (tx) => {
    await tx
      .update(schema.signatureRequests)
      .set({
        status: "cancelled",
        cancelledAt: now(),
        updatedAt: now(),
      })
      .where(eq(schema.signatureRequests.id, request.id));

    await tx
      .update(schema.signatureSigners)
      .set({
        status: "cancelled",
        updatedAt: now(),
      })
      .where(
        and(
          eq(schema.signatureSigners.signatureRequestId, request.id),
          or(
            eq(schema.signatureSigners.status, "pending"),
            eq(schema.signatureSigners.status, "viewed"),
          ),
        ),
      );

    if (request.packetDocument && ["ready_for_signature", "signature_in_progress"].includes(request.packetDocument.status)) {
      await tx
        .update(schema.documents)
        .set({
          status: "archived",
          updatedAt: now(),
        })
        .where(eq(schema.documents.id, request.packetDocument.id));
    }

    await tx.insert(schema.signatureEvents).values({
      id: createId("sig_event"),
      signatureRequestId: request.id,
      type: "cancelled",
      actor: "Metro Trailer",
      metadata: {
        reason,
      },
      createdAt: now(),
    });
  });

  await pushAudit({
    entityId: request.contractNumber,
    eventType: "signature_cancelled",
    userId,
    metadata: {
      signatureRequestId: request.id,
      reason,
    },
  });

  return buildSignatureView(request.id);
}

export async function getSigningSession(
  signatureRequestId: string,
  signerId: string,
  token: string,
) {
  await verifySignToken(signatureRequestId, signerId, token);
  let request = await buildSignatureView(signatureRequestId);
  const signer = requireRecord(
    request.signers.find((candidate) => candidate.id === signerId),
    `Signer ${signerId} not found.`,
  );

  if (
    request.currentRoutingOrder === signer.routingOrder &&
    signer.status === "pending" &&
    !["completed", "cancelled", "expired"].includes(request.status)
  ) {
    await db.transaction(async (tx) => {
      await tx
        .update(schema.signatureSigners)
        .set({
          status: "viewed",
          viewedAt: now(),
          updatedAt: now(),
        })
        .where(eq(schema.signatureSigners.id, signer.id));

      await tx
        .update(schema.signatureRequests)
        .set({
          status: "in_progress",
          updatedAt: now(),
        })
        .where(eq(schema.signatureRequests.id, request.id));

      if (request.packetDocument?.status === "ready_for_signature") {
        await tx
          .update(schema.documents)
          .set({
            status: "signature_in_progress",
            updatedAt: now(),
          })
          .where(eq(schema.documents.id, request.packetDocument.id));
      }

      await tx.insert(schema.signatureEvents).values({
        id: createId("sig_event"),
        signatureRequestId: request.id,
        signerId: signer.id,
        type: "viewed",
        actor: signer.name,
        metadata: {
          signerId: signer.id,
        },
        createdAt: now(),
      });
    });

    request = await buildSignatureView(signatureRequestId);
  }

  const refreshedSigner = requireRecord(
    request.signers.find((candidate) => candidate.id === signerId),
    `Signer ${signerId} not found.`,
  );
  const packetDocument = requireRecord(
    request.packetDocument ?? undefined,
    "Signature packet document not found.",
  );

  return {
    request,
    signer: refreshedSigner,
    packetDocument,
    canSign:
      !["completed", "cancelled", "expired"].includes(request.status) &&
      !["signed", "cancelled", "expired"].includes(refreshedSigner.status) &&
      request.currentRoutingOrder === refreshedSigner.routingOrder,
  } satisfies SigningSession;
}

export async function requestSignatureOtp(
  signatureRequestId: string,
  signerId: string,
  token: string,
) {
  await verifySignToken(signatureRequestId, signerId, token);
  const request = await buildSignatureView(signatureRequestId);

  const signer = requireRecord(
    await db.query.signatureSigners.findFirst({
      where: (table, { and: localAnd, eq: localEq }) =>
        localAnd(
          localEq(table.id, signerId),
          localEq(table.signatureRequestId, signatureRequestId),
        ),
    }),
    `Signer ${signerId} not found.`,
  );

  if (request.currentRoutingOrder !== signer.routingOrder) {
    throw new ApiError(409, "This signer is not currently active in the routing order.");
  }

  if (["signed", "cancelled", "expired"].includes(signer.status)) {
    throw new ApiError(409, "This signer can no longer request a verification code.");
  }

  const otpCode = createOtpCode();
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

  await db.transaction(async (tx) => {
    await tx
      .update(schema.signatureAccessTokens)
      .set({
        consumedAt: now(),
      })
      .where(
        and(
          eq(schema.signatureAccessTokens.signatureRequestId, signatureRequestId),
          eq(schema.signatureAccessTokens.signerId, signerId),
          eq(schema.signatureAccessTokens.purpose, "otp"),
        ),
      );

    await tx.insert(schema.signatureAccessTokens).values({
      id: createId("otp"),
      signatureRequestId,
      signerId,
      purpose: "otp",
      tokenHash: hashValue(token),
      otpCodeHash: hashValue(otpCode),
      expiresAt,
      createdAt: now(),
    });

    await tx.insert(schema.signatureEvents).values({
      id: createId("sig_event"),
      signatureRequestId,
      signerId,
      type: "otp_requested",
      actor: "Metro Trailer",
      metadata: {
        deliveredTo: maskEmailAddress(signer.email),
        expiresAt: expiresAt.toISOString(),
      },
      createdAt: now(),
    });
  });

  await sendTransactionalEmail({
    to: signer.email,
    subject: `${request.subject} - verification code`,
    text: [
      `Your Metro Trailer verification code is ${otpCode}.`,
      "",
      `This code expires at ${expiresAt.toISOString()}.`,
      "Enter this code in the signing session to complete your signature.",
      "",
      `Request: ${request.title}`,
    ].join("\n"),
    relatedEntityType: "signature_request",
    relatedEntityId: signatureRequestId,
  });

  return {
    signatureRequestId,
    signerId,
    deliveredTo: maskEmailAddress(signer.email),
    expiresAt: expiresAt.toISOString(),
    message: "Verification code sent.",
  };
}

export async function signSignatureRequest(
  signatureRequestId: string,
  payload: SignSignatureInput,
  metadata: RequestMetadata,
) {
  const accessToken = await verifySignToken(signatureRequestId, payload.signerId, payload.token);
  const request = await buildSignatureView(signatureRequestId);
  const signer = requireRecord(
    request.signers.find((candidate) => candidate.id === payload.signerId),
    `Signer ${payload.signerId} not found.`,
  );
  const packetDocument = requireRecord(
    request.packetDocument ?? undefined,
    "Signature packet document not found.",
  );

  if (request.currentRoutingOrder !== signer.routingOrder) {
    throw new ApiError(409, "This signer is not currently active in the routing order.");
  }

  if (["completed", "cancelled", "expired"].includes(request.status)) {
    throw new ApiError(409, "This signature request is no longer actionable.");
  }

  if (["signed", "cancelled", "expired"].includes(signer.status)) {
    throw new ApiError(409, "This signer can no longer sign this request.");
  }

  if (
    payload.signatureText.trim().toLowerCase() !== signer.name.trim().toLowerCase()
  ) {
    throw new ApiError(
      400,
      "The typed signature must match the signer name assigned to this request.",
    );
  }

  const otpToken = await verifyOtpCode({
    signatureRequestId,
    signerId: payload.signerId,
    signToken: payload.token,
    otpCode: payload.otpCode,
  });

  const signedAt = now();
  const evidenceHash = buildSignerEvidenceHash({
    request,
    signer: {
      ...signer,
      title: payload.signerTitle?.trim() || signer.title,
      signatureText: payload.signatureText.trim(),
      intentAcceptedAt: signedAt.toISOString(),
      consentAcceptedAt: signedAt.toISOString(),
      certificationAcceptedAt: signedAt.toISOString(),
      otpVerifiedAt: signedAt.toISOString(),
      signedAt: signedAt.toISOString(),
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
    },
    packetHash: packetDocument.hash,
  });

  await db.transaction(async (tx) => {
    await tx
      .update(schema.signatureSigners)
      .set({
        status: "signed",
        title: payload.signerTitle?.trim() || signer.title,
        signatureText: payload.signatureText.trim(),
        intentAcceptedAt: signedAt,
        consentAcceptedAt: signedAt,
        certificationAcceptedAt: signedAt,
        otpVerifiedAt: signedAt,
        signedAt,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        evidenceHash,
        updatedAt: now(),
      })
      .where(eq(schema.signatureSigners.id, signer.id));

    await tx
      .update(schema.signatureAccessTokens)
      .set({
        consumedAt: signedAt,
      })
      .where(eq(schema.signatureAccessTokens.id, accessToken.id));

    await tx
      .update(schema.signatureAccessTokens)
      .set({
        consumedAt: signedAt,
      })
      .where(eq(schema.signatureAccessTokens.id, otpToken.id));

    await tx.insert(schema.signatureEvents).values({
      id: createId("sig_event"),
      signatureRequestId: request.id,
      signerId: signer.id,
      type: "otp_verified",
      actor: signer.name,
      metadata: {
        signerEmail: signer.email,
        verifiedAt: signedAt.toISOString(),
      },
      createdAt: now(),
    });

    await tx.insert(schema.signatureEvents).values({
      id: createId("sig_event"),
      signatureRequestId: request.id,
      signerId: signer.id,
      type: "signed",
      actor: signer.name,
      metadata: {
        signerEmail: signer.email,
        evidenceHash,
        consentTextVersion: request.consentTextVersion,
      },
      createdAt: now(),
    });
  });

  await invalidateOtpTokens({
    signatureRequestId,
    signerId: payload.signerId,
  });

  const refreshed = await buildSignatureView(signatureRequestId);
  const remainingSigner = refreshed.signers.find(
    (candidate) => !["signed", "cancelled", "expired"].includes(candidate.status),
  );

  if (!remainingSigner) {
    return finalizeSignatureRequest(signatureRequestId);
  }

  await db
    .update(schema.signatureRequests)
    .set({
      status: "partially_signed",
      updatedAt: now(),
    })
    .where(eq(schema.signatureRequests.id, signatureRequestId));

  if (refreshed.currentRoutingOrder === remainingSigner.routingOrder && refreshed.expiresAt) {
    const token = await ensureSignToken({
      signatureRequestId,
      signerId: remainingSigner.id,
      expiresAt: new Date(refreshed.expiresAt),
    });

    await sendTransactionalEmail({
      to: remainingSigner.email,
      subject: refreshed.subject,
      text: `${refreshed.message}\n\nOpen signing session: ${getAppUrl()}/sign/${refreshed.id}?signer=${remainingSigner.id}&token=${encodeURIComponent(token.rawToken)}`,
      relatedEntityType: "signature_request",
      relatedEntityId: refreshed.id,
    });
  }

  await pushAudit({
    entityId: refreshed.contractNumber,
    eventType: "signature_signer_completed",
    metadata: {
      signatureRequestId: refreshed.id,
      signerId: signer.id,
    },
  });

  return buildSignatureView(signatureRequestId);
}

export async function adminCompleteSignatureRequest(
  signatureRequestId?: string,
  userId?: string,
) {
  void signatureRequestId;
  void userId;
  throw new ApiError(
    405,
    "Administrative force-complete is disabled in production. Reissue or cancel the request instead.",
  );
}

export function getRequestMetadata(request: Request): RequestMetadata {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const ipAddress = forwardedFor
    ? forwardedFor.split(",")[0]?.trim() ?? null
    : null;

  return {
    ipAddress,
    userAgent: request.headers.get("user-agent"),
  };
}

import {
  createHash,
  createHmac,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";

import type {
  AssetRecord,
  ContractRecord,
} from "@/lib/domain/models";
import type {
  AuditEventRecord,
  DocumentRecord,
  PlatformState,
  SignatureEventRecord,
  SignatureRequestRecord,
  SignatureSignerRecord,
} from "@/lib/platform-types";
import { ApiError } from "@/lib/server/api";
import { getDemoStore } from "@/lib/server/demo-store";
import {
  buildDocumentStorageKey,
  fetchStoredBuffer,
  isS3StorageEnabled,
  storeBuffer,
} from "@/lib/server/object-storage";
import {
  renderContractSignaturePacketPdf,
  renderOperationalDocumentPdf,
  renderSignatureCertificatePdf,
  renderSignedContractPdf,
} from "@/lib/server/pdf";

const CONSENT_TEXT_VERSION = "metro-esign-consent-v1";
const CERTIFICATION_TEXT =
  "By signing electronically, you confirm your authority to sign this agreement, your intent to adopt your typed name as your signature, and the accuracy of the submitted information.";

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

function nowIso() {
  return new Date().toISOString();
}

function createId(prefix: string) {
  return `${prefix}_${randomUUID().slice(0, 8)}`;
}

function getState() {
  return getDemoStore();
}

function hashValue(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

function getAppUrl() {
  return process.env.APP_URL ?? "http://localhost:3000";
}

function getEsignSecret() {
  return process.env.ESIGN_SECRET || process.env.AUTH_SECRET || "metro-trailer-demo-secret";
}

function stableStringify(value: unknown): string {
  return JSON.stringify(
    value,
    (_key, current) => {
      if (
        current &&
        typeof current === "object" &&
        !Array.isArray(current)
      ) {
        return Object.fromEntries(
          Object.entries(current as Record<string, unknown>).sort(([a], [b]) =>
            a.localeCompare(b),
          ),
        );
      }

      return current;
    },
  );
}

function parseToken(token: string) {
  const [payloadPart, signaturePart] = token.split(".");

  if (!payloadPart || !signaturePart) {
    throw new ApiError(401, "Invalid signing token.");
  }

  const expectedSignature = createHmac("sha256", getEsignSecret())
    .update(payloadPart)
    .digest();

  const actualSignature = Buffer.from(signaturePart, "base64url");

  if (actualSignature.length !== expectedSignature.length) {
    throw new ApiError(401, "Invalid signing token.");
  }

  if (!timingSafeEqual(actualSignature, expectedSignature)) {
    throw new ApiError(401, "Invalid signing token.");
  }

  const payloadJson = Buffer.from(payloadPart, "base64url").toString("utf8");
  const payload = JSON.parse(payloadJson) as {
    signatureRequestId: string;
    signerId: string;
    accessNonce: string;
    expiresAt: string | null;
  };

  if (payload.expiresAt && new Date(payload.expiresAt).getTime() < Date.now()) {
    throw new ApiError(410, "This signing link has expired.");
  }

  return payload;
}

function createSigningToken(request: SignatureRequestRecord, signer: SignatureSignerRecord) {
  const payload = Buffer.from(
    JSON.stringify({
      signatureRequestId: request.id,
      signerId: signer.id,
      accessNonce: signer.accessNonce,
      expiresAt: request.expiresAt,
    }),
    "utf8",
  ).toString("base64url");

  const signature = createHmac("sha256", getEsignSecret())
    .update(payload)
    .digest("base64url");

  return `${payload}.${signature}`;
}

function pushAudit(
  state: PlatformState,
  event: Omit<AuditEventRecord, "id" | "timestamp">,
) {
  const auditEvent: AuditEventRecord = {
    id: createId("audit"),
    timestamp: nowIso(),
    ...event,
  };

  state.auditEvents.unshift(auditEvent);
  return auditEvent;
}

function appendSignatureEvent(
  request: SignatureRequestRecord,
  type: string,
  actor: string,
  metadata: Record<string, string | number | boolean | null> = {},
) {
  const event: SignatureEventRecord = {
    id: createId("sig_event"),
    type,
    actor,
    timestamp: nowIso(),
    metadata,
  };

  request.events.unshift(event);
  return event;
}

function requireRecord<T>(value: T | undefined, message: string) {
  if (!value) {
    throw new ApiError(404, message);
  }

  return value;
}

function getContractByIdOrNumber(state: PlatformState, contractNumber: string) {
  return requireRecord(
    state.contracts.find(
      (contract) =>
        contract.id === contractNumber || contract.contractNumber === contractNumber,
    ),
    `Contract ${contractNumber} not found.`,
  );
}

function getCustomerByName(state: PlatformState, customerName: string) {
  return requireRecord(
    state.customers.find((customer) => customer.name === customerName),
    `Customer ${customerName} not found.`,
  );
}

function getDocumentById(state: PlatformState, documentId: string) {
  return requireRecord(
    state.documents.find((document) => document.id === documentId),
    `Document ${documentId} not found.`,
  );
}

function getSignatureRequestById(state: PlatformState, signatureRequestId: string) {
  return requireRecord(
    state.signatureRequests.find((request) => request.id === signatureRequestId),
    `Signature request ${signatureRequestId} not found.`,
  );
}

function getContractAssets(state: PlatformState, contract: ContractRecord) {
  return contract.assets
    .map((assetNumber) =>
      state.assets.find((asset) => asset.assetNumber === assetNumber),
    )
    .filter(Boolean) as AssetRecord[];
}

function getSignatureCurrentRoutingOrder(request: SignatureRequestRecord) {
  const pendingOrders = request.signers
    .filter((signer) => !["signed", "cancelled", "expired"].includes(signer.status))
    .map((signer) => signer.routingOrder)
    .sort((a, b) => a - b);

  return pendingOrders[0] ?? null;
}

function normalizeRequestStatus(request: SignatureRequestRecord) {
  if (
    request.expiresAt &&
    !request.completedAt &&
    !request.cancelledAt &&
    new Date(request.expiresAt).getTime() < Date.now()
  ) {
    request.status = "expired";
    request.signers.forEach((signer) => {
      if (["pending", "viewed"].includes(signer.status)) {
        signer.status = "expired";
      }
    });
  }

  return request;
}

async function buildDocumentRecord(options: {
  contractNumber: string;
  customerName: string;
  documentType: string;
  status: string;
  filename: string;
  buffer: Buffer;
  relatedSignatureRequestId?: string | null;
  supersedesDocumentId?: string | null;
  metadata?: Record<string, string | number | boolean | null>;
}) {
  const createdAt = nowIso();
  const documentId = createId("doc");
  const storageKey = buildDocumentStorageKey({
    contractNumber: options.contractNumber,
    documentType: options.documentType,
    documentId,
    filename: options.filename,
  });
  const stored = await storeBuffer({
    key: storageKey,
    body: options.buffer,
    contentType: "application/pdf",
    retentionMode: "compliance",
    metadata: {
      contractNumber: options.contractNumber,
      customerName: options.customerName,
      documentType: options.documentType,
      documentId,
      source: options.metadata?.source ?? "metro-trailer",
    },
  });

  return {
    id: documentId,
    contractNumber: options.contractNumber,
    customerName: options.customerName,
    documentType: options.documentType,
    status: options.status,
    filename: options.filename,
    objectLocked: true,
    lockedAt: createdAt,
    source: "internal_esign",
    hash: hashValue(options.buffer),
    createdAt,
    contentType: "application/pdf",
    sizeBytes: stored.sizeBytes,
    contentBase64: stored.contentBase64,
    storageProvider: stored.storageProvider,
    storageBucket: stored.storageBucket,
    storageKey: stored.storageKey,
    storageVersionId: stored.storageVersionId,
    storageETag: stored.storageETag,
    retentionUntil: stored.retentionUntil,
    relatedSignatureRequestId: options.relatedSignatureRequestId ?? null,
    supersedesDocumentId: options.supersedesDocumentId ?? null,
    retentionMode: "compliance" as const,
    metadata: options.metadata ?? {},
  } satisfies DocumentRecord;
}

async function ensureDocumentStored(document: DocumentRecord) {
  if (
    document.storageProvider === "s3" &&
    document.storageBucket &&
    document.storageKey
  ) {
    return document;
  }

  if (!isS3StorageEnabled() || !document.contentBase64) {
    return document;
  }

  const buffer = Buffer.from(document.contentBase64, "base64");
  const stored = await storeBuffer({
    key:
      document.storageKey ??
      buildDocumentStorageKey({
        contractNumber: document.contractNumber,
        documentType: document.documentType,
        documentId: document.id,
        filename: document.filename,
      }),
    body: buffer,
    contentType: document.contentType,
    retentionMode: document.retentionMode,
    metadata: {
      contractNumber: document.contractNumber,
      customerName: document.customerName,
      documentType: document.documentType,
      documentId: document.id,
      migratedFromInline: true,
    },
  });

  document.sizeBytes = stored.sizeBytes;
  document.storageProvider = stored.storageProvider;
  document.storageBucket = stored.storageBucket;
  document.storageKey = stored.storageKey;
  document.storageVersionId = stored.storageVersionId;
  document.storageETag = stored.storageETag;
  document.retentionUntil = stored.retentionUntil;
  document.contentBase64 = stored.contentBase64;
  document.metadata = {
    ...document.metadata,
    storageMigratedAt: nowIso(),
  };

  return document;
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
      routingOrder: options.signer.routingOrder,
      signedAt: options.signer.signedAt,
      signatureText: options.signer.signatureText,
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

function ensureSignerCanAct(request: SignatureRequestRecord, signer: SignatureSignerRecord) {
  normalizeRequestStatus(request);

  if (request.cancelledAt || request.status === "cancelled") {
    throw new ApiError(409, "This signature request has been cancelled.");
  }

  if (request.status === "completed") {
    throw new ApiError(409, "This signature request has already been completed.");
  }

  if (request.status === "expired") {
    throw new ApiError(410, "This signature request has expired.");
  }

  const currentOrder = getSignatureCurrentRoutingOrder(request);

  if (currentOrder !== null && signer.routingOrder !== currentOrder) {
    throw new ApiError(409, "This signer is not currently active in the routing order.");
  }
}

function buildSignatureView(
  state: PlatformState,
  request: SignatureRequestRecord,
): SignatureRequestView {
  normalizeRequestStatus(request);

  const packetDocument = state.documents.find(
    (document) => document.id === request.documentId,
  ) ?? null;
  const finalDocument = request.finalDocumentId
    ? state.documents.find((document) => document.id === request.finalDocumentId) ?? null
    : null;
  const certificateDocument = request.certificateDocumentId
    ? state.documents.find((document) => document.id === request.certificateDocumentId) ?? null
    : null;

  return {
    ...request,
    packetDocument,
    finalDocument,
    certificateDocument,
    currentRoutingOrder: getSignatureCurrentRoutingOrder(request),
    signerLinks: request.signers.map((signer) => ({
      signerId: signer.id,
      signerName: signer.name,
      signerEmail: signer.email,
      signerStatus: signer.status,
      url:
        ["signed", "cancelled", "expired"].includes(signer.status) ||
        request.status === "completed" ||
        request.status === "cancelled" ||
        request.status === "expired"
          ? null
          : `${getAppUrl()}/sign/${request.id}?signer=${signer.id}&token=${createSigningToken(
              request,
              signer,
            )}`,
    })),
  };
}

async function finalizeSignatureRequest(
  state: PlatformState,
  request: SignatureRequestRecord,
) {
  const contract = getContractByIdOrNumber(state, request.contractNumber);
  const customer = getCustomerByName(state, request.customerName);
  const assets = getContractAssets(state, contract);
  const packetDocument = getDocumentById(state, request.documentId);

  request.status = "completed";
  request.completedAt = nowIso();
  request.evidenceHash = buildRequestEvidenceHash(request, packetDocument);

  const signedPdf = await renderSignedContractPdf({
    contract,
    customer,
    assets,
    request,
  });
  const certificatePdf = await renderSignatureCertificatePdf({
    request,
  });

  const signedDocument = await buildDocumentRecord({
    contractNumber: request.contractNumber,
    customerName: request.customerName,
    documentType: "signed_contract",
    status: "signed",
    filename: `${request.contractNumber}-signed-rental-agreement.pdf`,
    buffer: signedPdf,
    relatedSignatureRequestId: request.id,
    supersedesDocumentId: packetDocument.id,
    metadata: {
      evidenceHash: request.evidenceHash,
      certificatePending: false,
    },
  });

  const certificateDocument = await buildDocumentRecord({
    contractNumber: request.contractNumber,
    customerName: request.customerName,
    documentType: "signature_certificate",
    status: "signed",
    filename: `${request.contractNumber}-signature-certificate.pdf`,
    buffer: certificatePdf,
    relatedSignatureRequestId: request.id,
    metadata: {
      evidenceHash: request.evidenceHash,
      signerCount: request.signers.length,
    },
  });

  packetDocument.status = "evidence_locked";
  packetDocument.metadata = {
    ...packetDocument.metadata,
    evidenceHash: request.evidenceHash,
    supersededBy: signedDocument.id,
  };

  request.finalDocumentId = signedDocument.id;
  request.certificateDocumentId = certificateDocument.id;

  state.documents.unshift(certificateDocument);
  state.documents.unshift(signedDocument);

  appendSignatureEvent(request, "completed", "Metro Trailer", {
    finalDocumentId: signedDocument.id,
    certificateDocumentId: certificateDocument.id,
  });

  pushAudit(state, {
    entityType: "signature_request",
    entityId: request.id,
    eventType: "completed",
    userName: "Metro Trailer",
    metadata: {
      contractNumber: request.contractNumber,
      finalDocumentId: signedDocument.id,
    },
  });

  return request;
}

export function listDocuments(contractNumber?: string) {
  const state = getState();
  const documents = contractNumber
    ? state.documents.filter((document) => document.contractNumber === contractNumber)
    : state.documents;

  return [...documents].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function createDocument(
  payload: CreateDocumentInput,
  userName = "System",
) {
  const state = getState();
  const pdf = await renderOperationalDocumentPdf(payload);
  const document = await buildDocumentRecord({
    contractNumber: payload.contractNumber,
    customerName: payload.customerName,
    documentType: payload.documentType,
    status: "draft",
    filename: payload.filename,
    buffer: pdf,
    metadata: {
      manuallyCreated: true,
    },
  });

  state.documents.unshift(document);

  pushAudit(state, {
    entityType: "document",
    entityId: document.id,
    eventType: "created",
    userName,
    metadata: {
      contractNumber: payload.contractNumber,
      documentType: payload.documentType,
    },
  });

  return document;
}

export function markDocumentArchived(documentId: string, userName = "System") {
  const state = getState();
  const document = getDocumentById(state, documentId);

  if (["signed", "evidence_locked"].includes(document.status)) {
    throw new ApiError(
      409,
      "Signed and evidence-locked documents cannot be archived through this endpoint.",
    );
  }

  document.status = "archived";

  pushAudit(state, {
    entityType: "document",
    entityId: document.id,
    eventType: "archived",
    userName,
    metadata: {
      filename: document.filename,
    },
  });

  return document;
}

export function listSignatureRequests(contractNumber?: string) {
  const state = getState();
  const requests = contractNumber
    ? state.signatureRequests.filter(
        (request) => request.contractNumber === contractNumber,
      )
    : state.signatureRequests;

  return requests
    .map((request) => buildSignatureView(state, request))
    .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
}

export function getSignatureRequest(signatureRequestId: string) {
  const state = getState();
  const request = getSignatureRequestById(state, signatureRequestId);
  return buildSignatureView(state, request);
}

export async function getDocumentDownload(documentId: string) {
  const state = getState();
  const document = getDocumentById(state, documentId);
  await ensureDocumentStored(document);
  const body = await fetchStoredBuffer({
    contentBase64: document.contentBase64,
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
  userName = "System",
) {
  const state = getState();
  const contract = getContractByIdOrNumber(state, payload.contractNumber);
  const customer = getCustomerByName(state, contract.customerName);
  const assets = getContractAssets(state, contract);
  const requestedAt = nowIso();
  const title =
    payload.title ??
    `${contract.contractNumber} rental agreement`;
  const subject =
    payload.subject ?? "Please review and sign your Metro Trailer rental agreement";
  const message =
    payload.message ??
    "Review the contract packet, consent to electronic business, and complete your signature to activate this agreement.";

  const request: SignatureRequestRecord = {
    id: createId("sig"),
    contractNumber: contract.contractNumber,
    customerName: contract.customerName,
    provider: "Metro Trailer",
    status: "sent",
    title,
    subject,
    message,
    consentTextVersion: CONSENT_TEXT_VERSION,
    certificationText: CERTIFICATION_TEXT,
    documentId: "",
    finalDocumentId: null,
    certificateDocumentId: null,
    expiresAt: new Date(
      Date.now() + payload.expiresInDays * 24 * 60 * 60 * 1000,
    ).toISOString(),
    cancelledAt: null,
    signers: payload.signers
      .map((signer, index) => ({
        id: createId("signer"),
        name: signer.name.trim(),
        email: signer.email.trim().toLowerCase(),
        title: signer.title?.trim() || null,
        routingOrder: signer.routingOrder ?? index + 1,
        status: "pending",
        requestedAt,
        viewedAt: null,
        signedAt: null,
        declinedAt: null,
        reminderCount: 0,
        lastReminderAt: null,
        accessNonce: randomUUID(),
        signatureText: null,
        intentAcceptedAt: null,
        consentAcceptedAt: null,
        certificationAcceptedAt: null,
        ipAddress: null,
        userAgent: null,
        evidenceHash: null,
      }))
      .sort((a, b) => a.routingOrder - b.routingOrder),
    events: [],
    evidenceHash: null,
    requestedAt,
    completedAt: null,
  };

  const packetPdf = await renderContractSignaturePacketPdf({
    contract,
    customer,
    assets,
    title,
    subject,
    message,
    signers: request.signers,
  });

  const packetDocument = await buildDocumentRecord({
    contractNumber: contract.contractNumber,
    customerName: contract.customerName,
    documentType: "contract_packet",
    status: "ready_for_signature",
    filename: `${contract.contractNumber}-signature-packet.pdf`,
    buffer: packetPdf,
    relatedSignatureRequestId: request.id,
    metadata: {
      title,
      signerCount: request.signers.length,
    },
  });

  request.documentId = packetDocument.id;
  appendSignatureEvent(request, "requested", userName, {
    signerCount: request.signers.length,
    documentId: packetDocument.id,
  });

  state.documents.unshift(packetDocument);
  state.signatureRequests.unshift(request);

  pushAudit(state, {
    entityType: "contract",
    entityId: contract.contractNumber,
    eventType: "signature_requested",
    userName,
    metadata: {
      signerCount: request.signers.length,
      signatureRequestId: request.id,
    },
  });

  return buildSignatureView(state, request);
}

export function sendSignatureReminder(
  signatureRequestId: string,
  signerId?: string,
  userName = "System",
) {
  const state = getState();
  const request = getSignatureRequestById(state, signatureRequestId);

  normalizeRequestStatus(request);

  if (["completed", "cancelled", "expired"].includes(request.status)) {
    throw new ApiError(409, "This signature request is no longer actionable.");
  }

  const currentOrder = getSignatureCurrentRoutingOrder(request);
  const recipients = request.signers.filter((signer) => {
    if (signerId && signer.id !== signerId) {
      return false;
    }

    return signer.status !== "signed" && signer.routingOrder === currentOrder;
  });

  if (recipients.length === 0) {
    throw new ApiError(404, "No actionable signer found for a reminder.");
  }

  const remindedAt = nowIso();

  recipients.forEach((signer) => {
    signer.reminderCount += 1;
    signer.lastReminderAt = remindedAt;
    appendSignatureEvent(request, "reminder_sent", userName, {
      signerId: signer.id,
      signerEmail: signer.email,
      reminderCount: signer.reminderCount,
    });
  });

  pushAudit(state, {
    entityType: "signature_request",
    entityId: request.id,
    eventType: "reminder_sent",
    userName,
    metadata: {
      recipientCount: recipients.length,
    },
  });

  return buildSignatureView(state, request);
}

export function cancelSignatureRequest(
  signatureRequestId: string,
  reason: string,
  userName = "System",
) {
  const state = getState();
  const request = getSignatureRequestById(state, signatureRequestId);

  normalizeRequestStatus(request);

  if (["completed", "cancelled"].includes(request.status)) {
    throw new ApiError(409, "This signature request can no longer be cancelled.");
  }

  request.status = "cancelled";
  request.cancelledAt = nowIso();
  request.signers.forEach((signer) => {
    if (!["signed", "expired"].includes(signer.status)) {
      signer.status = "cancelled";
    }
  });

  const packetDocument = getDocumentById(state, request.documentId);
  if (
    packetDocument.status === "ready_for_signature" ||
    packetDocument.status === "signature_in_progress"
  ) {
    packetDocument.status = "archived";
  }

  appendSignatureEvent(request, "cancelled", userName, {
    reason,
  });

  pushAudit(state, {
    entityType: "signature_request",
    entityId: request.id,
    eventType: "cancelled",
    userName,
    metadata: {
      reason,
    },
  });

  return buildSignatureView(state, request);
}

export function getSigningSession(
  signatureRequestId: string,
  signerId: string,
  token: string,
) {
  const state = getState();
  const request = getSignatureRequestById(state, signatureRequestId);
  const signer = requireRecord(
    request.signers.find((candidate) => candidate.id === signerId),
    `Signer ${signerId} not found.`,
  );
  const payload = parseToken(token);

  if (
    payload.signatureRequestId !== request.id ||
    payload.signerId !== signer.id ||
    payload.accessNonce !== signer.accessNonce
  ) {
    throw new ApiError(401, "Invalid signing token.");
  }

  normalizeRequestStatus(request);

  const canAdvanceViewState =
    !["completed", "cancelled", "expired"].includes(request.status) &&
    signer.status === "pending" &&
    getSignatureCurrentRoutingOrder(request) === signer.routingOrder;

  if (canAdvanceViewState) {
    signer.status = "viewed";
    signer.viewedAt = nowIso();
    request.status = "in_progress";
    appendSignatureEvent(request, "viewed", signer.name, {
      signerId: signer.id,
    });
  }

  const packetDocument = getDocumentById(state, request.documentId);
  if (packetDocument.status === "ready_for_signature" && canAdvanceViewState) {
    packetDocument.status = "signature_in_progress";
  }

  const canSign =
    request.status !== "completed" &&
    request.status !== "cancelled" &&
    request.status !== "expired" &&
    !["signed", "cancelled", "expired"].includes(signer.status) &&
    getSignatureCurrentRoutingOrder(request) === signer.routingOrder;

  return {
    request: buildSignatureView(state, request),
    signer,
    packetDocument,
    canSign,
  } satisfies SigningSession;
}

export async function signSignatureRequest(
  signatureRequestId: string,
  payload: SignSignatureInput,
  metadata: RequestMetadata,
) {
  const state = getState();
  const request = getSignatureRequestById(state, signatureRequestId);
  const signer = requireRecord(
    request.signers.find((candidate) => candidate.id === payload.signerId),
    `Signer ${payload.signerId} not found.`,
  );
  const tokenPayload = parseToken(payload.token);

  if (
    tokenPayload.signatureRequestId !== request.id ||
    tokenPayload.signerId !== signer.id ||
    tokenPayload.accessNonce !== signer.accessNonce
  ) {
    throw new ApiError(401, "Invalid signing token.");
  }

  ensureSignerCanAct(request, signer);

  if (
    payload.signatureText.trim().toLowerCase() !== signer.name.trim().toLowerCase()
  ) {
    throw new ApiError(
      400,
      "The typed signature must match the signer name assigned to this request.",
    );
  }

  const signedAt = nowIso();
  const packetDocument = getDocumentById(state, request.documentId);

  signer.status = "signed";
  signer.signatureText = payload.signatureText.trim();
  signer.title = payload.signerTitle?.trim() || signer.title;
  signer.intentAcceptedAt = payload.intentAccepted ? signedAt : null;
  signer.consentAcceptedAt = payload.consentAccepted ? signedAt : null;
  signer.certificationAcceptedAt = payload.certificationAccepted ? signedAt : null;
  signer.signedAt = signedAt;
  signer.ipAddress = metadata.ipAddress;
  signer.userAgent = metadata.userAgent;
  signer.evidenceHash = buildSignerEvidenceHash({
    request,
    signer,
    packetHash: packetDocument.hash,
  });

  appendSignatureEvent(request, "signed", signer.name, {
    signerId: signer.id,
    signerEmail: signer.email,
    evidenceHash: signer.evidenceHash,
  });

  pushAudit(state, {
    entityType: "signature_request",
    entityId: request.id,
    eventType: "signer_completed",
    userName: signer.name,
    metadata: {
      signerId: signer.id,
      contractNumber: request.contractNumber,
    },
  });

  const remainingSigner = request.signers.find(
    (candidate) => candidate.status !== "signed",
  );

  if (remainingSigner) {
    request.status = "partially_signed";
  } else {
    await finalizeSignatureRequest(state, request);
  }

  return buildSignatureView(state, request);
}

export async function adminCompleteSignatureRequest(
  signatureRequestId: string,
  userName = "System",
) {
  const state = getState();
  const request = getSignatureRequestById(state, signatureRequestId);
  const packetDocument = getDocumentById(state, request.documentId);

  normalizeRequestStatus(request);

  if (["completed", "cancelled", "expired"].includes(request.status)) {
    throw new ApiError(409, "This signature request cannot be force-completed.");
  }

  request.signers.forEach((signer) => {
    if (signer.status === "signed") {
      return;
    }

    const completedAt = nowIso();
    signer.status = "signed";
    signer.viewedAt = signer.viewedAt ?? completedAt;
    signer.signedAt = completedAt;
    signer.signatureText = signer.name;
    signer.intentAcceptedAt = completedAt;
    signer.consentAcceptedAt = completedAt;
    signer.certificationAcceptedAt = completedAt;
    signer.ipAddress = "system-override";
    signer.userAgent = "Metro Trailer admin override";
    signer.evidenceHash = buildSignerEvidenceHash({
      request,
      signer,
      packetHash: packetDocument.hash,
    });

    appendSignatureEvent(request, "signed", userName, {
      signerId: signer.id,
      override: true,
    });
  });

  await finalizeSignatureRequest(state, request);

  pushAudit(state, {
    entityType: "signature_request",
    entityId: request.id,
    eventType: "force_completed",
    userName,
    metadata: {
      contractNumber: request.contractNumber,
    },
  });

  return buildSignatureView(state, request);
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

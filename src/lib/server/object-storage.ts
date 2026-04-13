import { createHash } from "node:crypto";

import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from "@aws-sdk/client-s3";

import { ApiError } from "@/lib/server/api";

type StoredObjectMetadataValue = string | number | boolean | null | undefined;

type StoreBufferOptions = {
  key: string;
  body: Buffer;
  contentType: string;
  metadata?: Record<string, StoredObjectMetadataValue>;
  retentionMode?: "governance" | "compliance";
};

type StoredBufferResult = {
  contentBase64: string | null;
  sizeBytes: number;
  checksumSha256: string;
  storageProvider: "inline" | "s3";
  storageBucket: string | null;
  storageKey: string | null;
  storageVersionId: string | null;
  storageETag: string | null;
  retentionUntil: string | null;
};

type FetchStoredBufferOptions = {
  contentBase64?: string | null;
  storageBucket?: string | null;
  storageKey?: string | null;
  storageVersionId?: string | null;
};

function sanitizeSegment(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function getStoragePrefix() {
  return process.env.S3_PREFIX?.trim().replace(/^\/+|\/+$/g, "") || "metro-trailer";
}

export function getS3Bucket() {
  return process.env.S3_BUCKET?.trim() || null;
}

function getS3Region() {
  return process.env.S3_REGION?.trim() || process.env.AWS_REGION?.trim() || null;
}

function getS3Endpoint() {
  return process.env.S3_ENDPOINT?.trim() || undefined;
}

function getS3ServerSideEncryption() {
  const value = process.env.S3_SERVER_SIDE_ENCRYPTION?.trim();
  return value || undefined;
}

function getS3KmsKeyId() {
  return process.env.S3_KMS_KEY_ID?.trim() || undefined;
}

function getS3ForcePathStyle() {
  return process.env.S3_FORCE_PATH_STYLE === "true";
}

function getObjectLockMode(defaultMode?: "governance" | "compliance") {
  const envMode = process.env.S3_OBJECT_LOCK_MODE?.trim().toUpperCase();
  if (envMode === "GOVERNANCE" || envMode === "COMPLIANCE") {
    return envMode;
  }

  if (defaultMode) {
    return defaultMode.toUpperCase();
  }

  return undefined;
}

function getObjectLockRetainUntil() {
  const retainDays = Number(process.env.S3_OBJECT_LOCK_DAYS ?? 0);

  if (!Number.isFinite(retainDays) || retainDays <= 0) {
    return null;
  }

  return new Date(Date.now() + retainDays * 24 * 60 * 60 * 1000).toISOString();
}

function toS3Metadata(
  metadata: Record<string, StoredObjectMetadataValue> | undefined,
) {
  if (!metadata) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(metadata)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) => [
        sanitizeSegment(key).replace(/\./g, "-"),
        String(value),
      ]),
  );
}

function getCredentials() {
  const accessKeyId = process.env.S3_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY?.trim();

  if (!accessKeyId || !secretAccessKey) {
    return undefined;
  }

  return {
    accessKeyId,
    secretAccessKey,
  };
}

declare global {
  var __metroTrailerS3Client: S3Client | undefined;
}

function getS3Client() {
  const region = getS3Region();
  if (!region) {
    return null;
  }

  if (!globalThis.__metroTrailerS3Client) {
    globalThis.__metroTrailerS3Client = new S3Client({
      region,
      endpoint: getS3Endpoint(),
      forcePathStyle: getS3ForcePathStyle(),
      credentials: getCredentials(),
    });
  }

  return globalThis.__metroTrailerS3Client;
}

export function isS3StorageEnabled() {
  return Boolean(getS3Bucket() && getS3Region());
}

export function buildDocumentStorageKey(options: {
  contractNumber: string;
  documentType: string;
  documentId: string;
  filename: string;
}) {
  return [
    getStoragePrefix(),
    "documents",
    sanitizeSegment(options.contractNumber),
    sanitizeSegment(options.documentType),
    options.documentId,
    sanitizeSegment(options.filename) || options.filename,
  ].join("/");
}

export function buildInvoiceStorageKey(invoiceNumber: string) {
  return [
    getStoragePrefix(),
    "invoices",
    sanitizeSegment(invoiceNumber),
    `${sanitizeSegment(invoiceNumber)}.pdf`,
  ].join("/");
}

export async function storeBuffer(options: StoreBufferOptions): Promise<StoredBufferResult> {
  const checksumSha256 = createHash("sha256")
    .update(options.body)
    .digest("hex");
  const bucket = getS3Bucket();
  const region = getS3Region();

  if (!bucket || !region) {
    return {
      contentBase64: options.body.toString("base64"),
      sizeBytes: options.body.byteLength,
      checksumSha256,
      storageProvider: "inline",
      storageBucket: null,
      storageKey: null,
      storageVersionId: null,
      storageETag: null,
      retentionUntil: null,
    };
  }

  const s3 = getS3Client();
  if (!s3) {
    throw new ApiError(500, "S3 client could not be initialized.");
  }

  const requestedObjectLockMode = getObjectLockMode(options.retentionMode);
  const retainUntil = requestedObjectLockMode ? getObjectLockRetainUntil() : null;
  const objectLockMode =
    requestedObjectLockMode && retainUntil ? requestedObjectLockMode : undefined;

  const response = await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: options.key,
      Body: options.body,
      ContentType: options.contentType,
      Metadata: toS3Metadata(options.metadata),
      ChecksumSHA256: createHash("sha256").update(options.body).digest("base64"),
      ServerSideEncryption: getS3ServerSideEncryption() as
        | "AES256"
        | "aws:kms"
        | undefined,
      SSEKMSKeyId: getS3KmsKeyId(),
      ObjectLockMode: objectLockMode as "COMPLIANCE" | "GOVERNANCE" | undefined,
      ObjectLockRetainUntilDate: retainUntil ? new Date(retainUntil) : undefined,
    }),
  );

  return {
    contentBase64: null,
    sizeBytes: options.body.byteLength,
    checksumSha256,
    storageProvider: "s3",
    storageBucket: bucket,
    storageKey: options.key,
    storageVersionId: response.VersionId ?? null,
    storageETag: response.ETag?.replace(/"/g, "") ?? null,
    retentionUntil: retainUntil,
  };
}

export async function fetchStoredBuffer(options: FetchStoredBufferOptions) {
  if (options.storageBucket && options.storageKey) {
    const s3 = getS3Client();
    if (!s3) {
      throw new ApiError(500, "S3 client could not be initialized.");
    }

    const response = await s3.send(
      new GetObjectCommand({
        Bucket: options.storageBucket,
        Key: options.storageKey,
        VersionId: options.storageVersionId ?? undefined,
      }),
    );

    const body = response.Body;
    if (!body || typeof body.transformToByteArray !== "function") {
      throw new ApiError(500, "Stored object body was unavailable.");
    }

    return Buffer.from(await body.transformToByteArray());
  }

  if (options.contentBase64) {
    return Buffer.from(options.contentBase64, "base64");
  }

  throw new ApiError(404, "Stored object content is unavailable.");
}

export async function fetchStoredBufferIfExists(options: {
  storageBucket: string;
  storageKey: string;
  storageVersionId?: string | null;
}) {
  try {
    return await fetchStoredBuffer(options);
  } catch (error) {
    if (
      error instanceof S3ServiceException &&
      (error.name === "NoSuchKey" || error.$metadata.httpStatusCode === 404)
    ) {
      return null;
    }

    throw error;
  }
}

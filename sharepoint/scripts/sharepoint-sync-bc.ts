import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import * as path from "node:path";

import { config as loadEnv } from "dotenv";

loadEnv();

type DocumentType = "Unknown" | "Registration" | "FHWA Inspection" | "Title" | "Other";
type MatchStatus = "Unknown" | "Matched" | "Unmatched" | "Ambiguous" | "Error";
type MatchedBy =
  | "None"
  | "AssetNo"
  | "ServiceItemNo"
  | "SerialVin"
  | "RegistrationNo"
  | "NumericFallback"
  | "Manual";
type SyncStatus = "Pending" | "Synced" | "Failed" | "Skipped" | "Removed";
type SyncRunStatus = "Running" | "Succeeded" | "PartialFailure" | "Failed";
type ErrorType = "Unknown" | "Validation" | "Matching" | "Api" | "Permission" | "Removed";

type GraphTokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
};

type GraphSite = {
  id: string;
  displayName?: string;
  webUrl?: string;
};

type GraphDrive = {
  id: string;
  name: string;
  webUrl?: string;
};

type GraphDriveItem = {
  id: string;
  name: string;
  webUrl?: string;
  size?: number;
  createdDateTime?: string;
  lastModifiedDateTime?: string;
  deleted?: unknown;
  file?: {
    mimeType?: string;
  };
  folder?: {
    childCount?: number;
  };
  parentReference?: {
    path?: string;
  };
};

type GraphCollectionResponse<TValue> = {
  value: TValue[];
  "@odata.nextLink"?: string;
  "@odata.deltaLink"?: string;
};

type FixedAssetRow = {
  No?: string | null;
  Description?: string | null;
  Make?: string | null;
  Vehicle_Year?: string | number | null;
  Serial_No?: string | null;
  Vehicle_Registration_No?: string | null;
  RMI_Service_Item_No?: string | null;
};

type FixedAsset = {
  assetNo: string;
  description: string;
  make: string;
  vehicleYear: string;
  serialVin: string;
  registrationNo: string;
  serviceItemNo: string;
  compactAssetNo: string;
  compactServiceItemNo: string;
  compactSerialVin: string;
  compactRegistrationNo: string;
  digitsAssetNo: string;
  digitsServiceItemNo: string;
};

type MatchResult = {
  status: MatchStatus;
  matchedBy: MatchedBy;
  fixedAssetNo: string;
  fixedAssetSystemId?: string;
  message: string;
};

type TrailerDocumentPayload = {
  sharePointItemId: string;
  driveId: string;
  siteId: string;
  folderId: string;
  folderName: string;
  folderUrl: string;
  fixedAssetNo: string;
  fixedAssetSystemId?: string;
  documentType: DocumentType;
  fileName: string;
  fileExtension: string;
  webUrl: string;
  lastModifiedAt?: string;
  createdAt?: string;
  fileSize: number;
  matchStatus: MatchStatus;
  matchedBy: MatchedBy;
  syncStatus: SyncStatus;
  lastSyncedAt?: string;
  sourceHash: string;
  lastError: string;
  active: boolean;
  removedAt?: string;
};

type ExistingDocument = TrailerDocumentPayload & {
  id: string;
};

type ExistingDocumentState = {
  byItemId: Map<string, ExistingDocument>;
  byFolderId: Map<string, ExistingDocument[]>;
  byFolderName: Map<string, ExistingDocument[]>;
};

type FolderSeenStatus = "Unknown" | "SeenWithDocuments" | "SeenEmpty" | "Failed";

type FolderStatePayload = {
  folderName: string;
  folderId: string;
  driveId: string;
  siteId: string;
  folderUrl: string;
  fixedAssetNo: string;
  seenStatus: FolderSeenStatus;
  lastFullTraversedAt?: string;
  lastDeltaRefreshedAt?: string;
  lastSuccessAt?: string;
  lastFailureAt?: string;
  lastError: string;
  lastItemCount: number;
  active: boolean;
};

type ExistingFolderState = FolderStatePayload & {
  id: string;
};

type ExistingFolderStateCache = {
  byFolderName: Map<string, ExistingFolderState>;
};

type SyncRunPayload = {
  runId: string;
  startedAt: string;
  finishedAt?: string;
  status: SyncRunStatus;
  mode: string;
  foldersSeen: number;
  recordsSeen: number;
  recordsInserted: number;
  recordsUpdated: number;
  recordsSkipped: number;
  recordsRemoved: number;
  recordsFailed: number;
  unmatchedCount: number;
  errorSummary: string;
  jobVersion: string;
};

type SyncErrorPayload = {
  runId: string;
  sharePointItemId: string;
  folderId: string;
  folderName: string;
  errorType: ErrorType;
  errorMessage: string;
  rawPayloadPointer: string;
  createdAt: string;
  resolved: boolean;
};

type BcCompany = {
  id: string;
  name?: string;
};

type SyncOptions = {
  write: boolean;
  delta: boolean;
  skipExistingFolders: boolean;
  limitFolders: number | null;
  folders: Set<string> | null;
  concurrency: number;
  summaryPath: string;
  deltaStatePath: string;
  backfillStatePath: string;
  maxDeltaPages: number;
  requestTimeoutMs: number;
  folderRetries: number;
  progressIntervalSeconds: number;
  bcHeartbeatSeconds: number;
  maxChildPages: number;
};

type DeltaState = {
  deltaLink: string;
  siteId: string;
  driveId: string;
  baseFolderPath: string;
  updatedAt: string;
};

type BackfillState = {
  siteId: string;
  driveId: string;
  baseFolderPath: string;
  totalQueued: number;
  pendingFolders: FolderRef[];
  seenEmptyFolders: string[];
  updatedAt: string;
};

type FolderRef = {
  id: string;
  name: string;
  webUrl: string;
  deleted: boolean;
  queueType?: "delta" | "backfill" | "targeted";
};

type SyncCounters = {
  foldersSeen: number;
  recordsSeen: number;
  recordsInserted: number;
  recordsUpdated: number;
  recordsSkipped: number;
  recordsRemoved: number;
  recordsFailed: number;
  unmatchedCount: number;
};

type BootstrapCounts = {
  documentBackedSeeded: number;
  emptySeeded: number;
  logSeeded: number;
  skippedExisting: number;
};

const GRAPH_BASE_URL = "https://graph.microsoft.com/v1.0";
const BC_BASE_URL = "https://api.businesscentral.dynamics.com/v2.0";
const DEFAULT_BASE_FOLDER = "FixedAssets";
const DEFAULT_CONCURRENCY = 10;
const DEFAULT_MAX_DELTA_PAGES = 20;
const DEFAULT_REQUEST_TIMEOUT_MS = 45000;
const DEFAULT_FOLDER_RETRIES = 2;
const DEFAULT_PROGRESS_INTERVAL_SECONDS = 15;
const DEFAULT_BC_HEARTBEAT_SECONDS = 60;
const DEFAULT_MAX_CHILD_PAGES = 250;
const DEFAULT_DELTA_STATE_PATH = path.join(
  process.cwd(),
  "artifacts",
  "sharepoint",
  "sharepoint-sync-state.json",
);
const DEFAULT_BACKFILL_STATE_PATH = path.join(
  process.cwd(),
  "artifacts",
  "sharepoint",
  "sharepoint-backfill-state.json",
);
const JOB_VERSION = "sharepoint-bc-sync/1.0.0";
const MAX_ERROR_SUMMARY_LENGTH = 2048;
let runtimeRequestTimeoutMs = DEFAULT_REQUEST_TIMEOUT_MS;

function requireFirstEnv(names: string[]) {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) {
      return value;
    }
  }

  throw new Error(`Missing required environment variable. Expected one of: ${names.join(", ")}`);
}

function getOptionalEnv(names: string[]) {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) {
      return value;
    }
  }

  return undefined;
}

function parsePositiveInteger(value: string, flagName: string) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${flagName} must be a positive integer.`);
  }

  return parsed;
}

function buildDefaultSummaryPath() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return path.join(
    process.cwd(),
    "artifacts",
    "sharepoint",
    `sharepoint-bc-sync-summary-${timestamp}.json`,
  );
}

function parseArgs(argv: string[]): SyncOptions {
  let write = false;
  let delta = false;
  let skipExistingFolders = false;
  let limitFolders: number | null = null;
  let folders: Set<string> | null = null;
  let concurrency = DEFAULT_CONCURRENCY;
  let summaryPath = buildDefaultSummaryPath();
  let deltaStatePath = DEFAULT_DELTA_STATE_PATH;
  let backfillStatePath = DEFAULT_BACKFILL_STATE_PATH;
  let maxDeltaPages = DEFAULT_MAX_DELTA_PAGES;
  let requestTimeoutMs = DEFAULT_REQUEST_TIMEOUT_MS;
  let folderRetries = DEFAULT_FOLDER_RETRIES;
  let progressIntervalSeconds = DEFAULT_PROGRESS_INTERVAL_SECONDS;
  let bcHeartbeatSeconds = DEFAULT_BC_HEARTBEAT_SECONDS;
  let maxChildPages = DEFAULT_MAX_CHILD_PAGES;

  for (const arg of argv) {
    if (arg === "--write") {
      write = true;
      continue;
    }

    if (arg === "--delta") {
      delta = true;
      continue;
    }

    if (arg === "--skip-existing-folders") {
      skipExistingFolders = true;
      continue;
    }

    if (arg.startsWith("--limit-folders=")) {
      limitFolders = parsePositiveInteger(arg.slice("--limit-folders=".length), "--limit-folders");
      continue;
    }

    if (arg.startsWith("--folders=")) {
      folders = new Set(
        arg
          .slice("--folders=".length)
          .split(",")
          .map((value) => value.trim().toUpperCase())
          .filter(Boolean),
      );
      continue;
    }

    if (arg.startsWith("--concurrency=")) {
      concurrency = parsePositiveInteger(arg.slice("--concurrency=".length), "--concurrency");
      continue;
    }

    if (arg.startsWith("--summary=")) {
      summaryPath = path.resolve(arg.slice("--summary=".length).trim());
      continue;
    }

    if (arg.startsWith("--delta-state=")) {
      deltaStatePath = path.resolve(arg.slice("--delta-state=".length).trim());
      continue;
    }

    if (arg.startsWith("--backfill-state=")) {
      backfillStatePath = path.resolve(arg.slice("--backfill-state=".length).trim());
      continue;
    }

    if (arg.startsWith("--max-delta-pages=")) {
      maxDeltaPages = parsePositiveInteger(arg.slice("--max-delta-pages=".length), "--max-delta-pages");
      continue;
    }

    if (arg.startsWith("--request-timeout-ms=")) {
      requestTimeoutMs = parsePositiveInteger(arg.slice("--request-timeout-ms=".length), "--request-timeout-ms");
      continue;
    }

    if (arg.startsWith("--folder-retries=")) {
      folderRetries = parsePositiveInteger(arg.slice("--folder-retries=".length), "--folder-retries");
      continue;
    }

    if (arg.startsWith("--progress-interval-seconds=")) {
      progressIntervalSeconds = parsePositiveInteger(
        arg.slice("--progress-interval-seconds=".length),
        "--progress-interval-seconds",
      );
      continue;
    }

    if (arg.startsWith("--bc-heartbeat-seconds=")) {
      bcHeartbeatSeconds = parsePositiveInteger(
        arg.slice("--bc-heartbeat-seconds=".length),
        "--bc-heartbeat-seconds",
      );
      continue;
    }

    if (arg.startsWith("--max-child-pages=")) {
      maxChildPages = parsePositiveInteger(arg.slice("--max-child-pages=".length), "--max-child-pages");
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return {
    write,
    delta,
    skipExistingFolders,
    limitFolders,
    folders,
    concurrency,
    summaryPath,
    deltaStatePath,
    backfillStatePath,
    maxDeltaPages,
    requestTimeoutMs,
    folderRetries,
    progressIntervalSeconds,
    bcHeartbeatSeconds,
    maxChildPages,
  };
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function clipText(value: string, maxLength: number) {
  return value.length <= maxLength ? value : value.slice(0, maxLength);
}

function compactValue(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

function normalizeFolderPath(folderPath: string) {
  return folderPath
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .join("/");
}

function encodeGraphPath(folderPath: string) {
  return normalizeFolderPath(folderPath)
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function escapeODataString(value: string) {
  return value.replace(/'/g, "''");
}

function normalizeBcDateTime(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const timestamp = Date.parse(trimmed);
  if (Number.isNaN(timestamp)) {
    return trimmed;
  }

  return new Date(Math.round(timestamp / 100) * 100).toISOString();
}

function getGraphTenantId() {
  return requireFirstEnv(["GRAPH_TENANT_ID", "METRO_GRAPH_TENANT_ID"]);
}

function getGraphClientId() {
  return requireFirstEnv(["GRAPH_CLIENT_ID", "METRO_GRAPH_CLIENT_ID"]);
}

function getGraphClientSecret() {
  return requireFirstEnv(["GRAPH_CLIENT_SECRET", "METRO_GRAPH_CLIENT_SECRET"]);
}

function getBcEnvironment() {
  return requireFirstEnv(["METRO_BC_ENVIRONMENT"]);
}

function getBcCompany() {
  return requireFirstEnv(["METRO_BC_COMPANY"]);
}

function getSharePointBaseFolderPath() {
  return normalizeFolderPath(
    getOptionalEnv(["SHAREPOINT_BASE_FOLDER_PATH", "METRO_SHAREPOINT_BASE_FOLDER"]) ??
      DEFAULT_BASE_FOLDER,
  );
}

function getTrailerDocsPublisher() {
  return process.env.METRO_BC_TRAILER_DOCS_API_PUBLISHER?.trim() || "metroTrailer";
}

function getTrailerDocsApiGroup() {
  return process.env.METRO_BC_TRAILER_DOCS_API_GROUP?.trim() || "trailerDocuments";
}

function getTrailerDocsApiVersion() {
  return process.env.METRO_BC_TRAILER_DOCS_API_VERSION?.trim() || "v1.0";
}

function buildBcBaseUrl() {
  return `${BC_BASE_URL}/${encodeURIComponent(getGraphTenantId())}/${encodeURIComponent(getBcEnvironment())}`;
}

function buildStandardApiBaseUrl() {
  return `${buildBcBaseUrl()}/api/v2.0`;
}

function buildCustomApiBaseUrl(companyId: string) {
  return `${buildBcBaseUrl()}/api/${encodeURIComponent(getTrailerDocsPublisher())}/${encodeURIComponent(getTrailerDocsApiGroup())}/${encodeURIComponent(getTrailerDocsApiVersion())}/companies(${companyId})`;
}

function buildODataBaseUrl() {
  return `${buildBcBaseUrl()}/ODataV4/Company('${encodeURIComponent(escapeODataString(getBcCompany()))}')`;
}

function detectDocumentType(fileName: string): DocumentType {
  const upper = fileName.toUpperCase();

  if (/(^|[_\-\s])R([_\-.]|$)/.test(upper) || upper.includes("REGISTRATION")) {
    return "Registration";
  }

  if (/(^|[_\-\s])I([_\-.]|$)/.test(upper) || upper.includes("INSPECTION") || upper.includes("FHWA")) {
    return "FHWA Inspection";
  }

  if (upper.includes("TITLE")) {
    return "Title";
  }

  return "Other";
}

function getFileExtension(fileName: string) {
  const dotIndex = fileName.lastIndexOf(".");
  if (dotIndex === -1) {
    return "";
  }

  return fileName.slice(dotIndex + 1).toUpperCase();
}

function stableHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function buildErrorSummary(messages: string[]) {
  let summary = "";
  for (const message of messages) {
    const next = summary ? `${summary} | ${message}` : message;
    if (next.length > MAX_ERROR_SUMMARY_LENGTH) {
      break;
    }

    summary = next;
  }

  return summary;
}

function normalizeComparableValue(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}T/.test(trimmed)) {
      const timestamp = Date.parse(trimmed);
      if (!Number.isNaN(timestamp)) {
        return timestamp;
      }
    }

    return trimmed;
  }

  return value;
}

async function sleep(milliseconds: number) {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function withRetry<TValue>(
  operation: () => Promise<TValue>,
  label: string,
  retries = 4,
) {
  let attempt = 0;
  let lastError: Error | null = null;

  while (attempt <= retries) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      attempt += 1;
      if (attempt > retries) {
        break;
      }

      await sleep(getRetryDelayMs(attempt, null, 1000, 12000));
    }
  }

  throw new Error(`${label} failed after ${retries + 1} attempts: ${lastError?.message ?? "unknown error"}`);
}

async function parseJsonResponse<TValue>(response: Response) {
  const text = await response.text();
  return {
    text,
    value: text.length > 0 ? (JSON.parse(text) as TValue) : null,
  };
}

function nowIso() {
  return new Date().toISOString();
}

function getRetryDelayMs(
  attempt: number,
  retryAfterHeader: string | null,
  baseDelayMs = 750,
  maxDelayMs = 15000,
) {
  if (retryAfterHeader) {
    const seconds = Number.parseInt(retryAfterHeader, 10);
    if (Number.isFinite(seconds) && seconds >= 0) {
      return Math.min(seconds * 1000, maxDelayMs);
    }

    const retryAt = Date.parse(retryAfterHeader);
    if (!Number.isNaN(retryAt)) {
      const delayMs = retryAt - Date.now();
      if (delayMs > 0) {
        return Math.min(delayMs, maxDelayMs);
      }
    }
  }

  return Math.min(baseDelayMs * 2 ** (attempt - 1), maxDelayMs);
}

type FetchWithRetryOptions = {
  retries?: number;
  timeoutMs?: number;
  label?: string;
};

async function fetchWithRetry(url: string, init: RequestInit, options?: FetchWithRetryOptions) {
  const retries = options?.retries ?? 5;
  const timeoutMs = options?.timeoutMs ?? runtimeRequestTimeoutMs;
  const label = options?.label ?? url;
  let attempt = 0;
  let lastError: Error | null = null;

  while (attempt <= retries) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort(new Error(`Request timed out after ${timeoutMs}ms for ${label}`));
    }, timeoutMs);

    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (![429, 503, 504].includes(response.status)) {
        return response;
      }

      lastError = new Error(`Request throttled with status ${response.status} for ${label}.`);

      const retryDelayMs = getRetryDelayMs(attempt + 1, response.headers.get("Retry-After"));
      attempt += 1;
      if (attempt > retries) {
        break;
      }

      await sleep(retryDelayMs);
      continue;
    } catch (error) {
      clearTimeout(timeoutId);
      lastError =
        error instanceof Error
          ? error
          : new Error(`Request failed for ${label}: ${String(error)}`);
    }

    attempt += 1;
    if (attempt > retries) {
      break;
    }

    await sleep(getRetryDelayMs(attempt, null));
  }

  throw lastError ?? new Error("Request failed.");
}

class GraphClient {
  private accessToken: string | null = null;

  private invalidateAccessToken() {
    this.accessToken = null;
  }

  async getAccessToken() {
    if (this.accessToken) {
      return this.accessToken;
    }

    const response = await fetchWithRetry(
      `https://login.microsoftonline.com/${encodeURIComponent(getGraphTenantId())}/oauth2/v2.0/token`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: getGraphClientId(),
          client_secret: getGraphClientSecret(),
          scope: "https://graph.microsoft.com/.default",
          grant_type: "client_credentials",
        }),
      },
    );

    const payload = await parseJsonResponse<GraphTokenResponse>(response);
    if (!response.ok || !payload.value?.access_token) {
      throw new Error(
        `Graph authentication failed (${response.status}): ${payload.value?.error_description ?? payload.value?.error ?? payload.text}`,
      );
    }

    this.accessToken = payload.value.access_token;
    return this.accessToken;
  }

  private async requestJson<TValue>(resourcePathOrUrl: string, allowNotFound = false) {
    const url = resourcePathOrUrl.startsWith("http")
      ? resourcePathOrUrl
      : `${GRAPH_BASE_URL}${resourcePathOrUrl}`;
    let attemptedRefresh = false;

    while (true) {
      const token = await this.getAccessToken();
      const response = await fetchWithRetry(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        cache: "no-store",
      });

      if (response.status === 404 && allowNotFound) {
        return null;
      }

      const payload = await parseJsonResponse<TValue>(response);
      if (response.ok) {
        return payload.value as TValue;
      }

      if (!attemptedRefresh && [401, 403].includes(response.status)) {
        attemptedRefresh = true;
        this.invalidateAccessToken();
        continue;
      }

      throw new Error(`Graph request failed (${response.status}) for ${url}: ${payload.text}`);
    }
  }

  async resolveSite() {
    const configuredSiteId = getOptionalEnv(["SHAREPOINT_SITE_ID", "METRO_SHAREPOINT_SITE_ID"]);
    if (configuredSiteId) {
      return this.requestJson<GraphSite>(
        `/sites/${encodeURIComponent(configuredSiteId)}?$select=id,displayName,webUrl`,
      );
    }

    const hostname = requireFirstEnv(["SHAREPOINT_HOSTNAME", "METRO_SHAREPOINT_HOSTNAME"]);
    const sitePath = getOptionalEnv(["SHAREPOINT_SITE_PATH", "METRO_SHAREPOINT_SITE_PATH"]);
    if (sitePath) {
      const normalizedPath = sitePath.startsWith("/") ? sitePath : `/${sitePath}`;
      const encodedPath = normalizedPath
        .split("/")
        .map((segment, index) => (index === 0 ? segment : encodeURIComponent(segment)))
        .join("/");

      return this.requestJson<GraphSite>(
        `/sites/${hostname}:${encodedPath}?$select=id,displayName,webUrl`,
      );
    }

    return this.requestJson<GraphSite>(
      `/sites/${hostname}:?$select=id,displayName,webUrl`,
    );
  }

  async resolveDrive(siteId: string) {
    const configuredDriveId = getOptionalEnv(["SHAREPOINT_DRIVE_ID", "METRO_SHAREPOINT_DRIVE_ID"]);
    if (configuredDriveId) {
      return this.requestJson<GraphDrive>(
        `/drives/${encodeURIComponent(configuredDriveId)}?$select=id,name,webUrl`,
      );
    }

    const libraryName = requireFirstEnv(["SHAREPOINT_LIBRARY_NAME", "METRO_SHAREPOINT_LIBRARY_NAME"]);
    const payload = await this.requestJson<GraphCollectionResponse<GraphDrive>>(
      `/sites/${encodeURIComponent(siteId)}/drives?$select=id,name,webUrl`,
    );

    const match =
      payload.value.find((drive) => drive.name.trim().toLowerCase() === libraryName.trim().toLowerCase()) ??
      null;

    if (!match) {
      throw new Error(`Could not find SharePoint drive/library named "${libraryName}".`);
    }

    return match;
  }

  async listChildrenByPath(driveId: string, folderPath: string, maxPages = DEFAULT_MAX_CHILD_PAGES) {
    const items: GraphDriveItem[] = [];
    let nextUrl:
      | string
      | undefined = `/drives/${encodeURIComponent(driveId)}/root:/${encodeGraphPath(folderPath)}:/children?$top=999&$select=id,name,webUrl,size,createdDateTime,lastModifiedDateTime,file,folder,parentReference,deleted`;
    const seenUrls = new Set<string>();
    let pagesRead = 0;

    while (nextUrl) {
      if (seenUrls.has(nextUrl)) {
        throw new Error(`Graph children paging loop detected for path ${folderPath}.`);
      }
      seenUrls.add(nextUrl);
      pagesRead += 1;
      if (pagesRead > maxPages) {
        throw new Error(`Graph children page limit exceeded for path ${folderPath} (${maxPages} pages).`);
      }

      const payload = await this.requestJson<GraphCollectionResponse<GraphDriveItem>>(nextUrl);
      items.push(...payload.value);
      nextUrl = payload["@odata.nextLink"];
    }

    return items;
  }

  async listChildrenByItemId(driveId: string, itemId: string, maxPages = DEFAULT_MAX_CHILD_PAGES) {
    const items: GraphDriveItem[] = [];
    let nextUrl:
      | string
      | undefined = `/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(itemId)}/children?$top=999&$select=id,name,webUrl,size,createdDateTime,lastModifiedDateTime,file,folder,parentReference,deleted`;
    const seenUrls = new Set<string>();
    let pagesRead = 0;

    while (nextUrl) {
      if (seenUrls.has(nextUrl)) {
        throw new Error(`Graph children paging loop detected for item ${itemId}.`);
      }
      seenUrls.add(nextUrl);
      pagesRead += 1;
      if (pagesRead > maxPages) {
        throw new Error(`Graph children page limit exceeded for item ${itemId} (${maxPages} pages).`);
      }

      const payload = await this.requestJson<GraphCollectionResponse<GraphDriveItem>>(nextUrl);
      items.push(...payload.value);
      nextUrl = payload["@odata.nextLink"];
    }

    return items;
  }

  async getItemByPath(driveId: string, folderPath: string) {
    return this.requestJson<GraphDriveItem>(
      `/drives/${encodeURIComponent(driveId)}/root:/${encodeGraphPath(folderPath)}?$select=id,name,webUrl,folder,parentReference`,
    );
  }

  async tryGetItemByPath(driveId: string, folderPath: string) {
    return this.requestJson<GraphDriveItem>(
      `/drives/${encodeURIComponent(driveId)}/root:/${encodeGraphPath(folderPath)}?$select=id,name,webUrl,folder,parentReference`,
      true,
    );
  }

  async getLatestRootDeltaLink(driveId: string) {
    const payload = await this.requestJson<{ "@odata.deltaLink"?: string }>(
      `/drives/${encodeURIComponent(driveId)}/root/delta?token=latest`,
    );

    const deltaLink = payload["@odata.deltaLink"]?.trim();
    if (!deltaLink) {
      throw new Error("Graph did not return a root delta link.");
    }

    return deltaLink;
  }

  async getChangedFolderRefs(
    deltaLink: string,
    baseFolderPath: string,
    maxPages: number,
  ) {
    const folderMap = new Map<string, FolderRef>();
    const baseFolderName = baseFolderPath.split("/").pop()?.toLowerCase() || DEFAULT_BASE_FOLDER.toLowerCase();
    let nextUrl: string | undefined = deltaLink;
    let pages = 0;
    let latestDeltaLink = deltaLink;

    while (nextUrl && pages < maxPages) {
      const payload = await this.requestJson<GraphCollectionResponse<GraphDriveItem>>(nextUrl);
      pages += 1;

      for (const item of payload.value) {
        const folderName = extractFolderNameFromDeltaItem(item, baseFolderName);
        if (!folderName) {
          continue;
        }

        const key = compactValue(folderName);
        folderMap.set(key, {
          id: item.folder ? item.id : "",
          name: folderName,
          webUrl: normalizeText(item.webUrl),
          deleted: Boolean(item.deleted),
        });
      }

      nextUrl = payload["@odata.nextLink"];
      latestDeltaLink = payload["@odata.deltaLink"] ?? latestDeltaLink;
    }

    return {
      folders: Array.from(folderMap.values()),
      latestDeltaLink,
      pagesRead: pages,
    };
  }
}

function extractFolderNameFromDeltaItem(item: GraphDriveItem, baseFolderName: string) {
  const parentPath = normalizeText(item.parentReference?.path);
  const normalizedParentPath = parentPath.toLowerCase();
  const needle = `/root:/${baseFolderName}`;
  const position = normalizedParentPath.indexOf(needle);
  if (position === -1) {
    return null;
  }

  const relative = parentPath.slice(position + needle.length).replace(/^\/+/, "");
  if (!relative) {
    return item.folder ? item.name : null;
  }

  const [folderName] = relative.split("/");
  return folderName || null;
}

class FixedAssetMatcher {
  private readonly exactAssetNo = new Map<string, FixedAsset[]>();
  private readonly exactServiceItem = new Map<string, FixedAsset[]>();
  private readonly exactSerial = new Map<string, FixedAsset[]>();
  private readonly exactRegistration = new Map<string, FixedAsset[]>();
  private readonly digitsAssetNo = new Map<string, FixedAsset[]>();
  private readonly digitsServiceItem = new Map<string, FixedAsset[]>();

  constructor(private readonly assets: FixedAsset[]) {
    for (const asset of assets) {
      this.addIndex(this.exactAssetNo, asset.compactAssetNo, asset);
      this.addIndex(this.exactServiceItem, asset.compactServiceItemNo, asset);
      this.addIndex(this.exactSerial, asset.compactSerialVin, asset);
      this.addIndex(this.exactRegistration, asset.compactRegistrationNo, asset);
      this.addIndex(this.digitsAssetNo, asset.digitsAssetNo, asset);
      this.addIndex(this.digitsServiceItem, asset.digitsServiceItemNo, asset);
    }
  }

  private addIndex(map: Map<string, FixedAsset[]>, key: string, asset: FixedAsset) {
    if (!key) {
      return;
    }

    const bucket = map.get(key);
    if (bucket) {
      bucket.push(asset);
    } else {
      map.set(key, [asset]);
    }
  }

  private resolveUnique(assets: FixedAsset[] | undefined, matchedBy: MatchedBy, message: string): MatchResult | null {
    if (!assets || assets.length === 0) {
      return null;
    }

    if (assets.length > 1) {
      return {
        status: "Ambiguous",
        matchedBy,
        fixedAssetNo: "",
        message,
      };
    }

    return {
      status: "Matched",
      matchedBy,
      fixedAssetNo: assets[0].assetNo,
      message,
    };
  }

  match(folderName: string): MatchResult {
    const compactFolderName = compactValue(folderName);
    if (!compactFolderName) {
      return {
        status: "Unmatched",
        matchedBy: "None",
        fixedAssetNo: "",
        message: "Folder name is blank after normalization.",
      };
    }

    const exactChecks: Array<[Map<string, FixedAsset[]>, MatchedBy, string]> = [
      [this.exactAssetNo, "AssetNo", "Matched by FixedAssets.No"],
      [this.exactServiceItem, "ServiceItemNo", "Matched by FixedAssets.RMI_Service_Item_No"],
      [this.exactSerial, "SerialVin", "Matched by FixedAssets.Serial_No"],
      [this.exactRegistration, "RegistrationNo", "Matched by FixedAssets.Vehicle_Registration_No"],
    ];

    for (const [map, matchedBy, message] of exactChecks) {
      const result = this.resolveUnique(map.get(compactFolderName), matchedBy, message);
      if (result) {
        return result;
      }
    }

    const numericFolderName = digitsOnly(folderName);
    if (numericFolderName.length >= 4) {
      const numericChecks: Array<[Map<string, FixedAsset[]>, string]> = [
        [this.digitsAssetNo, "Matched by numeric fallback on FixedAssets.No"],
        [this.digitsServiceItem, "Matched by numeric fallback on FixedAssets.RMI_Service_Item_No"],
      ];

      for (const [map, message] of numericChecks) {
        const result = this.resolveUnique(map.get(numericFolderName), "NumericFallback", message);
        if (result) {
          return result;
        }
      }
    }

    const scoredCandidates = new Map<string, { asset: FixedAsset; score: number }>();

    for (const asset of this.assets) {
      const bestScore = scoreFallbackMatch(asset, compactFolderName, numericFolderName);
      if (bestScore <= 0) {
        continue;
      }

      const existing = scoredCandidates.get(asset.assetNo);
      if (!existing || bestScore > existing.score) {
        scoredCandidates.set(asset.assetNo, { asset, score: bestScore });
      }
    }

    if (scoredCandidates.size === 0) {
      return {
        status: "Unmatched",
        matchedBy: "None",
        fixedAssetNo: "",
        message: "No BC fixed asset match was found for the SharePoint folder.",
      };
    }

    const ordered = Array.from(scoredCandidates.values()).sort((left, right) => right.score - left.score);
    const bestScore = ordered[0].score;
    const bestCandidates = ordered.filter((entry) => entry.score === bestScore);

    if (bestCandidates.length !== 1) {
      return {
        status: "Ambiguous",
        matchedBy: "NumericFallback",
        fixedAssetNo: "",
        message: `SharePoint folder matched ${bestCandidates.length} possible BC fixed assets.`,
      };
    }

    return {
      status: "Matched",
      matchedBy: "NumericFallback",
      fixedAssetNo: bestCandidates[0].asset.assetNo,
      message: "Matched by unique fallback candidate.",
    };
  }
}

function scoreFallbackMatch(asset: FixedAsset, compactFolderName: string, numericFolderName: string) {
  let bestScore = 0;

  if (asset.compactAssetNo.startsWith(compactFolderName) || asset.compactServiceItemNo.startsWith(compactFolderName)) {
    bestScore = Math.max(bestScore, 400);
  }

  if (asset.compactSerialVin.endsWith(compactFolderName) || asset.compactRegistrationNo.endsWith(compactFolderName)) {
    bestScore = Math.max(bestScore, 350);
  }

  if (
    numericFolderName.length >= 4 &&
    (asset.compactAssetNo.includes(numericFolderName) || asset.compactServiceItemNo.includes(numericFolderName))
  ) {
    bestScore = Math.max(bestScore, 320);
  }

  if (
    compactFolderName.length >= 6 &&
    (asset.compactSerialVin.includes(compactFolderName) || asset.compactRegistrationNo.includes(compactFolderName))
  ) {
    bestScore = Math.max(bestScore, 280);
  }

  return bestScore;
}

function isDuplicateKeyError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("Internal_EntityWithSameKeyExists") || message.includes("already exists");
}

class BusinessCentralClient {
  private accessToken: string | null = null;
  private companyId: string | null = null;
  private existingDocumentCache: ExistingDocumentState | null = null;
  private existingFolderStateCache: ExistingFolderStateCache | null = null;

  private invalidateAuthState(resetCompanyId = false) {
    this.accessToken = null;
    if (resetCompanyId) {
      this.companyId = null;
    }
  }

  private removeCachedDocumentFromBuckets(document: ExistingDocument) {
    if (!this.existingDocumentCache) {
      return;
    }

    const removeFromBucket = (map: Map<string, ExistingDocument[]>, key: string) => {
      if (!key) {
        return;
      }

      const bucket = map.get(key);
      if (!bucket) {
        return;
      }

      const nextBucket = bucket.filter((entry) => entry.sharePointItemId !== document.sharePointItemId);
      if (nextBucket.length > 0) {
        map.set(key, nextBucket);
      } else {
        map.delete(key);
      }
    };

    removeFromBucket(this.existingDocumentCache.byFolderId, document.folderId);
    removeFromBucket(this.existingDocumentCache.byFolderName, document.folderName.toUpperCase());
  }

  private upsertCachedDocument(document: ExistingDocument) {
    if (!this.existingDocumentCache) {
      return;
    }

    const existing = this.existingDocumentCache.byItemId.get(document.sharePointItemId);
    if (existing) {
      this.removeCachedDocumentFromBuckets(existing);
    }

    this.existingDocumentCache.byItemId.set(document.sharePointItemId, document);
    addToBucket(this.existingDocumentCache.byFolderId, document.folderId, document);
    addToBucket(this.existingDocumentCache.byFolderName, document.folderName.toUpperCase(), document);
  }

  private upsertCachedFolderState(folderState: ExistingFolderState) {
    if (!this.existingFolderStateCache) {
      return;
    }

    this.existingFolderStateCache.byFolderName.set(folderState.folderName.toUpperCase(), folderState);
  }

  async getAccessToken() {
    if (this.accessToken) {
      return this.accessToken;
    }

    const response = await fetchWithRetry(
      `https://login.microsoftonline.com/${encodeURIComponent(getGraphTenantId())}/oauth2/v2.0/token`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: getGraphClientId(),
          client_secret: getGraphClientSecret(),
          grant_type: "client_credentials",
          scope: "https://api.businesscentral.dynamics.com/.default",
        }),
      },
    );

    const payload = await parseJsonResponse<{ access_token?: string; error_description?: string }>(response);
    if (!response.ok || !payload.value?.access_token) {
      throw new Error(
        `Business Central authentication failed (${response.status}): ${payload.value?.error_description ?? payload.text}`,
      );
    }

    this.accessToken = payload.value.access_token;
    return this.accessToken;
  }

  async getCompanyId() {
    if (this.companyId) {
      return this.companyId;
    }

    const configured = process.env.METRO_BC_COMPANY_ID?.trim();
    if (configured) {
      this.companyId = configured;
      return configured;
    }

    const token = await this.getAccessToken();
    const url = new URL(`${buildStandardApiBaseUrl()}/companies`);
    url.searchParams.set("$select", "id,name");
    url.searchParams.set("$top", "200");

    const response = await fetchWithRetry(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });

    const payload = await parseJsonResponse<{ value?: BcCompany[] }>(response);
    if (!response.ok) {
      throw new Error(`Failed to retrieve Business Central companies (${response.status}): ${payload.text}`);
    }

    const companyName = getBcCompany().trim().toLowerCase();
    const match = payload.value?.value?.find((company) => company.name?.trim().toLowerCase() === companyName) ?? null;
    if (!match?.id) {
      throw new Error(`Business Central company "${getBcCompany()}" was not found.`);
    }

    this.companyId = match.id;
    return match.id;
  }

  private async requestJson<TValue>(url: string, init?: RequestInit) {
    let attemptedRefresh = false;

    while (true) {
      const token = await this.getAccessToken();
      const response = await fetchWithRetry(url, {
        ...init,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          ...(init?.body ? { "Content-Type": "application/json" } : {}),
          ...(init?.headers ?? {}),
        },
      });

      const payload = await parseJsonResponse<TValue>(response);
      if (response.ok) {
        return payload.value as TValue;
      }

      if (!attemptedRefresh && [401, 403].includes(response.status)) {
        attemptedRefresh = true;
        this.invalidateAuthState(true);
        continue;
      }

      throw new Error(`Business Central request failed (${response.status}) for ${url}: ${payload.text}`);
    }
  }

  async loadFixedAssets() {
    const rows: FixedAsset[] = [];
    let skip = 0;
    const pageSize = 1000;
    let nextUrl: string | null = `${buildODataBaseUrl()}/FixedAssets?$select=No,Description,Make,Vehicle_Year,Serial_No,Vehicle_Registration_No,RMI_Service_Item_No&$top=${pageSize}`;

    while (nextUrl) {
      const payload = await this.requestJson<{ value?: FixedAssetRow[]; "@odata.nextLink"?: string }>(nextUrl);
      const batch = payload.value ?? [];

      for (const row of batch) {
        const assetNo = normalizeText(row.No);
        if (!assetNo) {
          continue;
        }

        const serviceItemNo = normalizeText(row.RMI_Service_Item_No);
        const serialVin = normalizeText(row.Serial_No);
        const registrationNo = normalizeText(row.Vehicle_Registration_No);

        rows.push({
          assetNo,
          description: normalizeText(row.Description),
          make: normalizeText(row.Make),
          vehicleYear: normalizeText(row.Vehicle_Year),
          serialVin,
          registrationNo,
          serviceItemNo,
          compactAssetNo: compactValue(assetNo),
          compactServiceItemNo: compactValue(serviceItemNo),
          compactSerialVin: compactValue(serialVin),
          compactRegistrationNo: compactValue(registrationNo),
          digitsAssetNo: digitsOnly(assetNo),
          digitsServiceItemNo: digitsOnly(serviceItemNo),
        });
      }

      if (typeof payload["@odata.nextLink"] === "string" && payload["@odata.nextLink"]) {
        nextUrl = payload["@odata.nextLink"];
      } else if (batch.length === pageSize) {
        skip += pageSize;
        nextUrl = `${buildODataBaseUrl()}/FixedAssets?$select=No,Description,Make,Vehicle_Year,Serial_No,Vehicle_Registration_No,RMI_Service_Item_No&$top=${pageSize}&$skip=${skip}`;
      } else {
        nextUrl = null;
      }
    }

    return rows;
  }

  async listExistingDocuments() {
    if (this.existingDocumentCache) {
      return this.existingDocumentCache;
    }

    const companyId = await this.getCompanyId();
    const state: ExistingDocumentState = {
      byItemId: new Map(),
      byFolderId: new Map(),
      byFolderName: new Map(),
    };

    let nextUrl: string | null = `${buildCustomApiBaseUrl(companyId)}/trailerDocuments`;
    while (nextUrl) {
      const url = new URL(nextUrl);
      if (!url.searchParams.has("$top")) {
        url.searchParams.set("$top", "1000");
      }

      const payload = await this.requestJson<{
        value?: ExistingDocument[];
        "@odata.nextLink"?: string;
      }>(url.toString());

      for (const row of payload.value ?? []) {
        state.byItemId.set(row.sharePointItemId, row);
        addToBucket(state.byFolderId, row.folderId, row);
        addToBucket(state.byFolderName, row.folderName.toUpperCase(), row);
      }

      nextUrl = typeof payload["@odata.nextLink"] === "string" ? payload["@odata.nextLink"] : null;
    }

    this.existingDocumentCache = state;
    return state;
  }

  async listFolderStates() {
    if (this.existingFolderStateCache) {
      return this.existingFolderStateCache;
    }

    const companyId = await this.getCompanyId();
    const state: ExistingFolderStateCache = {
      byFolderName: new Map(),
    };

    let nextUrl: string | null = `${buildCustomApiBaseUrl(companyId)}/trailerFolderStates`;
    while (nextUrl) {
      const url = new URL(nextUrl);
      if (!url.searchParams.has("$top")) {
        url.searchParams.set("$top", "1000");
      }

      const payload = await this.requestJson<{
        value?: ExistingFolderState[];
        "@odata.nextLink"?: string;
      }>(url.toString());

      for (const row of payload.value ?? []) {
        state.byFolderName.set(row.folderName.toUpperCase(), row);
      }

      nextUrl = typeof payload["@odata.nextLink"] === "string" ? payload["@odata.nextLink"] : null;
    }

    this.existingFolderStateCache = state;
    return state;
  }

  async findFolderStateByFolderName(folderName: string) {
    const companyId = await this.getCompanyId();
    const url = new URL(`${buildCustomApiBaseUrl(companyId)}/trailerFolderStates`);
    url.searchParams.set("$filter", `folderName eq '${escapeODataString(folderName)}'`);
    url.searchParams.set("$top", "2");

    const payload = await this.requestJson<{ value?: ExistingFolderState[] }>(url.toString());
    return payload.value?.[0] ?? null;
  }

  async findDocumentBySharePointItemId(sharePointItemId: string) {
    const companyId = await this.getCompanyId();
    const url = new URL(`${buildCustomApiBaseUrl(companyId)}/trailerDocuments`);
    url.searchParams.set("$filter", `sharePointItemId eq '${escapeODataString(sharePointItemId)}'`);
    url.searchParams.set("$top", "2");

    const payload = await this.requestJson<{ value?: ExistingDocument[] }>(url.toString());
    return payload.value?.[0] ?? null;
  }

  async createSyncRun(payload: SyncRunPayload) {
    const companyId = await this.getCompanyId();
    return this.requestJson<{ id: string }>(`${buildCustomApiBaseUrl(companyId)}/trailerDocumentSyncRuns`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async updateSyncRun(id: string, payload: Partial<SyncRunPayload>) {
    const companyId = await this.getCompanyId();
    await withRetry(
      () =>
        this.requestJson(`${buildCustomApiBaseUrl(companyId)}/trailerDocumentSyncRuns(${id})`, {
          method: "PATCH",
          body: JSON.stringify(payload),
          headers: {
            "If-Match": "*",
          },
        }),
      `Business Central sync run update ${id}`,
      5,
    );
  }

  async safeUpdateSyncRun(id: string, payload: Partial<SyncRunPayload>) {
    try {
      await this.updateSyncRun(id, payload);
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  }

  async safeLogSyncError(payload: SyncErrorPayload) {
    try {
      await this.logSyncError(payload);
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  }

  async safeWriteDeltaState(deltaStatePath: string, payload: DeltaState) {
    try {
      await writeDeltaState(deltaStatePath, payload);
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  }

  async safeWriteSummary(summaryPath: string, payload: Record<string, unknown>) {
    try {
      await writeSummary(summaryPath, payload);
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  }

  async logSyncError(payload: SyncErrorPayload) {
    const companyId = await this.getCompanyId();
    await this.requestJson(`${buildCustomApiBaseUrl(companyId)}/trailerDocumentSyncErrors`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async upsertFolderState(payload: FolderStatePayload) {
    const state = await this.listFolderStates();
    const existing = state.byFolderName.get(payload.folderName.toUpperCase()) ?? null;

    if (!existing) {
      try {
        const companyId = await this.getCompanyId();
        const created = await this.requestJson<{ id?: string }>(
          `${buildCustomApiBaseUrl(companyId)}/trailerFolderStates`,
          {
            method: "POST",
            body: JSON.stringify(payload),
          },
        );
        if (created?.id) {
          this.upsertCachedFolderState({
            id: created.id,
            ...payload,
          });
        } else {
          this.existingFolderStateCache = null;
        }
        return "inserted" as const;
      } catch (error) {
        if (!isDuplicateKeyError(error)) {
          throw error;
        }

        this.existingFolderStateCache = null;
        const duplicateExisting = await this.findFolderStateByFolderName(payload.folderName);
        if (!duplicateExisting) {
          throw error;
        }

        if (!folderStateNeedsUpdate(duplicateExisting, payload)) {
          return "skipped" as const;
        }

        const companyId = await this.getCompanyId();
        await this.requestJson(`${buildCustomApiBaseUrl(companyId)}/trailerFolderStates(${duplicateExisting.id})`, {
          method: "PATCH",
          body: JSON.stringify(payload),
          headers: {
            "If-Match": "*",
          },
        });
        this.upsertCachedFolderState({
          ...duplicateExisting,
          ...payload,
        });
        return "updated" as const;
      }
    }

    if (!folderStateNeedsUpdate(existing, payload)) {
      return "skipped" as const;
    }

    const companyId = await this.getCompanyId();
    await this.requestJson(`${buildCustomApiBaseUrl(companyId)}/trailerFolderStates(${existing.id})`, {
      method: "PATCH",
      body: JSON.stringify(payload),
      headers: {
        "If-Match": "*",
      },
    });
    this.upsertCachedFolderState({
      ...existing,
      ...payload,
    });
    return "updated" as const;
  }

  async safeUpsertFolderState(payload: FolderStatePayload) {
    try {
      return await this.upsertFolderState(payload);
    } catch (error) {
      throw error;
    }
  }

  async upsertDocument(payload: TrailerDocumentPayload) {
    const existingState = await this.listExistingDocuments();
    const existing = existingState.byItemId.get(payload.sharePointItemId) ?? null;

    if (!existing) {
      try {
        const companyId = await this.getCompanyId();
        const created = await this.requestJson<{ id?: string }>(`${buildCustomApiBaseUrl(companyId)}/trailerDocuments`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        if (created?.id) {
          this.upsertCachedDocument({
            id: created.id,
            ...payload,
          });
        } else {
          this.existingDocumentCache = null;
        }
        return "inserted" as const;
      } catch (error) {
        if (!isDuplicateKeyError(error)) {
          throw error;
        }

        this.existingDocumentCache = null;
        const duplicateExisting = await this.findDocumentBySharePointItemId(payload.sharePointItemId);
        if (!duplicateExisting) {
          throw error;
        }

        if (!documentNeedsUpdate(duplicateExisting, payload)) {
          return "skipped" as const;
        }

        const companyId = await this.getCompanyId();
        await this.requestJson(`${buildCustomApiBaseUrl(companyId)}/trailerDocuments(${duplicateExisting.id})`, {
          method: "PATCH",
          body: JSON.stringify(payload),
          headers: {
            "If-Match": "*",
          },
        });
        this.upsertCachedDocument({
          ...duplicateExisting,
          ...payload,
        });
        return "updated" as const;
      }
    }

    if (!documentNeedsUpdate(existing, payload)) {
      return "skipped" as const;
    }

    const companyId = await this.getCompanyId();
    await this.requestJson(`${buildCustomApiBaseUrl(companyId)}/trailerDocuments(${existing.id})`, {
      method: "PATCH",
      body: JSON.stringify(payload),
      headers: {
        "If-Match": "*",
      },
    });
    this.upsertCachedDocument({
      ...existing,
      ...payload,
    });
    return "updated" as const;
  }

  async markDocumentRemoved(existing: ExistingDocument, syncedAt: string) {
    if (!existing.active) {
      return "skipped" as const;
    }

    const companyId = await this.getCompanyId();
    const payload: Partial<TrailerDocumentPayload> = {
      active: false,
      syncStatus: "Removed",
      removedAt: syncedAt,
      lastSyncedAt: syncedAt,
      lastError: "Document removed from SharePoint.",
    };

    await this.requestJson(`${buildCustomApiBaseUrl(companyId)}/trailerDocuments(${existing.id})`, {
      method: "PATCH",
      body: JSON.stringify(payload),
      headers: {
        "If-Match": "*",
      },
    });
    this.upsertCachedDocument({
      ...existing,
      ...payload,
    });
    return "removed" as const;
  }
}

function addToBucket<TKey, TValue>(map: Map<TKey, TValue[]>, key: TKey, value: TValue) {
  const bucket = map.get(key);
  if (bucket) {
    bucket.push(value);
  } else {
    map.set(key, [value]);
  }
}

function documentNeedsUpdate(existing: ExistingDocument, incoming: TrailerDocumentPayload) {
  const comparableKeys: Array<keyof TrailerDocumentPayload> = [
    "sharePointItemId",
    "driveId",
    "siteId",
    "folderId",
    "folderName",
    "folderUrl",
    "fixedAssetNo",
    "fixedAssetSystemId",
    "documentType",
    "fileName",
    "fileExtension",
    "webUrl",
    "lastModifiedAt",
    "createdAt",
    "fileSize",
    "matchStatus",
    "matchedBy",
    "syncStatus",
    "sourceHash",
    "lastError",
    "active",
    "removedAt",
  ];

  return comparableKeys.some(
    (key) => normalizeComparableValue(existing[key]) !== normalizeComparableValue(incoming[key]),
  );
}

function folderStateNeedsUpdate(existing: ExistingFolderState, incoming: FolderStatePayload) {
  const comparableKeys: Array<keyof FolderStatePayload> = [
    "folderName",
    "folderId",
    "driveId",
    "siteId",
    "folderUrl",
    "fixedAssetNo",
    "seenStatus",
    "lastFullTraversedAt",
    "lastDeltaRefreshedAt",
    "lastSuccessAt",
    "lastFailureAt",
    "lastError",
    "lastItemCount",
    "active",
  ];

  return comparableKeys.some(
    (key) => normalizeComparableValue(existing[key]) !== normalizeComparableValue(incoming[key]),
  );
}

function buildFolderStatePayload(args: {
  folder: FolderRef;
  siteId: string;
  driveId: string;
  match: MatchResult;
  seenStatus: FolderSeenStatus;
  syncedAt: string;
  itemCount: number;
  lastError: string;
  active: boolean;
}) {
  const isDeltaRefresh = args.folder.queueType === "delta";

  return {
    folderName: clipText(args.folder.name, 100),
    folderId: clipText(args.folder.id, 120),
    driveId: clipText(args.driveId, 120),
    siteId: clipText(args.siteId, 120),
    folderUrl: clipText(args.folder.webUrl, 2048),
    fixedAssetNo: clipText(args.match.fixedAssetNo, 50),
    seenStatus: args.seenStatus,
    lastFullTraversedAt: args.active ? args.syncedAt : undefined,
    lastDeltaRefreshedAt: isDeltaRefresh && args.active ? args.syncedAt : undefined,
    lastSuccessAt: args.active && isSuccessfulSeenStatus(args.seenStatus) ? args.syncedAt : undefined,
    lastFailureAt: args.seenStatus === "Failed" ? args.syncedAt : undefined,
    lastError: clipText(args.lastError, 2048),
    lastItemCount: Math.max(0, args.itemCount),
    active: args.active,
  } satisfies FolderStatePayload;
}

function buildDocumentPayload(
  siteId: string,
  driveId: string,
  folder: FolderRef,
  item: GraphDriveItem,
  match: MatchResult,
  syncedAt: string,
): TrailerDocumentPayload {
  const documentType = detectDocumentType(item.name);
  const payloadBase: Omit<TrailerDocumentPayload, "sourceHash"> = {
    sharePointItemId: clipText(item.id, 120),
    driveId: clipText(driveId, 120),
    siteId: clipText(siteId, 120),
    folderId: clipText(folder.id, 120),
    folderName: clipText(folder.name, 100),
    folderUrl: clipText(folder.webUrl, 2048),
    fixedAssetNo: clipText(match.fixedAssetNo, 50),
    fixedAssetSystemId: match.fixedAssetSystemId,
    documentType,
    fileName: clipText(item.name, 250),
    fileExtension: clipText(getFileExtension(item.name), 20),
    webUrl: clipText(normalizeText(item.webUrl), 2048),
    lastModifiedAt: normalizeBcDateTime(normalizeText(item.lastModifiedDateTime)),
    createdAt: normalizeBcDateTime(normalizeText(item.createdDateTime)),
    fileSize: Number.isFinite(item.size) ? item.size ?? 0 : 0,
    matchStatus: match.status,
    matchedBy: match.matchedBy,
    syncStatus: "Synced",
    lastSyncedAt: syncedAt,
    lastError: clipText(match.status === "Matched" ? "" : match.message, 2048),
    active: true,
    removedAt: undefined,
  };

  return {
    ...payloadBase,
    sourceHash: stableHash({
      sharePointItemId: payloadBase.sharePointItemId,
      folderId: payloadBase.folderId,
      folderName: payloadBase.folderName,
      folderUrl: payloadBase.folderUrl,
      fixedAssetNo: payloadBase.fixedAssetNo,
      documentType: payloadBase.documentType,
      fileName: payloadBase.fileName,
      fileExtension: payloadBase.fileExtension,
      webUrl: payloadBase.webUrl,
      lastModifiedAt: payloadBase.lastModifiedAt,
      createdAt: payloadBase.createdAt,
      fileSize: payloadBase.fileSize,
      matchStatus: payloadBase.matchStatus,
      matchedBy: payloadBase.matchedBy,
      active: payloadBase.active,
    }),
  };
}

async function writeSummary(summaryPath: string, payload: Record<string, unknown>) {
  await mkdir(path.dirname(summaryPath), { recursive: true });
  await writeFile(summaryPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function readDeltaState(deltaStatePath: string): Promise<DeltaState | null> {
  try {
    const raw = await readFile(deltaStatePath, "utf8");
    return JSON.parse(raw) as DeltaState;
  } catch {
    return null;
  }
}

async function writeDeltaState(deltaStatePath: string, state: DeltaState) {
  await mkdir(path.dirname(deltaStatePath), { recursive: true });
  await writeFile(deltaStatePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

async function readBackfillState(backfillStatePath: string): Promise<BackfillState | null> {
  try {
    const raw = await readFile(backfillStatePath, "utf8");
    return JSON.parse(raw.replace(/^\uFEFF/, "")) as BackfillState;
  } catch {
    return null;
  }
}

async function writeBackfillState(backfillStatePath: string, state: BackfillState) {
  await mkdir(path.dirname(backfillStatePath), { recursive: true });
  await writeFile(backfillStatePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

async function clearBackfillState(backfillStatePath: string) {
  await writeBackfillState(backfillStatePath, {
    siteId: "",
    driveId: "",
    baseFolderPath: "",
    totalQueued: 0,
    pendingFolders: [],
    seenEmptyFolders: [],
    updatedAt: nowIso(),
  });
}

function isSuccessfulSeenStatus(status: FolderSeenStatus | "") {
  return status === "SeenWithDocuments" || status === "SeenEmpty";
}

async function readTrustedFolderEvidenceFromLogs(logDir: string) {
  const folderStates = new Map<string, FolderSeenStatus>();

  try {
    const { readdir } = await import("node:fs/promises");
    const entries = await readdir(logDir, { withFileTypes: true });
    const logFiles = entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".log"))
      .map((entry) => path.join(logDir, entry.name));

    for (const logFile of logFiles) {
      const raw = await readFile(logFile, "utf8");
      const lines = raw.split(/\r?\n/);

      for (const line of lines) {
        const emptyMatch = line.match(/Completed empty folder ([A-Za-z0-9\-]+)/i);
        if (emptyMatch?.[1]) {
          folderStates.set(emptyMatch[1].toUpperCase(), "SeenEmpty");
          continue;
        }

        const docMatch = line.match(/Completed folder ([A-Za-z0-9\-]+)/i);
        if (docMatch?.[1]) {
          const key = docMatch[1].toUpperCase();
          if (!folderStates.has(key)) {
            folderStates.set(key, "SeenWithDocuments");
          }
        }
      }
    }
  } catch {
    return folderStates;
  }

  return folderStates;
}

async function runWithConcurrency<TItem>(
  items: TItem[],
  concurrency: number,
  worker: (item: TItem, index: number) => Promise<void>,
  shouldStop?: () => boolean,
) {
  let nextIndex = 0;

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (true) {
        if (shouldStop?.()) {
          return;
        }

        const currentIndex = nextIndex;
        nextIndex += 1;

        if (currentIndex >= items.length) {
          return;
        }

        await worker(items[currentIndex], currentIndex);
      }
    }),
  );
}

function makeFolderRef(item: GraphDriveItem): FolderRef {
  return {
    id: item.id,
    name: item.name,
    webUrl: normalizeText(item.webUrl),
    deleted: false,
  };
}

function dedupeFolders(folders: FolderRef[]): FolderRef[] {
  const byKey = new Map<string, FolderRef>();

  for (const folder of folders) {
    byKey.set(folder.name.toUpperCase(), folder);
  }

  return Array.from(byKey.values());
}

async function bootstrapFolderStates(args: {
  bcClient: BusinessCentralClient;
  matcher: FixedAssetMatcher;
  existingDocumentState: ExistingDocumentState;
  existingFolderStateCache: ExistingFolderStateCache;
  siteId: string;
  driveId: string;
  baseChildren: FolderRef[];
  savedBackfillState: BackfillState | null;
  backfillStateMatches: boolean;
}) {
  const counts: BootstrapCounts = {
    documentBackedSeeded: 0,
    emptySeeded: 0,
    logSeeded: 0,
    skippedExisting: 0,
  };
  const now = nowIso();
  const byFolderName = new Map(args.baseChildren.map((folder) => [folder.name.toUpperCase(), folder]));
  const logEvidence = await readTrustedFolderEvidenceFromLogs(path.join(process.cwd(), "artifacts", "sharepoint"));

  for (const [folderKey, docs] of Array.from(args.existingDocumentState.byFolderName.entries())) {
    const activeDocs = docs.filter((doc) => doc.active);
    const sampleDoc = activeDocs[0] ?? docs[0];
    if (!sampleDoc) {
      continue;
    }

    const existing = args.existingFolderStateCache.byFolderName.get(folderKey) ?? null;
    const payload: FolderStatePayload = {
      folderName: sampleDoc.folderName,
      folderId: sampleDoc.folderId,
      driveId: sampleDoc.driveId,
      siteId: sampleDoc.siteId,
      folderUrl: sampleDoc.folderUrl,
      fixedAssetNo: sampleDoc.fixedAssetNo,
      seenStatus: "SeenWithDocuments",
      lastFullTraversedAt: sampleDoc.lastSyncedAt ?? existing?.lastFullTraversedAt ?? now,
      lastDeltaRefreshedAt: existing?.lastDeltaRefreshedAt,
      lastSuccessAt: sampleDoc.lastSyncedAt ?? existing?.lastSuccessAt ?? now,
      lastFailureAt: existing?.lastFailureAt,
      lastError: "",
      lastItemCount: activeDocs.length,
      active: true,
    };

    const result = await args.bcClient.upsertFolderState(payload);
    if (result === "inserted" || result === "updated") {
      counts.documentBackedSeeded += 1;
    } else {
      counts.skippedExisting += 1;
    }
  }

  const inferredEmptyKeys = new Set<string>();
  if (args.backfillStateMatches && args.savedBackfillState) {
    const pendingKeys = new Set(args.savedBackfillState.pendingFolders.map((folder) => folder.name.toUpperCase()));
    const explicitEmptyKeys = new Set(
      (args.savedBackfillState.seenEmptyFolders ?? []).map((folderName) => folderName.toUpperCase()),
    );

    for (const folder of args.baseChildren) {
      const key = folder.name.toUpperCase();
      if (args.existingDocumentState.byFolderName.has(key)) {
        continue;
      }

      if (explicitEmptyKeys.has(key)) {
        inferredEmptyKeys.add(key);
        continue;
      }

      if (args.savedBackfillState.totalQueued > 0 && !pendingKeys.has(key)) {
        inferredEmptyKeys.add(key);
      }
    }
  }

  for (const [folderKey, status] of Array.from(logEvidence.entries())) {
    if (status === "SeenEmpty") {
      inferredEmptyKeys.add(folderKey);
    }
  }

  for (const folderKey of Array.from(inferredEmptyKeys)) {
    if (args.existingDocumentState.byFolderName.has(folderKey)) {
      continue;
    }

    const folder = byFolderName.get(folderKey) ?? {
      id: "",
      name: folderKey,
      webUrl: "",
      deleted: false,
    };
    const existing = args.existingFolderStateCache.byFolderName.get(folderKey) ?? null;
    if (existing && isSuccessfulSeenStatus(existing.seenStatus)) {
      counts.skippedExisting += 1;
      continue;
    }

    const match = args.matcher.match(folder.name);
    const payload: FolderStatePayload = {
      folderName: clipText(folder.name, 100),
      folderId: clipText(folder.id, 120),
      driveId: clipText(args.driveId, 120),
      siteId: clipText(args.siteId, 120),
      folderUrl: clipText(folder.webUrl, 2048),
      fixedAssetNo: clipText(match.fixedAssetNo, 50),
      seenStatus: "SeenEmpty",
      lastFullTraversedAt: existing?.lastFullTraversedAt ?? now,
      lastDeltaRefreshedAt: existing?.lastDeltaRefreshedAt,
      lastSuccessAt: existing?.lastSuccessAt ?? now,
      lastFailureAt: existing?.lastFailureAt,
      lastError: "",
      lastItemCount: 0,
      active: true,
    };

    const result = await args.bcClient.upsertFolderState(payload);
    if (result === "inserted" || result === "updated") {
      counts.emptySeeded += 1;
      if (logEvidence.get(folderKey) === "SeenEmpty") {
        counts.logSeeded += 1;
      }
    } else {
      counts.skippedExisting += 1;
    }
  }

  return counts;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  runtimeRequestTimeoutMs = options.requestTimeoutMs;
  const graphClient = new GraphClient();
  const bcClient = new BusinessCentralClient();
  const site = await graphClient.resolveSite();
  const drive = await graphClient.resolveDrive(site.id);
  const baseFolderPath = getSharePointBaseFolderPath();
  const fixedAssetRows = await bcClient.loadFixedAssets();
  const matcher = new FixedAssetMatcher(fixedAssetRows);
  const existingState = await bcClient.listExistingDocuments();
  const existingFolderStateCache = await bcClient.listFolderStates();

  let foldersToProcess: FolderRef[] = [];
  let nextDeltaLink: string | null = null;
  let mode = options.folders ? "targeted" : "hybrid";
  let deltaPagesRead = 0;
  let deltaStateInitialized = false;
  let skippedExistingFolders = 0;
  let backfillState: BackfillState | null = null;
  let deltaQueueSize = 0;
  let unseenBackfillQueueSize = 0;
  let totalSeenFolders = 0;
  let foldersPromotedThisRun = 0;
  let foldersMarkedEmptyThisRun = 0;
  const bootstrapCounts: BootstrapCounts = {
    documentBackedSeeded: 0,
    emptySeeded: 0,
    logSeeded: 0,
    skippedExisting: 0,
  };
  const savedBackfillState = await readBackfillState(options.backfillStatePath);
  const savedSiteId = normalizeText(savedBackfillState?.siteId);
  const savedDriveId = normalizeText(savedBackfillState?.driveId);
  const savedBaseFolderPath = normalizeFolderPath(normalizeText(savedBackfillState?.baseFolderPath ?? ""));
  const backfillStateMatches =
    savedBackfillState &&
    (savedSiteId === "" || savedSiteId === site.id) &&
    (savedDriveId === "" || savedDriveId === drive.id) &&
    (savedBaseFolderPath === "" || savedBaseFolderPath === normalizeFolderPath(baseFolderPath));
  const baseChildren = options.folders?.size
    ? []
    : (await graphClient.listChildrenByPath(drive.id, baseFolderPath))
        .filter((item) => Boolean(item.folder))
        .map(makeFolderRef);

  const bootstrap = await bootstrapFolderStates({
    bcClient,
    matcher,
    existingDocumentState: existingState,
    existingFolderStateCache,
    siteId: site.id,
    driveId: drive.id,
    baseChildren,
    savedBackfillState,
    backfillStateMatches: Boolean(backfillStateMatches),
  });
  bootstrapCounts.documentBackedSeeded = bootstrap.documentBackedSeeded;
  bootstrapCounts.emptySeeded = bootstrap.emptySeeded;
  bootstrapCounts.logSeeded = bootstrap.logSeeded;
  bootstrapCounts.skippedExisting = bootstrap.skippedExisting;

  const refreshedFolderStateCache = await bcClient.listFolderStates();
  const successFolderNames = new Set(
    Array.from(refreshedFolderStateCache.byFolderName.entries())
      .filter(([, state]) => isSuccessfulSeenStatus(state.seenStatus))
      .map(([folderName]) => folderName),
  );
  totalSeenFolders = successFolderNames.size;
  let deltaFolders: FolderRef[] = [];

  const existingDeltaState = await readDeltaState(options.deltaStatePath);
  if (existingDeltaState?.deltaLink) {
    const deltaResult = await graphClient.getChangedFolderRefs(
      existingDeltaState.deltaLink,
      baseFolderPath,
      options.maxDeltaPages,
    );
    deltaPagesRead = deltaResult.pagesRead;
    nextDeltaLink = deltaResult.latestDeltaLink;
    deltaFolders = deltaResult.folders
      .filter((folder) => successFolderNames.has(folder.name.toUpperCase()))
      .map((folder) => ({
        ...folder,
        queueType: "delta" as const,
      }));
  } else {
    deltaStateInitialized = true;
  }
  deltaQueueSize = deltaFolders.length;

  if (options.folders && options.folders.size > 0) {
    const targetedFolders = dedupeFolders([
      ...deltaFolders.filter((folder) => options.folders?.has(folder.name.toUpperCase())),
      ...Array.from(options.folders).map((folderName) => ({
        id: "",
        name: folderName,
        webUrl: "",
        deleted: false,
        queueType: "targeted" as const,
      })),
    ]);
    foldersToProcess = targetedFolders;
  } else {
    const unseenFolders = baseChildren
      .filter((folder) => !successFolderNames.has(folder.name.toUpperCase()))
      .map((folder) => ({
        ...folder,
        queueType: "backfill" as const,
      }));
    skippedExistingFolders = baseChildren.length - unseenFolders.length;
    unseenBackfillQueueSize = unseenFolders.length;
    backfillState = {
      siteId: site.id,
      driveId: drive.id,
      baseFolderPath,
      totalQueued: unseenFolders.length,
      pendingFolders: unseenFolders,
      seenEmptyFolders: Array.from(successFolderNames)
        .filter((folderName) => refreshedFolderStateCache.byFolderName.get(folderName)?.seenStatus === "SeenEmpty")
        .sort(),
      updatedAt: nowIso(),
    };
    await writeBackfillState(options.backfillStatePath, backfillState);
    foldersToProcess = dedupeFolders([...deltaFolders, ...unseenFolders]);
  }

  if (!nextDeltaLink) {
    nextDeltaLink = await graphClient.getLatestRootDeltaLink(drive.id);
  }

  if (options.limitFolders !== null) {
    foldersToProcess = foldersToProcess.slice(0, options.limitFolders);
  }

  const syncedAt = new Date().toISOString();
  const runId = syncedAt.replace(/\.\d{3}Z$/, "Z");
  const counters: SyncCounters = {
    foldersSeen: foldersToProcess.length,
    recordsSeen: 0,
    recordsInserted: 0,
    recordsUpdated: 0,
    recordsSkipped: 0,
    recordsRemoved: 0,
    recordsFailed: 0,
    unmatchedCount: 0,
  };
  const errorMessages: string[] = [];
  const syncErrors: SyncErrorPayload[] = [];
  const progressState = {
    processedFolders: 0,
    activeFolders: new Set<string>(),
    lastCompletedFolder: "",
    lastActivity: "initializing",
    lastProgressAt: nowIso(),
    summaryWrites: 0,
    bcHeartbeats: 0,
    stopRequested: false,
  };
  const completedBackfillFolderKeys = new Set<string>();
  const pendingBackfillFolderKeys = new Set(
    (backfillState?.pendingFolders ?? []).map((folder) => folder.name.toUpperCase()),
  );
  const seenEmptyFolderKeys = new Set(
    Array.from(refreshedFolderStateCache.byFolderName.entries())
      .filter(([, state]) => state.seenStatus === "SeenEmpty")
      .map(([folderName]) => folderName),
  );
  const failedFoldersByType: Record<string, number> = {};

  let syncRunRecordId: string | null = null;
  if (options.write) {
    const syncRun = await bcClient.createSyncRun({
      runId,
      startedAt: syncedAt,
      status: "Running",
      mode,
      foldersSeen: counters.foldersSeen,
      recordsSeen: 0,
      recordsInserted: 0,
      recordsUpdated: 0,
      recordsSkipped: 0,
      recordsRemoved: 0,
      recordsFailed: 0,
      unmatchedCount: 0,
      errorSummary: "",
      jobVersion: JOB_VERSION,
    });
    syncRunRecordId = syncRun.id;
  }

  let lastBcHeartbeatAt = 0;
  let flushInProgress = false;
  let heartbeatTimer: NodeJS.Timeout | null = null;

  function rememberProgress(activity: string) {
    progressState.lastActivity = activity;
    progressState.lastProgressAt = nowIso();
  }

  async function flushProgress(reason: string, forceBcHeartbeat = false) {
    if (flushInProgress) {
      return;
    }

    flushInProgress = true;
    try {
      if (backfillState) {
        const pendingFolders = backfillState.pendingFolders.filter(
          (folder) => !completedBackfillFolderKeys.has(folder.name.toUpperCase()),
        );
        backfillState = {
          ...backfillState,
          pendingFolders,
          seenEmptyFolders: Array.from(seenEmptyFolderKeys).sort(),
          updatedAt: nowIso(),
        };
        const backfillStateWriteError = await bcClient.safeWriteSummary(options.backfillStatePath, backfillState);
        if (backfillStateWriteError) {
          errorMessages.push(`backfill-state-write: ${backfillStateWriteError}`);
        }
      }

      const snapshot = {
        site: {
          id: site.id,
          displayName: site.displayName ?? "",
        },
        drive: {
          id: drive.id,
          name: drive.name,
        },
        baseFolderPath,
        write: options.write,
        mode,
        deltaPagesRead,
        deltaStateInitialized,
        skipExistingFolders: options.skipExistingFolders,
        skippedExistingFolders,
        totalSeenFolders,
        deltaQueueSize,
        unseenBackfillQueueSize,
        foldersPromotedThisRun,
        foldersMarkedEmptyThisRun,
        bootstrapCounts,
        failedFoldersByType,
        backfillStatePath: options.backfillStatePath,
        backfillPendingFolders: backfillState?.pendingFolders.length ?? 0,
        foldersRequested: counters.foldersSeen,
        processedFolders: progressState.processedFolders,
        activeFolders: Array.from(progressState.activeFolders).slice(0, options.concurrency),
        counters,
        status: "Running",
        runId,
        summaryWrites: progressState.summaryWrites,
        bcHeartbeats: progressState.bcHeartbeats,
        lastCompletedFolder: progressState.lastCompletedFolder,
        lastActivity: progressState.lastActivity,
        lastProgressAt: progressState.lastProgressAt,
        nextDeltaLinkCaptured: Boolean(nextDeltaLink),
        deltaStatePath: options.deltaStatePath,
        generatedAt: nowIso(),
        flushReason: reason,
      };

      const summaryWriteError = await bcClient.safeWriteSummary(options.summaryPath, snapshot);
      if (summaryWriteError) {
        errorMessages.push(`summary-write: ${summaryWriteError}`);
      } else {
        progressState.summaryWrites += 1;
      }

      const shouldHeartbeatBc =
        options.write &&
        syncRunRecordId &&
        (forceBcHeartbeat || Date.now() - lastBcHeartbeatAt >= options.bcHeartbeatSeconds * 1000);

      if (shouldHeartbeatBc) {
        const heartbeatError = await bcClient.safeUpdateSyncRun(syncRunRecordId, {
          status: "Running",
          mode,
          foldersSeen: counters.foldersSeen,
          recordsSeen: counters.recordsSeen,
          recordsInserted: counters.recordsInserted,
          recordsUpdated: counters.recordsUpdated,
          recordsSkipped: counters.recordsSkipped,
          recordsRemoved: counters.recordsRemoved,
          recordsFailed: counters.recordsFailed,
          unmatchedCount: counters.unmatchedCount,
          errorSummary: buildErrorSummary(errorMessages),
          jobVersion: JOB_VERSION,
        });
        if (heartbeatError) {
          errorMessages.push(`sync-run-heartbeat: ${heartbeatError}`);
        } else {
          progressState.bcHeartbeats += 1;
          lastBcHeartbeatAt = Date.now();
        }
      }
    } finally {
      flushInProgress = false;
    }
  }

  async function processFolderOnce(folder: FolderRef) {
    const existingByFolder =
      (folder.id ? existingState.byFolderId.get(folder.id) : undefined) ??
      existingState.byFolderName.get(folder.name.toUpperCase()) ??
      [];
    const folderKey = folder.name.toUpperCase();
    const existingFolderState = refreshedFolderStateCache.byFolderName.get(folderKey) ?? null;
    const existingMatch = matcher.match(folder.name);

    if (folder.deleted) {
      rememberProgress(`Removing deleted folder ${folder.name}`);
      for (const existing of existingByFolder) {
        if (!existing.active) {
          continue;
        }

        if (options.write) {
          await bcClient.markDocumentRemoved(existing, syncedAt);
        }
        counters.recordsRemoved += 1;
      }
      if (options.write) {
        await bcClient.upsertFolderState({
          folderName: clipText(folder.name, 100),
          folderId: clipText(folder.id, 120),
          driveId: clipText(drive.id, 120),
          siteId: clipText(site.id, 120),
          folderUrl: clipText(folder.webUrl, 2048),
          fixedAssetNo: clipText(existingMatch.fixedAssetNo, 50),
          seenStatus: "Unknown",
          lastFullTraversedAt: existingFolderState?.lastFullTraversedAt,
          lastDeltaRefreshedAt: folder.queueType === "delta" ? syncedAt : existingFolderState?.lastDeltaRefreshedAt,
          lastSuccessAt: existingFolderState?.lastSuccessAt,
          lastFailureAt: syncedAt,
          lastError: "Folder deleted in SharePoint.",
          lastItemCount: 0,
          active: false,
        });
      }
      return { markEmptySeen: false, promotedSeen: false, itemCount: 0 };
    }

    rememberProgress(`Refreshing folder ${folder.name}`);
    const liveFolder = await graphClient.tryGetItemByPath(drive.id, `${baseFolderPath}/${folder.name}`);

    if (!liveFolder?.folder) {
      rememberProgress(`Folder missing in SharePoint ${folder.name}`);
      for (const existing of existingByFolder) {
        if (!existing.active) {
          continue;
        }

        if (options.write) {
          await bcClient.markDocumentRemoved(existing, syncedAt);
        }
        counters.recordsRemoved += 1;
      }
      if (options.write) {
        await bcClient.upsertFolderState({
          folderName: clipText(folder.name, 100),
          folderId: clipText(folder.id, 120),
          driveId: clipText(drive.id, 120),
          siteId: clipText(site.id, 120),
          folderUrl: clipText(folder.webUrl, 2048),
          fixedAssetNo: clipText(existingMatch.fixedAssetNo, 50),
          seenStatus: "Failed",
          lastFullTraversedAt: existingFolderState?.lastFullTraversedAt,
          lastDeltaRefreshedAt: folder.queueType === "delta" ? syncedAt : existingFolderState?.lastDeltaRefreshedAt,
          lastSuccessAt: existingFolderState?.lastSuccessAt,
          lastFailureAt: syncedAt,
          lastError: "Folder missing in SharePoint.",
          lastItemCount: 0,
          active: false,
        });
      }
      return { markEmptySeen: false, promotedSeen: false, itemCount: 0 };
    }

    const liveFolderRef = {
      ...makeFolderRef(liveFolder),
      queueType: folder.queueType,
    };
    const match = matcher.match(liveFolderRef.name);
    const children = await graphClient.listChildrenByItemId(drive.id, liveFolderRef.id, options.maxChildPages);
    const files = children.filter((item) => Boolean(item.file));
    const seenItemIds = new Set<string>();

    for (let fileIndex = 0; fileIndex < files.length; fileIndex += 1) {
      const item = files[fileIndex];
      counters.recordsSeen += 1;
      seenItemIds.add(item.id);
      rememberProgress(`Syncing ${liveFolderRef.name}/${item.name}`);

      const payload = buildDocumentPayload(site.id, drive.id, liveFolderRef, item, match, syncedAt);
      if (match.status !== "Matched") {
        counters.unmatchedCount += 1;
        syncErrors.push({
          runId: clipText(runId, 50),
          sharePointItemId: clipText(item.id, 120),
          folderId: clipText(liveFolderRef.id, 120),
          folderName: clipText(liveFolderRef.name, 100),
          errorType: match.status === "Error" ? "Api" : match.status === "Ambiguous" ? "Matching" : "Validation",
          errorMessage: clipText(match.message, 2048),
          rawPayloadPointer: clipText(`sharepoint:${liveFolderRef.name}/${item.name}`, 2048),
          createdAt: syncedAt,
          resolved: false,
        });
      }

      if (!options.write) {
        const existing = existingState.byItemId.get(payload.sharePointItemId) ?? null;
        if (!existing) {
          counters.recordsInserted += 1;
        } else if (documentNeedsUpdate(existing, payload)) {
          counters.recordsUpdated += 1;
        } else {
          counters.recordsSkipped += 1;
        }
      } else {
        const result = await bcClient.upsertDocument(payload);
        if (result === "inserted") {
          counters.recordsInserted += 1;
        } else if (result === "updated") {
          counters.recordsUpdated += 1;
        } else {
          counters.recordsSkipped += 1;
        }
      }

      if ((fileIndex + 1) % 25 === 0) {
        await flushProgress(`folder-file-checkpoint:${liveFolderRef.name}`, false);
      }
    }

    for (const existing of existingByFolder) {
      if (!existing.active || seenItemIds.has(existing.sharePointItemId)) {
        continue;
      }

      if (options.write) {
        await bcClient.markDocumentRemoved(existing, syncedAt);
      }
      counters.recordsRemoved += 1;
      rememberProgress(`Removing stale BC row ${existing.sharePointItemId} from ${liveFolderRef.name}`);
    }

    const seenStatus: FolderSeenStatus = files.length > 0 ? "SeenWithDocuments" : "SeenEmpty";
    if (options.write) {
      await bcClient.upsertFolderState(
        buildFolderStatePayload({
          folder: liveFolderRef,
          siteId: site.id,
          driveId: drive.id,
          match,
          seenStatus,
          syncedAt,
          itemCount: files.length,
          lastError: "",
          active: true,
        }),
      );
    }

    return {
      markEmptySeen: files.length === 0,
      promotedSeen: !existingFolderState || !isSuccessfulSeenStatus(existingFolderState.seenStatus),
      itemCount: files.length,
    };
  }

  const handleSignal = (signal: string) => {
    if (progressState.stopRequested) {
      return;
    }

    progressState.stopRequested = true;
    rememberProgress(`Received ${signal}, stopping after active folders complete`);
    console.warn(`${signal} received. Stopping after active folders complete.`);
    void flushProgress(`signal:${signal}`, true);
  };

  process.once("SIGINT", () => handleSignal("SIGINT"));
  process.once("SIGTERM", () => handleSignal("SIGTERM"));

  await flushProgress("started", true);
  heartbeatTimer = setInterval(() => {
    void flushProgress("heartbeat", false);
  }, options.progressIntervalSeconds * 1000);
  heartbeatTimer.unref();

  console.log(
    `${options.write ? "Writing" : "Dry run"} ${foldersToProcess.length} SharePoint trailer folder(s) to Business Central in ${mode} mode...`,
  );

  try {
    await runWithConcurrency(
      foldersToProcess,
      options.concurrency,
      async (folder, index) => {
        progressState.activeFolders.add(folder.name);
        rememberProgress(`Starting folder ${folder.name}`);

        try {
          let handled = false;
          let completedSuccessfully = false;
          let markEmptySeen = false;
          let promotedSeen = false;

          for (let attempt = 0; attempt <= options.folderRetries; attempt += 1) {
            try {
              const result = await processFolderOnce(folder);
              markEmptySeen = result.markEmptySeen;
              promotedSeen = result.promotedSeen;
              handled = true;
              completedSuccessfully = true;
              break;
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error);
              if (attempt < options.folderRetries) {
                rememberProgress(`Retrying folder ${folder.name} (${attempt + 1}/${options.folderRetries})`);
                errorMessages.push(`${folder.name}: retry ${attempt + 1} after error: ${message}`);
                await sleep(getRetryDelayMs(attempt + 1, null, 1000, 10000));
                continue;
              }

              counters.recordsFailed += 1;
              failedFoldersByType.Api = (failedFoldersByType.Api ?? 0) + 1;
              errorMessages.push(`${folder.name}: ${message}`);
              syncErrors.push({
                runId: clipText(runId, 50),
                sharePointItemId: "",
                folderId: clipText(folder.id, 120),
                folderName: clipText(folder.name, 100),
                errorType: "Api",
                errorMessage: clipText(message, 2048),
                rawPayloadPointer: clipText(`sharepoint-folder:${folder.name}`, 2048),
                createdAt: syncedAt,
                resolved: false,
              });
              if (options.write) {
                const failureMatch = matcher.match(folder.name);
                await bcClient.upsertFolderState({
                  folderName: clipText(folder.name, 100),
                  folderId: clipText(folder.id, 120),
                  driveId: clipText(drive.id, 120),
                  siteId: clipText(site.id, 120),
                  folderUrl: clipText(folder.webUrl, 2048),
                  fixedAssetNo: clipText(failureMatch.fixedAssetNo, 50),
                  seenStatus: "Failed",
                  lastFullTraversedAt: undefined,
                  lastDeltaRefreshedAt: folder.queueType === "delta" ? syncedAt : undefined,
                  lastSuccessAt: undefined,
                  lastFailureAt: syncedAt,
                  lastError: clipText(message, 2048),
                  lastItemCount: 0,
                  active: true,
                });
              }
              handled = true;
              break;
            }
          }

          if (!handled) {
            counters.recordsFailed += 1;
          }

          if (completedSuccessfully) {
            const folderKey = folder.name.toUpperCase();
            if (pendingBackfillFolderKeys.has(folderKey)) {
              completedBackfillFolderKeys.add(folderKey);
            }
            if (markEmptySeen) {
              seenEmptyFolderKeys.add(folderKey);
              foldersMarkedEmptyThisRun += 1;
            }
            if (promotedSeen) {
              foldersPromotedThisRun += 1;
            }
          }

          if ((index + 1) % 100 === 0 || index === foldersToProcess.length - 1) {
            console.log(
              `Processed ${index + 1}/${foldersToProcess.length} folders. Inserted=${counters.recordsInserted}, Updated=${counters.recordsUpdated}, Removed=${counters.recordsRemoved}, Failed=${counters.recordsFailed}`,
            );
            await flushProgress(`folder-checkpoint:${index + 1}`, false);
          }
        } finally {
          progressState.activeFolders.delete(folder.name);
          progressState.processedFolders += 1;
          progressState.lastCompletedFolder = folder.name;
          rememberProgress(`Completed folder ${folder.name}`);
        }
      },
      () => progressState.stopRequested,
    );
  } finally {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
    }
  }

  if (options.write) {
    for (const syncError of syncErrors) {
      const syncErrorWriteMessage = await bcClient.safeLogSyncError(syncError);
      if (syncErrorWriteMessage) {
        errorMessages.push(
          `${syncError.folderName || syncError.sharePointItemId}: failed to log sync error: ${syncErrorWriteMessage}`,
        );
      }
    }
  }

  const finalStatus: SyncRunStatus =
    progressState.stopRequested
      ? counters.recordsInserted > 0 || counters.recordsUpdated > 0 || counters.recordsRemoved > 0
        ? "PartialFailure"
        : "Failed"
      : counters.recordsFailed > 0
      ? counters.recordsInserted > 0 || counters.recordsUpdated > 0 || counters.recordsRemoved > 0
        ? "PartialFailure"
        : "Failed"
      : "Succeeded";

  if (options.write && syncRunRecordId) {
    const finalSyncRunError = await bcClient.safeUpdateSyncRun(syncRunRecordId, {
      finishedAt: new Date().toISOString(),
      status: finalStatus,
      mode,
      foldersSeen: counters.foldersSeen,
      recordsSeen: counters.recordsSeen,
      recordsInserted: counters.recordsInserted,
      recordsUpdated: counters.recordsUpdated,
      recordsSkipped: counters.recordsSkipped,
      recordsRemoved: counters.recordsRemoved,
      recordsFailed: counters.recordsFailed,
      unmatchedCount: counters.unmatchedCount,
      errorSummary: buildErrorSummary(errorMessages),
      jobVersion: JOB_VERSION,
    });
    if (finalSyncRunError) {
      errorMessages.push(`sync-run-finalize: ${finalSyncRunError}`);
    }
  }

  if (options.write && nextDeltaLink) {
    const deltaWriteError = await bcClient.safeWriteDeltaState(options.deltaStatePath, {
      deltaLink: nextDeltaLink,
      siteId: site.id,
      driveId: drive.id,
      baseFolderPath,
      updatedAt: new Date().toISOString(),
    });
    if (deltaWriteError) {
      errorMessages.push(`delta-state-write: ${deltaWriteError}`);
    }
  }

  if (backfillState) {
    if (completedBackfillFolderKeys.size >= backfillState.pendingFolders.length) {
      const clearBackfillStateError = await bcClient.safeWriteSummary(options.backfillStatePath, {
        siteId: site.id,
        driveId: drive.id,
        baseFolderPath,
        totalQueued: backfillState.totalQueued,
        pendingFolders: [],
        seenEmptyFolders: Array.from(seenEmptyFolderKeys).sort(),
        updatedAt: new Date().toISOString(),
      });
      if (clearBackfillStateError) {
        errorMessages.push(`backfill-state-finalize: ${clearBackfillStateError}`);
      }
    } else {
      const pendingFolders = backfillState.pendingFolders.filter(
        (folder) => !completedBackfillFolderKeys.has(folder.name.toUpperCase()),
      );
      const backfillFinalizeError = await bcClient.safeWriteSummary(options.backfillStatePath, {
        ...backfillState,
        pendingFolders,
        seenEmptyFolders: Array.from(seenEmptyFolderKeys).sort(),
        updatedAt: new Date().toISOString(),
      });
      if (backfillFinalizeError) {
        errorMessages.push(`backfill-state-finalize: ${backfillFinalizeError}`);
      }
    }
  }

  const summary = {
    site: {
      id: site.id,
      displayName: site.displayName ?? "",
    },
    drive: {
      id: drive.id,
      name: drive.name,
    },
    baseFolderPath,
    write: options.write,
    mode,
    deltaPagesRead,
    deltaStateInitialized,
    skipExistingFolders: options.skipExistingFolders,
    skippedExistingFolders,
    totalSeenFolders,
    deltaQueueSize,
    unseenBackfillQueueSize,
    foldersPromotedThisRun,
    foldersMarkedEmptyThisRun,
    bootstrapCounts,
    failedFoldersByType,
    backfillStatePath: options.backfillStatePath,
    backfillPendingFolders: backfillState?.pendingFolders.length ?? 0,
    foldersRequested: counters.foldersSeen,
    processedFolders: progressState.processedFolders,
    activeFolders: Array.from(progressState.activeFolders),
    counters,
    finalStatus,
    syncErrorsLogged: syncErrors.length,
    errorMessages: errorMessages.slice(0, 100),
    nextDeltaLinkCaptured: Boolean(nextDeltaLink),
    deltaStatePath: options.deltaStatePath,
    summaryWrites: progressState.summaryWrites,
    bcHeartbeats: progressState.bcHeartbeats,
    lastCompletedFolder: progressState.lastCompletedFolder,
    lastActivity: progressState.lastActivity,
    lastProgressAt: progressState.lastProgressAt,
    runId,
    generatedAt: new Date().toISOString(),
  };

  const finalSummaryWriteError = await bcClient.safeWriteSummary(options.summaryPath, summary);
  if (finalSummaryWriteError) {
    console.error(`Failed to write sync summary to ${options.summaryPath}: ${finalSummaryWriteError}`);
  } else {
    console.log(`Wrote sync summary to ${options.summaryPath}`);
  }
  console.log(JSON.stringify(summary, null, 2));

  if (counters.recordsFailed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exit(1);
});

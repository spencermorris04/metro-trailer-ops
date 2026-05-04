import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import * as path from "node:path";

import { config as loadEnv } from "dotenv";

loadEnv();

type ResourcePayload = {
  resources?: {
    units?: {
      data?: Record360Unit[];
    };
    inspections?: {
      data?: Record360InspectionSource[];
    };
  };
};

type Record360Unit = {
  id?: string | number | null;
  reference_number?: string | null;
  vin?: string | null;
  serial_number?: string | null;
};

type Record360InspectionSource = {
  id?: string | number | null;
  type?: string | null;
  unit?: {
    id?: string | number | null;
    reference_number?: string | null;
  } | null;
  results?: Array<{
    data?: Array<{
      label?: string | null;
      value?: unknown;
    }>;
  }>;
  dashboard_url?: string | null;
  pdf_share_url?: string | null;
  photos?: unknown[];
  videos?: unknown[];
  signatures?: unknown[];
  created_at?: string | null;
  updated_at?: string | null;
};

type InspectionDirection = "Unknown" | "Incoming" | "Outgoing";
type NewUsedStatus = "Unknown" | "New" | "Used";
type MatchStatus = "Unknown" | "Matched" | "Unmatched" | "Ambiguous" | "Error";
type MatchedBy = "None" | "VIN" | "TrailerNo" | "CustomerUnitNo" | "Manual";
type SyncStatus = "Pending" | "Synced" | "Failed" | "Skipped";
type SyncRunStatus = "Running" | "Succeeded" | "PartialFailure" | "Failed";
type ErrorType = "Unknown" | "Validation" | "TrailerMatch" | "Api" | "Permission" | "FieldLength";

type FixedAssetMatch = {
  matched: boolean;
  status: MatchStatus;
  matchedBy: MatchedBy;
  trailerNo: string;
  trailerSystemId: string | null;
  message: string;
};

type InspectionPayload = {
  record360InspectionId: string;
  trailerVin: string;
  normalizedTrailerVin: string;
  trailerNo: string;
  trailerSystemId?: string;
  inspectionDateTime?: string;
  inspectionDirection: InspectionDirection;
  newUsedStatus: NewUsedStatus;
  employeeName: string;
  carrier: string;
  driver: string;
  truckNo: string;
  contractNo: string;
  origin: string;
  destination: string;
  customerUnitNo: string;
  unitCondition: string;
  comments: string;
  dashboardUrl: string;
  pdfShareUrl: string;
  photoCount: number;
  videoCount: number;
  mediaCount: number;
  matchStatus: MatchStatus;
  matchedBy: MatchedBy;
  syncStatus: SyncStatus;
  lastSyncedAt?: string;
  sourceHash: string;
  lastError: string;
};

type ExistingInspection = InspectionPayload & {
  id: string;
};

type SyncRunPayload = {
  runId: string;
  startedAt: string;
  finishedAt?: string;
  status: SyncRunStatus;
  sourceWindowStart?: string;
  sourceWindowEnd?: string;
  recordsSeen: number;
  recordsInserted: number;
  recordsUpdated: number;
  recordsSkipped: number;
  recordsFailed: number;
  unmatchedCount: number;
  errorSummary: string;
  jobVersion: string;
};

type SyncErrorPayload = {
  runId: string;
  record360InspectionId: string;
  errorType: ErrorType;
  errorMessage: string;
  rawPayloadPointer: string;
  createdAt: string;
  resolved: boolean;
};

type SyncOptions = {
  inputPath: string | null;
  write: boolean;
  limit: number | null;
  concurrency: number;
  summaryPath: string;
  onlyBcUnmatched: boolean;
  trailerNo: string | null;
  createdAfter: string | null;
  createdBefore: string | null;
};

type SyncCounters = {
  recordsSeen: number;
  recordsInserted: number;
  recordsUpdated: number;
  recordsSkipped: number;
  recordsFailed: number;
  unmatchedCount: number;
};

type BcCompany = {
  id: string;
  name?: string;
};

type BcSyncRunRecord = {
  id: string;
  runId?: string | null;
  status?: SyncRunStatus | null;
  sourceWindowStart?: string | null;
  sourceWindowEnd?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
};

type BcInspectionCheckpoint = {
  inspectionDateTime?: string | null;
};

type Record360ListResponse<TItem> = {
  data?: TItem[];
  paging?: {
    per_page?: number;
    next?: string | null;
  };
};

type LoadedSourceData = {
  sourceMode: "file" | "incremental-fetch";
  inputPath: string | null;
  units: Record360Unit[];
  inspections: Record360InspectionSource[];
  checkpointCreatedAfter: string | null;
};

const DEFAULT_CONCURRENCY = 4;
const JOB_VERSION = "record360-bc-sync/1.1.0";
const MAX_ERROR_SUMMARY_LENGTH = 2048;
const ZERO_GUID = "00000000-0000-0000-0000-000000000000";
const VIN_PATTERN = /^[A-HJ-NPR-Z0-9]{17}$/;
const RECORD360_DEFAULT_API_BASE_URL = "https://api.record360.com/v3/";
const RECORD360_DEFAULT_PER_PAGE = 100;

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function parsePositiveInteger(value: string, flagName: string) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${flagName} must be a positive integer.`);
  }

  return parsed;
}

function parseIsoDateTime(value: string, flagName: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${flagName} must be a non-empty ISO 8601 datetime.`);
  }

  if (Number.isNaN(Date.parse(trimmed))) {
    throw new Error(`${flagName} must be a valid ISO 8601 datetime.`);
  }

  return trimmed;
}

function buildDefaultSummaryPath() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return path.join(
    process.cwd(),
    "artifacts",
    "record360",
    `record360-bc-sync-summary-${timestamp}.json`,
  );
}

function buildErrorSummary(errorMessages: string[]) {
  if (errorMessages.length === 0) {
    return "";
  }

  let summary = "";
  for (const message of errorMessages) {
    const next = summary ? `${summary} | ${message}` : message;
    if (next.length > MAX_ERROR_SUMMARY_LENGTH) {
      break;
    }

    summary = next;
  }

  return summary;
}

function getRecord360ApiBaseUrl() {
  const configured = process.env.RECORD360_API_BASE_URL?.trim();
  if (!configured) {
    return new URL(RECORD360_DEFAULT_API_BASE_URL);
  }

  const normalized = new URL(configured);
  if (normalized.pathname === "/" || normalized.pathname === "") {
    normalized.pathname = "/v3/";
  } else if (normalized.pathname === "/v3") {
    normalized.pathname = "/v3/";
  }

  return normalized;
}

function getRecord360AuthHeaders() {
  const keyId = process.env.RECORD360_API_KEY_ID?.trim();
  const keySecret = process.env.RECORD360_API_KEY_SECRET?.trim();

  if (keyId && keySecret) {
    return {
      "api-key-id": keyId,
      "api-key-secret": keySecret,
      Accept: "application/json",
    };
  }

  const bearerToken = process.env.RECORD360_API_KEY?.trim();
  if (bearerToken) {
    return {
      Authorization: `Bearer ${bearerToken}`,
      Accept: "application/json",
    };
  }

  requireEnv("RECORD360_API_KEY_ID");
  requireEnv("RECORD360_API_KEY_SECRET");
  throw new Error("Record360 credentials are not configured.");
}

function parseArgs(argv: string[]): SyncOptions {
  let inputPath: string | null = null;
  let write = false;
  let limit: number | null = null;
  let concurrency = DEFAULT_CONCURRENCY;
  let summaryPath = buildDefaultSummaryPath();
  let onlyBcUnmatched = false;
  let trailerNo: string | null = null;
  let createdAfter: string | null = null;
  let createdBefore: string | null = null;

  for (const arg of argv) {
    if (arg === "--write") {
      write = true;
      continue;
    }

    if (arg === "--only-bc-unmatched") {
      onlyBcUnmatched = true;
      continue;
    }

    if (arg.startsWith("--created-after=")) {
      createdAfter = parseIsoDateTime(arg.slice("--created-after=".length), "--created-after");
      continue;
    }

    if (arg.startsWith("--created-before=")) {
      createdBefore = parseIsoDateTime(arg.slice("--created-before=".length), "--created-before");
      continue;
    }

    if (arg.startsWith("--trailer-no=")) {
      trailerNo = normalizeText(arg.slice("--trailer-no=".length));
      if (!trailerNo) {
        throw new Error("--trailer-no must be a non-empty fixed asset number.");
      }
      continue;
    }

    if (arg.startsWith("--input=")) {
      inputPath = path.resolve(arg.slice("--input=".length).trim());
      continue;
    }

    if (arg.startsWith("--limit=")) {
      limit = parsePositiveInteger(arg.slice("--limit=".length), "--limit");
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

    throw new Error(`Unknown argument: ${arg}`);
  }

  return {
    inputPath,
    write,
    limit,
    concurrency,
    summaryPath,
    onlyBcUnmatched,
    trailerNo,
    createdAfter,
    createdBefore,
  };
}

function normalizeText(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function clipText(value: string, maxLength: number) {
  return value.length <= maxLength ? value : value.slice(0, maxLength);
}

function normalizeVin(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function extractLikelyVin(value: string) {
  const tokens = value.toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean);

  for (let index = tokens.length - 1; index >= 0; index -= 1) {
    const token = tokens[index];
    if (VIN_PATTERN.test(token)) {
      return token;
    }

    if (token.length > 17) {
      const tail = token.slice(-17);
      if (VIN_PATTERN.test(tail)) {
        return tail;
      }
    }
  }

  return "";
}

function sanitizeTrailerVin(value: string) {
  const normalized = normalizeText(value).toUpperCase();
  if (!normalized) {
    return "";
  }

  const extracted = extractLikelyVin(normalized);
  if (extracted) {
    return extracted;
  }

  return clipText(normalized, 30);
}

function getFieldMaxLength(fieldName: string) {
  switch (fieldName) {
    case "No":
      return 20;
    case "Serial_No":
      return 50;
    case "RMI_Service_Item_No":
      return 20;
    default:
      return 50;
  }
}

function buildLookupCandidates(fieldName: string, values: string[]) {
  const maxLength = getFieldMaxLength(fieldName);
  const candidates = new Set<string>();

  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) {
      continue;
    }

    if (trimmed.length <= maxLength && !/[\s,;|]/.test(trimmed)) {
      candidates.add(trimmed);
      continue;
    }

    const tokens = trimmed
      .split(/[\s,;|/]+/)
      .map((token) => token.trim())
      .filter((token) => token.length > 0 && token.length <= maxLength);

    if (tokens.length === 1) {
      candidates.add(tokens[0]);
    }
  }

  return Array.from(candidates);
}

function normalizeAlphanumeric(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function buildPrefixLookupCandidates(fieldName: string, values: string[]) {
  const maxLength = getFieldMaxLength(fieldName);
  const candidates = new Set<string>();

  for (const value of values) {
    const condensed = normalizeAlphanumeric(value.trim());
    if (condensed.length < 6 || condensed.length > maxLength) {
      continue;
    }

    candidates.add(condensed);

    const withoutTrailingLetters = condensed.replace(/[A-Z]+$/, "");
    if (withoutTrailingLetters.length >= 6) {
      candidates.add(withoutTrailingLetters);
    }
  }

  return Array.from(candidates);
}

function buildVinSuffixLookupCandidates(values: string[]) {
  const candidates = new Set<string>();

  for (const value of values) {
    const condensed = normalizeAlphanumeric(value.trim());
    if (condensed.length < 6 || condensed.length > 17) {
      continue;
    }

    if (!/[A-Z]/.test(condensed) || !/\d/.test(condensed)) {
      continue;
    }

    candidates.add(condensed);
  }

  return Array.from(candidates);
}

function buildNumericSuffixLookupCandidates(values: string[]) {
  const candidates = new Set<string>();

  for (const value of values) {
    const trimmed = value.trim().toUpperCase();
    if (!/[A-Z]/.test(trimmed) || !/\d/.test(trimmed)) {
      continue;
    }

    const digitsOnly = trimmed.replace(/\D/g, "");
    if (digitsOnly.length < 5 || digitsOnly.length > getFieldMaxLength("No")) {
      continue;
    }

    candidates.add(digitsOnly);
  }

  return Array.from(candidates);
}

function normalizeFieldLabel(label: string) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
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

function normalizeComparableValue(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === ZERO_GUID) {
      return "";
    }

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

function mapFieldValues(inspection: Record360InspectionSource) {
  const result = new Map<string, string>();

  for (const block of inspection.results ?? []) {
    if (!Array.isArray(block.data)) {
      continue;
    }

    for (const field of block.data) {
      const label = normalizeText(field.label);
      if (!label) {
        continue;
      }

      const normalizedLabel = normalizeFieldLabel(label);
      const value =
        typeof field.value === "string"
          ? field.value.trim()
          : field.value === null || field.value === undefined
            ? ""
            : String(field.value).trim();
      if (!result.has(normalizedLabel)) {
        result.set(normalizedLabel, value);
      }
    }
  }

  return result;
}

function getFieldValue(fields: Map<string, string>, aliases: string[]) {
  for (const alias of aliases) {
    const value = fields.get(alias);
    if (value) {
      return value;
    }
  }

  return "";
}

function toInspectionDirection(value: string): InspectionDirection {
  const normalized = value.trim().toLowerCase();
  if (normalized === "incoming") {
    return "Incoming";
  }

  if (normalized === "outgoing") {
    return "Outgoing";
  }

  return "Unknown";
}

function toNewUsedStatus(value: string): NewUsedStatus {
  const normalized = value.trim().toLowerCase();
  if (normalized === "new") {
    return "New";
  }

  if (normalized === "used") {
    return "Used";
  }

  return "Unknown";
}

function stableHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function escapeODataString(value: string) {
  return value.replace(/'/g, "''");
}

function getTenantId() {
  return requireEnv("METRO_GRAPH_TENANT_ID");
}

function getBcEnvironment() {
  return requireEnv("METRO_BC_ENVIRONMENT");
}

function getBcCompanyName() {
  return requireEnv("METRO_BC_COMPANY");
}

function getBcPublisher() {
  return process.env.METRO_BC_R360_API_PUBLISHER?.trim() || "metroTrailer";
}

function getBcApiGroup() {
  return process.env.METRO_BC_R360_API_GROUP?.trim() || "record360";
}

function getBcApiVersion() {
  return process.env.METRO_BC_R360_API_VERSION?.trim() || "v1.0";
}

function buildBcBaseUrl() {
  return `https://api.businesscentral.dynamics.com/v2.0/${encodeURIComponent(getTenantId())}/${encodeURIComponent(getBcEnvironment())}`;
}

function buildCustomApiBaseUrl(companyId: string) {
  return `${buildBcBaseUrl()}/api/${encodeURIComponent(getBcPublisher())}/${encodeURIComponent(getBcApiGroup())}/${encodeURIComponent(getBcApiVersion())}/companies(${companyId})`;
}

function buildStandardApiBaseUrl() {
  return `${buildBcBaseUrl()}/api/v2.0`;
}

function buildODataCompanySegment() {
  return `Company('${encodeURIComponent(escapeODataString(getBcCompanyName()))}')`;
}

function buildODataBaseUrl() {
  return `${buildBcBaseUrl()}/ODataV4/${buildODataCompanySegment()}`;
}

async function sleep(milliseconds: number) {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function parseJsonResponse<TValue>(response: Response) {
  const text = await response.text();
  return {
    text,
    value: text.length > 0 ? (JSON.parse(text) as TValue) : null,
  };
}

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  options?: {
    retries?: number;
  },
) {
  const retries = options?.retries ?? 5;
  let attempt = 0;
  let lastError: Error | null = null;

  while (attempt <= retries) {
    try {
      const response = await fetch(url, init);
      if (response.status !== 429 && response.status !== 503 && response.status !== 504) {
        return response;
      }

      lastError = new Error(`Request throttled with status ${response.status}.`);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }

    attempt += 1;
    if (attempt > retries) {
      break;
    }

    await sleep(500 * 2 ** (attempt - 1));
  }

  throw lastError ?? new Error("Request failed.");
}

async function fetchRecord360Json<TValue>(url: string, headers: Record<string, string>) {
  const response = await fetchWithRetry(url, {
    headers,
    cache: "no-store",
  });
  const payload = await parseJsonResponse<TValue>(response);
  if (!response.ok) {
    throw new Error(`Record360 request failed (${response.status}) for ${url}: ${payload.text}`);
  }

  return payload.value as TValue;
}

async function fetchIncrementalRecord360Inspections(options: {
  createdAfter: string | null;
  createdBefore: string | null;
}) {
  const headers = getRecord360AuthHeaders();
  const apiBaseUrl = getRecord360ApiBaseUrl();
  const inspections: Record360InspectionSource[] = [];
  let nextUrl: string | null = new URL("inspections", apiBaseUrl).toString();

  while (nextUrl) {
    const url = new URL(nextUrl);
    if (!url.searchParams.has("per_page")) {
      url.searchParams.set("per_page", String(RECORD360_DEFAULT_PER_PAGE));
    }

    if (options.createdAfter && !url.searchParams.has("created_after")) {
      url.searchParams.set("created_after", options.createdAfter);
    }

    if (options.createdBefore && !url.searchParams.has("created_before")) {
      url.searchParams.set("created_before", options.createdBefore);
    }

    const payload = await fetchRecord360Json<Record360ListResponse<Record360InspectionSource>>(url.toString(), headers);
    inspections.push(...(payload.data ?? []));
    nextUrl = typeof payload.paging?.next === "string" ? payload.paging.next : null;
  }

  return inspections;
}

class BusinessCentralClient {
  private readonly fixedAssetLookupCache = new Map<string, Promise<FixedAssetMatch>>();
  private readonly inspectionLookupCache = new Map<string, Promise<ExistingInspection | null>>();
  private accessToken: string | null = null;
  private companyId: string | null = null;

  async getAccessToken() {
    if (this.accessToken) {
      return this.accessToken;
    }

    const response = await fetchWithRetry(
      `https://login.microsoftonline.com/${encodeURIComponent(getTenantId())}/oauth2/v2.0/token`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: requireEnv("METRO_GRAPH_CLIENT_ID"),
          client_secret: requireEnv("METRO_GRAPH_CLIENT_SECRET"),
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

    const companyName = getBcCompanyName().trim().toLowerCase();
    const match =
      payload.value?.value?.find((entry) => entry.name?.trim().toLowerCase() === companyName) ?? null;

    if (!match?.id) {
      throw new Error(`Business Central company "${getBcCompanyName()}" was not found.`);
    }

    this.companyId = match.id;
    return match.id;
  }

  async getLatestSuccessfulSyncRun() {
    const companyId = await this.getCompanyId();
    const url = new URL(`${buildCustomApiBaseUrl(companyId)}/record360SyncRuns`);
    url.searchParams.set("$select", "id,runId,status,sourceWindowStart,sourceWindowEnd,startedAt,finishedAt");
    url.searchParams.set("$filter", "status eq 'Succeeded'");
    url.searchParams.set("$orderby", "startedAt desc");
    url.searchParams.set("$top", "1");

    const payload = await this.requestJson<{ value?: BcSyncRunRecord[] }>(url.toString());
    return payload.value?.[0] ?? null;
  }

  async getLatestInspectionCheckpoint() {
    const companyId = await this.getCompanyId();
    const url = new URL(`${buildCustomApiBaseUrl(companyId)}/record360Inspections`);
    url.searchParams.set("$select", "inspectionDateTime");
    url.searchParams.set("$orderby", "inspectionDateTime desc");
    url.searchParams.set("$top", "1");

    const payload = await this.requestJson<{ value?: BcInspectionCheckpoint[] }>(url.toString());
    return payload.value?.[0] ?? null;
  }

  private async requestJson<TValue>(url: string, init?: RequestInit) {
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
    if (!response.ok) {
      throw new Error(`Business Central request failed (${response.status}) for ${url}: ${payload.text}`);
    }

    return payload.value as TValue;
  }

  private async fetchFixedAssets(fieldName: string, value: string) {
    const trimmedValue = value.trim();
    if (!trimmedValue) {
      return [];
    }

    const url = new URL(`${buildODataBaseUrl()}/FixedAssets`);
    url.searchParams.set("$select", "No,Description,Make,Vehicle_Year,Serial_No,Vehicle_Registration_No,RMI_Service_Item_No");
    url.searchParams.set("$filter", `${fieldName} eq '${escapeODataString(trimmedValue)}'`);
    url.searchParams.set("$top", "2");

    const payload = await this.requestJson<{ value?: Array<Record<string, unknown>> }>(url.toString());
    return payload.value ?? [];
  }

  private async fetchFixedAssetsByPrefix(fieldName: string, value: string) {
    const trimmedValue = value.trim();
    if (!trimmedValue) {
      return [];
    }

    const url = new URL(`${buildODataBaseUrl()}/FixedAssets`);
    url.searchParams.set("$select", "No,Description,Make,Vehicle_Year,Serial_No,Vehicle_Registration_No,RMI_Service_Item_No");
    url.searchParams.set("$filter", `startswith(${fieldName},'${escapeODataString(trimmedValue)}')`);
    url.searchParams.set("$top", "2");

    const payload = await this.requestJson<{ value?: Array<Record<string, unknown>> }>(url.toString());
    return payload.value ?? [];
  }

  private async fetchFixedAssetsBySuffix(fieldName: string, value: string) {
    const trimmedValue = value.trim();
    if (!trimmedValue) {
      return [];
    }

    const url = new URL(`${buildODataBaseUrl()}/FixedAssets`);
    url.searchParams.set("$select", "No,Description,Make,Vehicle_Year,Serial_No,Vehicle_Registration_No,RMI_Service_Item_No");
    url.searchParams.set("$filter", `endswith(${fieldName},'${escapeODataString(trimmedValue)}')`);
    url.searchParams.set("$top", "2");

    const payload = await this.requestJson<{ value?: Array<Record<string, unknown>> }>(url.toString());
    return payload.value ?? [];
  }

  async matchFixedAsset(options: {
    trailerVin: string;
    normalizedTrailerVin: string;
    trailerNo: string;
    customerUnitNo: string;
  }): Promise<FixedAssetMatch> {
    const lookupKey = JSON.stringify(options);
    const cached = this.fixedAssetLookupCache.get(lookupKey);
    if (cached) {
      return cached;
    }

    const promise = this.resolveFixedAssetMatch(options);
    this.fixedAssetLookupCache.set(lookupKey, promise);
    return promise;
  }

  private async resolveFixedAssetMatch(options: {
    trailerVin: string;
    normalizedTrailerVin: string;
    trailerNo: string;
    customerUnitNo: string;
  }): Promise<FixedAssetMatch> {
    const exactLookups: Array<{
      matchedBy: MatchedBy;
      fieldName: string;
      values: string[];
      errorType: ErrorType;
      emptyMessage: string;
    }> = [
      {
        matchedBy: "VIN",
        fieldName: "Serial_No",
        values: [options.trailerVin, options.normalizedTrailerVin],
        errorType: "Validation",
        emptyMessage: "VIN is missing.",
      },
      {
        matchedBy: "TrailerNo",
        fieldName: "No",
        values: [options.trailerNo],
        errorType: "TrailerMatch",
        emptyMessage: "Trailer number is missing.",
      },
      {
        matchedBy: "CustomerUnitNo",
        fieldName: "RMI_Service_Item_No",
        values: [options.customerUnitNo],
        errorType: "TrailerMatch",
        emptyMessage: "Customer unit number is missing.",
      },
    ];

    let sawValidationGap = false;

    for (const lookup of exactLookups) {
      const candidates = buildLookupCandidates(lookup.fieldName, lookup.values);

      if (candidates.length === 0) {
        if (lookup.matchedBy === "VIN") {
          sawValidationGap = true;
        }
        continue;
      }

      for (const candidate of candidates) {
        const rows = await this.fetchFixedAssets(lookup.fieldName, candidate);
        if (rows.length === 1) {
          const match = rows[0];
          return {
            matched: true,
            status: "Matched",
            matchedBy: lookup.matchedBy,
            trailerNo: normalizeText(match.No) || options.trailerNo,
            trailerSystemId: null,
            message: `${lookup.fieldName} matched exactly.`,
          };
        }

        if (rows.length > 1) {
          return {
            matched: false,
            status: "Ambiguous",
            matchedBy: lookup.matchedBy,
            trailerNo: options.trailerNo,
            trailerSystemId: null,
            message: `${lookup.fieldName} matched multiple Business Central fixed assets.`,
          };
        }
      }
    }

    const prefixLookups: Array<{
      matchedBy: MatchedBy;
      fieldName: string;
      values: string[];
    }> = [
      {
        matchedBy: "TrailerNo",
        fieldName: "No",
        values: [options.trailerNo],
      },
      {
        matchedBy: "CustomerUnitNo",
        fieldName: "RMI_Service_Item_No",
        values: [options.customerUnitNo],
      },
    ];

    for (const lookup of prefixLookups) {
      const candidates = buildPrefixLookupCandidates(lookup.fieldName, lookup.values);

      for (const candidate of candidates) {
        const rows = await this.fetchFixedAssetsByPrefix(lookup.fieldName, candidate);
        if (rows.length === 1) {
          const match = rows[0];
          return {
            matched: true,
            status: "Matched",
            matchedBy: lookup.matchedBy,
            trailerNo: normalizeText(match.No) || options.trailerNo,
            trailerSystemId: null,
            message: `${lookup.fieldName} matched by unique alphanumeric prefix.`,
          };
        }
      }
    }

    const vinSuffixCandidates = buildVinSuffixLookupCandidates([
      options.trailerVin,
      options.normalizedTrailerVin,
      options.trailerNo,
      options.customerUnitNo,
    ]);

    for (const candidate of vinSuffixCandidates) {
      const rows = await this.fetchFixedAssetsBySuffix("Serial_No", candidate);
      if (rows.length === 1) {
        const match = rows[0];
        return {
          matched: true,
          status: "Matched",
          matchedBy: "VIN",
          trailerNo: normalizeText(match.No) || options.trailerNo,
          trailerSystemId: null,
          message: "Serial_No matched by unique VIN suffix.",
        };
      }
    }

    const numericSuffixLookups: Array<{
      matchedBy: MatchedBy;
      fieldName: string;
      values: string[];
    }> = [
      {
        matchedBy: "TrailerNo",
        fieldName: "No",
        values: [options.trailerNo],
      },
      {
        matchedBy: "CustomerUnitNo",
        fieldName: "RMI_Service_Item_No",
        values: [options.customerUnitNo, options.trailerNo],
      },
    ];

    for (const lookup of numericSuffixLookups) {
      const candidates = buildNumericSuffixLookupCandidates(lookup.values);

      for (const candidate of candidates) {
        const rows = await this.fetchFixedAssetsBySuffix(lookup.fieldName, candidate);
        if (rows.length === 1) {
          const match = rows[0];
          return {
            matched: true,
            status: "Matched",
            matchedBy: lookup.matchedBy,
            trailerNo: normalizeText(match.No) || options.trailerNo,
            trailerSystemId: null,
            message: `${lookup.fieldName} matched by unique numeric suffix.`,
          };
        }
      }
    }

    return {
      matched: false,
      status: "Unmatched",
      matchedBy: "None",
      trailerNo: options.trailerNo,
      trailerSystemId: null,
      message: sawValidationGap
        ? "VIN is missing and no trailer number or customer unit number match was found."
        : "No Business Central fixed asset match was found.",
    };
  }

  async getExistingInspection(record360InspectionId: string) {
    const cached = this.inspectionLookupCache.get(record360InspectionId);
    if (cached) {
      return cached;
    }

    const promise = this.lookupExistingInspection(record360InspectionId);
    this.inspectionLookupCache.set(record360InspectionId, promise);
    return promise;
  }

  private async lookupExistingInspection(record360InspectionId: string): Promise<ExistingInspection | null> {
    const companyId = await this.getCompanyId();
    const url = new URL(`${buildCustomApiBaseUrl(companyId)}/record360Inspections`);
    url.searchParams.set("$filter", `record360InspectionId eq '${escapeODataString(record360InspectionId)}'`);
    url.searchParams.set("$top", "1");

    const payload = await this.requestJson<{ value?: ExistingInspection[] }>(url.toString());
    return payload.value?.[0] ?? null;
  }

  async listInspectionIdsByMatchStatus(matchStatus: MatchStatus) {
    const companyId = await this.getCompanyId();
    const record360InspectionIds = new Set<string>();
    let nextUrl: string | null = `${buildCustomApiBaseUrl(companyId)}/record360Inspections`;

    while (nextUrl) {
      const url = new URL(nextUrl);
      if (!url.searchParams.has("$filter")) {
        url.searchParams.set("$filter", `matchStatus eq '${escapeODataString(matchStatus)}'`);
      }
      if (!url.searchParams.has("$select")) {
        url.searchParams.set("$select", "record360InspectionId");
      }

      const payload = await this.requestJson<{
        value?: Array<{ record360InspectionId?: string | null }>;
        "@odata.nextLink"?: string;
      }>(url.toString());

      for (const row of payload.value ?? []) {
        const record360InspectionId = normalizeText(row.record360InspectionId);
        if (record360InspectionId) {
          record360InspectionIds.add(record360InspectionId);
        }
      }

      nextUrl = typeof payload["@odata.nextLink"] === "string" ? payload["@odata.nextLink"] : null;
    }

    return record360InspectionIds;
  }

  async createSyncRun(payload: SyncRunPayload) {
    const companyId = await this.getCompanyId();
    return this.requestJson<{ id: string }>(`${buildCustomApiBaseUrl(companyId)}/record360SyncRuns`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async updateSyncRun(id: string, payload: Partial<SyncRunPayload>) {
    const companyId = await this.getCompanyId();
    await this.requestJson(`${buildCustomApiBaseUrl(companyId)}/record360SyncRuns(${id})`, {
      method: "PATCH",
      body: JSON.stringify(payload),
      headers: {
        "If-Match": "*",
      },
    });
  }

  async logSyncError(payload: SyncErrorPayload) {
    const companyId = await this.getCompanyId();
    await this.requestJson(`${buildCustomApiBaseUrl(companyId)}/record360SyncErrors`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async upsertInspection(payload: InspectionPayload) {
    const existing = await this.getExistingInspection(payload.record360InspectionId);

    if (!existing) {
      const companyId = await this.getCompanyId();
      await this.requestJson(`${buildCustomApiBaseUrl(companyId)}/record360Inspections`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      this.inspectionLookupCache.delete(payload.record360InspectionId);
      return "inserted" as const;
    }

    if (!inspectionNeedsUpdate(existing, payload)) {
      return "skipped" as const;
    }

    const companyId = await this.getCompanyId();
    await this.requestJson(`${buildCustomApiBaseUrl(companyId)}/record360Inspections(${existing.id})`, {
      method: "PATCH",
      body: JSON.stringify(payload),
      headers: {
        "If-Match": "*",
      },
    });
    this.inspectionLookupCache.delete(payload.record360InspectionId);
    return "updated" as const;
  }
}

function inspectionNeedsUpdate(existing: ExistingInspection, incoming: InspectionPayload) {
  const comparableKeys: Array<keyof InspectionPayload> = [
    "record360InspectionId",
    "trailerVin",
    "normalizedTrailerVin",
    "trailerNo",
    "trailerSystemId",
    "inspectionDateTime",
    "inspectionDirection",
    "newUsedStatus",
    "employeeName",
    "carrier",
    "driver",
    "truckNo",
    "contractNo",
    "origin",
    "destination",
    "customerUnitNo",
    "unitCondition",
    "comments",
    "dashboardUrl",
    "pdfShareUrl",
    "photoCount",
    "videoCount",
    "mediaCount",
    "matchStatus",
    "matchedBy",
    "syncStatus",
    "sourceHash",
    "lastError",
  ];

  return comparableKeys.some((key) => normalizeComparableValue(existing[key]) !== normalizeComparableValue(incoming[key]));
}

function readSourceWindow(inspections: Record360InspectionSource[]) {
  const timestamps = inspections
    .map((inspection) => inspection.created_at)
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .sort((left, right) => left.localeCompare(right));

  return {
    start: timestamps[0] ?? undefined,
    end: timestamps[timestamps.length - 1] ?? undefined,
  };
}

function filterInspectionsByCreatedAt(
  inspections: Record360InspectionSource[],
  options: Pick<SyncOptions, "createdAfter" | "createdBefore">,
) {
  if (!options.createdAfter && !options.createdBefore) {
    return inspections;
  }

  const createdAfterTimestamp = options.createdAfter ? Date.parse(options.createdAfter) : null;
  const createdBeforeTimestamp = options.createdBefore ? Date.parse(options.createdBefore) : null;

  return inspections.filter((inspection) => {
    const createdAt = normalizeText(inspection.created_at);
    if (!createdAt) {
      return false;
    }

    const createdAtTimestamp = Date.parse(createdAt);
    if (Number.isNaN(createdAtTimestamp)) {
      return false;
    }

    if (createdAfterTimestamp !== null && createdAtTimestamp < createdAfterTimestamp) {
      return false;
    }

    if (createdBeforeTimestamp !== null && createdAtTimestamp > createdBeforeTimestamp) {
      return false;
    }

    return true;
  });
}

function filterInspectionsByTrailerNo(
  inspections: Record360InspectionSource[],
  unitById: Map<string, Record360Unit>,
  trailerNo: string | null,
) {
  const normalizedTrailerNo = normalizeText(trailerNo).toUpperCase();
  if (!normalizedTrailerNo) {
    return inspections;
  }

  return inspections.filter((inspection) => {
    const fields = mapFieldValues(inspection);
    const unitId =
      inspection.unit?.id !== null && inspection.unit?.id !== undefined
        ? String(inspection.unit.id)
        : "";
    const unit = unitId ? unitById.get(unitId) : undefined;
    const candidates = [
      normalizeText(inspection.unit?.reference_number),
      normalizeText(unit?.reference_number),
      getFieldValue(fields, ["customer unit"]),
    ].map((value) => value.toUpperCase());

    return candidates.some((candidate) => candidate === normalizedTrailerNo);
  });
}

function buildInspectionPayload(
  inspection: Record360InspectionSource,
  unitById: Map<string, Record360Unit>,
  match: FixedAssetMatch,
  syncedAt: string,
): InspectionPayload {
  const fields = mapFieldValues(inspection);
  const unitId = inspection.unit?.id !== null && inspection.unit?.id !== undefined ? String(inspection.unit.id) : "";
  const unit = unitId ? unitById.get(unitId) : undefined;
  const rawTrailerVin = getFieldValue(fields, ["vin"]) || normalizeText(unit?.vin) || normalizeText(unit?.serial_number);
  const trailerVin = sanitizeTrailerVin(rawTrailerVin);
  const normalizedTrailerVin = trailerVin ? normalizeVin(trailerVin) : "";
  const trailerNo = normalizeText(inspection.unit?.reference_number) || normalizeText(unit?.reference_number);
  const customerUnitNo = getFieldValue(fields, ["customer unit"]);
  const inspectionDateTime = normalizeBcDateTime(normalizeText(inspection.created_at));
  const payloadBase = {
    record360InspectionId: clipText(String(inspection.id ?? ""), 50),
    trailerVin: clipText(trailerVin, 30),
    normalizedTrailerVin: clipText(normalizedTrailerVin, 30),
    trailerNo: clipText(match.trailerNo || trailerNo, 50),
    trailerSystemId: match.trailerSystemId ?? undefined,
    inspectionDateTime,
    inspectionDirection: toInspectionDirection(getFieldValue(fields, ["incoming outgoing"])),
    newUsedStatus: toNewUsedStatus(getFieldValue(fields, ["new used"])),
    employeeName: clipText(getFieldValue(fields, ["employee name"]), 100),
    carrier: clipText(getFieldValue(fields, ["carrier"]), 100),
    driver: clipText(getFieldValue(fields, ["driver"]), 100),
    truckNo: clipText(getFieldValue(fields, ["truck"]), 50),
    contractNo: clipText(getFieldValue(fields, ["contract"]), 50),
    origin: clipText(getFieldValue(fields, ["origin"]), 100),
    destination: clipText(getFieldValue(fields, ["destination"]), 100),
    customerUnitNo: clipText(customerUnitNo, 50),
    unitCondition: clipText(getFieldValue(fields, ["unit condition"]), 100),
    comments: clipText(getFieldValue(fields, ["comments"]), 2048),
    dashboardUrl: clipText(normalizeText(inspection.dashboard_url), 2048),
    pdfShareUrl: clipText(normalizeText(inspection.pdf_share_url), 2048),
    photoCount: Array.isArray(inspection.photos) ? inspection.photos.length : 0,
    videoCount: Array.isArray(inspection.videos) ? inspection.videos.length : 0,
    mediaCount:
      (Array.isArray(inspection.photos) ? inspection.photos.length : 0) +
      (Array.isArray(inspection.videos) ? inspection.videos.length : 0),
    matchStatus: match.status,
    matchedBy: match.matchedBy,
    syncStatus: "Synced" as SyncStatus,
    lastSyncedAt: syncedAt,
    lastError: clipText(match.status === "Matched" ? "" : match.message, 2048),
  };

  return {
    ...payloadBase,
    sourceHash: stableHash({
      record360InspectionId: payloadBase.record360InspectionId,
      trailerVin: payloadBase.trailerVin,
      normalizedTrailerVin: payloadBase.normalizedTrailerVin,
      trailerNo: trailerNo,
      inspectionDateTime: payloadBase.inspectionDateTime,
      inspectionDirection: payloadBase.inspectionDirection,
      newUsedStatus: payloadBase.newUsedStatus,
      employeeName: payloadBase.employeeName,
      carrier: payloadBase.carrier,
      driver: payloadBase.driver,
      truckNo: payloadBase.truckNo,
      contractNo: payloadBase.contractNo,
      origin: payloadBase.origin,
      destination: payloadBase.destination,
      customerUnitNo: payloadBase.customerUnitNo,
      unitCondition: payloadBase.unitCondition,
      comments: payloadBase.comments,
      dashboardUrl: payloadBase.dashboardUrl,
      pdfShareUrl: payloadBase.pdfShareUrl,
      photoCount: payloadBase.photoCount,
      videoCount: payloadBase.videoCount,
      mediaCount: payloadBase.mediaCount,
    }),
  };
}

async function resolveCheckpointCreatedAfter(
  bcClient: BusinessCentralClient,
  options: Pick<SyncOptions, "inputPath" | "createdAfter">,
) {
  if (options.inputPath || options.createdAfter) {
    return options.createdAfter;
  }

  const latestSuccessfulRun = await bcClient.getLatestSuccessfulSyncRun();
  const successfulRunWindowEnd = normalizeText(latestSuccessfulRun?.sourceWindowEnd);
  if (successfulRunWindowEnd) {
    return successfulRunWindowEnd;
  }

  const latestInspectionCheckpoint = await bcClient.getLatestInspectionCheckpoint();
  const inspectionDateTime = normalizeText(latestInspectionCheckpoint?.inspectionDateTime);
  if (inspectionDateTime) {
    return inspectionDateTime;
  }

  return null;
}

async function loadSourceData(
  options: Pick<SyncOptions, "inputPath" | "createdAfter" | "createdBefore">,
  bcClient: BusinessCentralClient,
): Promise<LoadedSourceData> {
  if (options.inputPath) {
    const raw = JSON.parse(await readFile(options.inputPath, "utf8")) as ResourcePayload;
    return {
      sourceMode: "file",
      inputPath: options.inputPath,
      units: raw.resources?.units?.data ?? [],
      inspections: raw.resources?.inspections?.data ?? [],
      checkpointCreatedAfter: options.createdAfter,
    };
  }

  const checkpointCreatedAfter = await resolveCheckpointCreatedAfter(bcClient, options);
  const inspections = await fetchIncrementalRecord360Inspections({
    createdAfter: checkpointCreatedAfter,
    createdBefore: options.createdBefore,
  });

  return {
    sourceMode: "incremental-fetch",
    inputPath: null,
    units: [],
    inspections,
    checkpointCreatedAfter,
  };
}

async function writeSummary(summaryPath: string, payload: Record<string, unknown>) {
  await mkdir(path.dirname(summaryPath), { recursive: true });
  await writeFile(summaryPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function classifyExistingInspection(
  existing: ExistingInspection | null,
  payload: InspectionPayload,
) {
  if (!existing) {
    return "inserted" as const;
  }

  if (!inspectionNeedsUpdate(existing, payload)) {
    return "skipped" as const;
  }

  return "updated" as const;
}

async function runWithConcurrency<TItem>(
  items: TItem[],
  concurrency: number,
  worker: (item: TItem, index: number) => Promise<void>,
) {
  let nextIndex = 0;

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (true) {
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

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const bcClient = new BusinessCentralClient();
  const loadedSource = await loadSourceData(options, bcClient);
  const inspections = loadedSource.inspections;
  const units = loadedSource.units;
  const effectiveCreatedAfter = options.createdAfter ?? loadedSource.checkpointCreatedAfter;
  const effectiveCreatedBefore = options.createdBefore;

  if (inspections.length === 0) {
    const summary = {
      sourceMode: loadedSource.sourceMode,
      inputPath: loadedSource.inputPath,
      checkpointCreatedAfter: loadedSource.checkpointCreatedAfter,
      write: options.write,
      onlyBcUnmatched: options.onlyBcUnmatched,
      trailerNo: options.trailerNo,
      createdAfter: effectiveCreatedAfter,
      createdBefore: effectiveCreatedBefore,
      unmatchedFilterCount: null,
      counters: {
        recordsSeen: 0,
        recordsInserted: 0,
        recordsUpdated: 0,
        recordsSkipped: 0,
        recordsFailed: 0,
        unmatchedCount: 0,
      },
      finalStatus: "Succeeded",
      syncErrorsLogged: 0,
      errorMessages: [],
      generatedAt: new Date().toISOString(),
      message:
        loadedSource.sourceMode === "incremental-fetch"
          ? "No new Record360 inspections were returned for the requested window."
          : `No inspections found in ${loadedSource.inputPath}`,
    };

    await writeSummary(options.summaryPath, summary);
    console.log(`Wrote sync summary to ${options.summaryPath}`);
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  const unitById = new Map(
    units
      .filter((unit) => unit.id !== null && unit.id !== undefined)
      .map((unit) => [String(unit.id), unit]),
  );

  let filteredInspections = inspections;
  let unmatchedFilterCount: number | undefined;

  if (options.onlyBcUnmatched) {
    const unmatchedInspectionIds = await bcClient.listInspectionIdsByMatchStatus("Unmatched");
    unmatchedFilterCount = unmatchedInspectionIds.size;
    filteredInspections = inspections.filter((inspection) =>
      unmatchedInspectionIds.has(String(inspection.id ?? "").trim()),
    );
  }

  filteredInspections = filterInspectionsByTrailerNo(filteredInspections, unitById, options.trailerNo);

  filteredInspections = filterInspectionsByCreatedAt(filteredInspections, {
    createdAfter: effectiveCreatedAfter,
    createdBefore: effectiveCreatedBefore,
  });

  const sourceInspections = options.limit !== null ? filteredInspections.slice(0, options.limit) : filteredInspections;

  if (sourceInspections.length === 0) {
    const summary = {
      sourceMode: loadedSource.sourceMode,
      inputPath: loadedSource.inputPath,
      checkpointCreatedAfter: loadedSource.checkpointCreatedAfter,
      write: options.write,
      onlyBcUnmatched: options.onlyBcUnmatched,
      trailerNo: options.trailerNo,
      createdAfter: effectiveCreatedAfter,
      createdBefore: effectiveCreatedBefore,
      unmatchedFilterCount: unmatchedFilterCount ?? null,
      counters: {
        recordsSeen: 0,
        recordsInserted: 0,
        recordsUpdated: 0,
        recordsSkipped: 0,
        recordsFailed: 0,
        unmatchedCount: 0,
      },
      finalStatus: "Succeeded",
      syncErrorsLogged: 0,
      errorMessages: [],
      generatedAt: new Date().toISOString(),
      message: options.onlyBcUnmatched
        ? "No currently unmatched Business Central inspections were found in the source payload."
        : "No inspections selected for processing.",
    };

    await writeSummary(options.summaryPath, summary);
    console.log(`Wrote sync summary to ${options.summaryPath}`);
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  const syncedAt = new Date().toISOString();
  const runId = syncedAt.replace(/\.\d{3}Z$/, "Z");
  const sourceWindow = readSourceWindow(sourceInspections);
  const counters: SyncCounters = {
    recordsSeen: sourceInspections.length,
    recordsInserted: 0,
    recordsUpdated: 0,
    recordsSkipped: 0,
    recordsFailed: 0,
    unmatchedCount: 0,
  };
  const errorMessages: string[] = [];
  const syncErrors: SyncErrorPayload[] = [];

  let syncRunRecordId: string | null = null;

  if (options.write) {
    const syncRun = await bcClient.createSyncRun({
      runId,
      startedAt: syncedAt,
      status: "Running",
      sourceWindowStart: sourceWindow.start,
      sourceWindowEnd: sourceWindow.end,
      recordsSeen: 0,
      recordsInserted: 0,
      recordsUpdated: 0,
      recordsSkipped: 0,
      recordsFailed: 0,
      unmatchedCount: 0,
      errorSummary: "",
      jobVersion: JOB_VERSION,
    });
    syncRunRecordId = syncRun.id;
  }

  console.log(
    `${options.write ? "Writing" : "Dry run"} ${sourceInspections.length} Record360 inspection(s) to Business Central...`,
  );

  await runWithConcurrency(sourceInspections, options.concurrency, async (inspection, index) => {
    const record360InspectionId = String(inspection.id ?? "");

    try {
      const fields = mapFieldValues(inspection);
      const unitId =
        inspection.unit?.id !== null && inspection.unit?.id !== undefined
          ? String(inspection.unit.id)
          : "";
      const unit = unitId ? unitById.get(unitId) : undefined;
      const rawTrailerVin =
        getFieldValue(fields, ["vin"]) || normalizeText(unit?.vin) || normalizeText(unit?.serial_number);
      const trailerVin = sanitizeTrailerVin(rawTrailerVin);
      const normalizedTrailerVin = trailerVin ? normalizeVin(trailerVin) : "";
      const trailerNo = normalizeText(inspection.unit?.reference_number) || normalizeText(unit?.reference_number);
      const customerUnitNo = getFieldValue(fields, ["customer unit"]);

      const match = await bcClient.matchFixedAsset({
        trailerVin,
        normalizedTrailerVin,
        trailerNo,
        customerUnitNo,
      });

      if (match.status !== "Matched") {
        counters.unmatchedCount += 1;
        syncErrors.push({
          runId: clipText(runId, 50),
          record360InspectionId: clipText(record360InspectionId, 50),
          errorType: match.status === "Error" ? "Api" : match.status === "Ambiguous" ? "TrailerMatch" : trailerVin ? "TrailerMatch" : "Validation",
          errorMessage: clipText(match.message, 2048),
          rawPayloadPointer: clipText(`record360-export:${record360InspectionId}`, 2048),
          createdAt: syncedAt,
          resolved: false,
        });
      }

      const payload = buildInspectionPayload(inspection, unitById, match, syncedAt);

      if (!options.write) {
        const existing = await bcClient.getExistingInspection(payload.record360InspectionId);
        const result = classifyExistingInspection(existing, payload);
        if (result === "inserted") {
          counters.recordsInserted += 1;
        } else if (result === "updated") {
          counters.recordsUpdated += 1;
        } else {
          counters.recordsSkipped += 1;
        }
      } else {
        const result = await bcClient.upsertInspection(payload);
        if (result === "inserted") {
          counters.recordsInserted += 1;
        } else if (result === "updated") {
          counters.recordsUpdated += 1;
        } else {
          counters.recordsSkipped += 1;
        }
      }

      if ((index + 1) % 250 === 0 || index === sourceInspections.length - 1) {
        console.log(
          `Processed ${index + 1}/${sourceInspections.length} inspections. Inserted=${counters.recordsInserted}, Updated=${counters.recordsUpdated}, Skipped=${counters.recordsSkipped}, Failed=${counters.recordsFailed}`,
        );
      }
    } catch (error) {
      counters.recordsFailed += 1;
      const message = error instanceof Error ? error.message : String(error);
      errorMessages.push(`${record360InspectionId}: ${message}`);

      syncErrors.push({
        runId: clipText(runId, 50),
        record360InspectionId: clipText(record360InspectionId, 50),
        errorType: "Api",
        errorMessage: clipText(message, 2048),
        rawPayloadPointer: clipText(`record360-export:${record360InspectionId}`, 2048),
        createdAt: syncedAt,
        resolved: false,
      });
    }
  });

  if (options.write) {
    for (const syncError of syncErrors) {
      try {
        await bcClient.logSyncError(syncError);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errorMessages.push(`${syncError.record360InspectionId}: failed to log sync error: ${message}`);
      }
    }
  }

  const finalStatus: SyncRunStatus =
    counters.recordsFailed > 0 ? (counters.recordsInserted > 0 || counters.recordsUpdated > 0 ? "PartialFailure" : "Failed") : "Succeeded";

  if (options.write && syncRunRecordId) {
    await bcClient.updateSyncRun(syncRunRecordId, {
      finishedAt: new Date().toISOString(),
      status: finalStatus,
      sourceWindowStart: sourceWindow.start,
      sourceWindowEnd: sourceWindow.end,
      recordsSeen: counters.recordsSeen,
      recordsInserted: counters.recordsInserted,
      recordsUpdated: counters.recordsUpdated,
      recordsSkipped: counters.recordsSkipped,
      recordsFailed: counters.recordsFailed,
      unmatchedCount: counters.unmatchedCount,
      errorSummary: buildErrorSummary(errorMessages),
      jobVersion: JOB_VERSION,
    });
  }

  const summary = {
    sourceMode: loadedSource.sourceMode,
    inputPath: loadedSource.inputPath,
    checkpointCreatedAfter: loadedSource.checkpointCreatedAfter,
    write: options.write,
    onlyBcUnmatched: options.onlyBcUnmatched,
    trailerNo: options.trailerNo,
    createdAfter: effectiveCreatedAfter,
    createdBefore: effectiveCreatedBefore,
    unmatchedFilterCount: unmatchedFilterCount ?? null,
    runId,
    sourceWindow,
    counters,
    finalStatus,
    syncErrorsLogged: syncErrors.length,
    errorMessages: errorMessages.slice(0, 100),
    generatedAt: new Date().toISOString(),
  };

  await writeSummary(options.summaryPath, summary);
  console.log(`Wrote sync summary to ${options.summaryPath}`);
  console.log(JSON.stringify(summary, null, 2));

  if (counters.recordsFailed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exit(1);
});

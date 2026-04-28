import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import * as path from "node:path";

import { config as loadEnv } from "dotenv";

loadEnv();

type TokenResponse = {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

type OidcConfiguration = {
  token_endpoint?: string;
};

type SkyBitzResponse = {
  skybitz?: {
    error?: number | string;
    errorText?: string;
    gls?: SkyBitzGlsRecord | SkyBitzGlsRecord[];
  };
};

type SkyBitzGlsRecord = {
  mtsn?: string;
  asset?: {
    assetid?: string | number;
    assettype?: string;
    owner?: string;
    groups?: {
      groupname?: string | string[];
    };
  };
  messagetype?: string;
  latitude?: number | string;
  longitude?: number | string;
  speed?: number | string;
  heading?: string;
  headingindegrees?: number | string;
  battery?: string;
  time?: string;
  quality?: number | string;
  landmark?: {
    geoname?: string;
    state?: string;
    country?: string;
    distance?: number | string;
    direction?: string;
  };
  skyfence?: {
    skyfencestatus?: string;
    departureskyfence?: string;
  };
  serial?: Array<{
    serialtype?: number | string;
    serialid?: number | string;
    serialname?: string;
    serialdata?: string;
  }> | {
    serialtype?: number | string;
    serialid?: number | string;
    serialname?: string;
    serialdata?: string;
  };
  extpwr?: number | string;
  transid?: string;
};

type NormalizedLocation = {
  assetId: string;
  mtsn: string;
  assetType: string;
  owner: string;
  groups: string[];
  messageType: string;
  latitude: number | null;
  longitude: number | null;
  speed: number | null;
  heading: string;
  headingInDegrees: number | null;
  battery: string;
  externalPower: string;
  observationTime: string;
  quality: string;
  landmarkName: string;
  landmarkState: string;
  landmarkCountry: string;
  landmarkDistance: number | null;
  landmarkDirection: string;
  geofenceStatus: string;
  departureGeofence: string;
  serialSensors: Array<{
    serialType: string;
    serialId: string;
    serialName: string;
    serialData: string;
  }>;
  transactionId: string;
};

type MatchStatus = "Unknown" | "Matched" | "Unmatched" | "Ambiguous" | "Error";
type MatchedBy =
  | "None"
  | "AssetNo"
  | "ServiceItemNo"
  | "MTRZ"
  | "AssetNoDigits"
  | "ServiceItemNoDigits"
  | "MTRZDigits"
  | "Manual";
type SyncStatus = "Pending" | "Synced" | "Failed" | "Skipped";
type SyncRunStatus = "Running" | "Succeeded" | "PartialFailure" | "Failed";
type ErrorType = "Unknown" | "Validation" | "AssetMatch" | "Api" | "Permission" | "Auth";

type FixedAssetIndexRow = {
  no: string;
  serviceItemNo: string;
  mtrz: string;
};

type MatchResult = {
  matchStatus: MatchStatus;
  matchedBy: MatchedBy;
  fixedAssetNo: string;
  fixedAssetSystemId?: string;
  message: string;
};

type PendingTracker = {
  location: NormalizedLocation;
  sourceHash: string;
  existing: ExistingSkyBitzTracker | null;
};

type SkyBitzTrackerPayload = {
  mtsn: string;
  skybitzAssetId: string;
  fixedAssetNo: string;
  fixedAssetSystemId?: string;
  assetType: string;
  owner: string;
  groups: string;
  messageType: string;
  latitude?: number;
  longitude?: number;
  speed?: number;
  heading: string;
  headingDegrees?: number;
  battery: string;
  externalPower: string;
  observationDateTime?: string;
  quality: string;
  landmarkName: string;
  landmarkState: string;
  landmarkCountry: string;
  landmarkDistance?: number;
  landmarkDirection: string;
  geofenceStatus: string;
  departureGeofence: string;
  serialSensorsJson: string;
  matchStatus: MatchStatus;
  matchedBy: MatchedBy;
  syncStatus: SyncStatus;
  lastSyncedAt?: string;
  sourceHash: string;
  lastError: string;
};

type ExistingSkyBitzTracker = SkyBitzTrackerPayload & {
  id: string;
};

type SyncRunPayload = {
  runId: string;
  startedAt: string;
  finishedAt?: string;
  status: SyncRunStatus;
  recordsSeen: number;
  recordsInserted: number;
  recordsUpdated: number;
  recordsSkipped: number;
  recordsFailed: number;
  matchedCount: number;
  unmatchedCount: number;
  errorSummary: string;
  jobVersion: string;
};

type SyncErrorPayload = {
  runId: string;
  mtsn: string;
  skybitzAssetId: string;
  errorType: ErrorType;
  errorMessage: string;
  rawPayloadPointer: string;
  createdAt: string;
  resolved: boolean;
};

type SyncCounters = {
  recordsSeen: number;
  recordsInserted: number;
  recordsUpdated: number;
  recordsSkipped: number;
  recordsFailed: number;
  matchedCount: number;
  unmatchedCount: number;
};

type SyncOptions = {
  write: boolean;
  limit: number | null;
  concurrency: number;
  inputPath: string | null;
  outputPath: string;
  rematchUnmatched: boolean;
  from: string | null;
  to: string | null;
  sinceLastSuccessfulRun: boolean;
  overlapMinutes: number;
  safetyLagMinutes: number;
  bootstrapLookbackHours: number;
};

const API_BASE_URL = "https://api.businesscentral.dynamics.com/v2.0";
const SKYBITZ_SERVICE_URL = "https://xml-gen2.skybitz.com/";
const SKYBITZ_DEFAULT_TOKEN_URL = "https://prodssoidp.skybitz.com/oauth2/token";
const SKYBITZ_PROD_DISCOVERY_URL =
  "https://prodssoidp.skybitz.com/oauth2/oidcdiscovery/.well-known/openid-configuration";
const SKYBITZ_VERSION = "2.76";
const JOB_VERSION = "skybitz-bc-sync/1.0.0";
const DEFAULT_CONCURRENCY = 3;
const MAX_ERROR_SUMMARY_LENGTH = 2048;
const MAX_BC_RETRIES = 6;
const MAX_SKYBITZ_RETRIES = 5;

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

function buildDefaultOutputPath() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return path.join(process.cwd(), "artifacts", "skybitz", `skybitz-bc-sync-summary-${timestamp}.json`);
}

function parseArgs(argv: string[]): SyncOptions {
  let write = false;
  let limit: number | null = null;
  let concurrency = DEFAULT_CONCURRENCY;
  let inputPath: string | null = null;
  let outputPath = buildDefaultOutputPath();
  let rematchUnmatched = false;
  let from: string | null = null;
  let to: string | null = null;
  let sinceLastSuccessfulRun = false;
  let overlapMinutes = 15;
  let safetyLagMinutes = 5;
  let bootstrapLookbackHours = 24;

  for (const arg of argv) {
    if (arg === "--write") {
      write = true;
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

    if (arg.startsWith("--input=")) {
      inputPath = path.resolve(arg.slice("--input=".length).trim());
      continue;
    }

    if (arg.startsWith("--output=")) {
      outputPath = path.resolve(arg.slice("--output=".length).trim());
      continue;
    }

    if (arg === "--rematch-unmatched") {
      rematchUnmatched = true;
      continue;
    }

    if (arg === "--since-last-successful-run") {
      sinceLastSuccessfulRun = true;
      continue;
    }

    if (arg.startsWith("--from=")) {
      from = arg.slice("--from=".length).trim();
      continue;
    }

    if (arg.startsWith("--to=")) {
      to = arg.slice("--to=".length).trim();
      continue;
    }

    if (arg.startsWith("--overlap-minutes=")) {
      overlapMinutes = parsePositiveInteger(arg.slice("--overlap-minutes=".length), "--overlap-minutes");
      continue;
    }

    if (arg.startsWith("--safety-lag-minutes=")) {
      safetyLagMinutes = parsePositiveInteger(arg.slice("--safety-lag-minutes=".length), "--safety-lag-minutes");
      continue;
    }

    if (arg.startsWith("--bootstrap-lookback-hours=")) {
      bootstrapLookbackHours = parsePositiveInteger(
        arg.slice("--bootstrap-lookback-hours=".length),
        "--bootstrap-lookback-hours",
      );
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return {
    write,
    limit,
    concurrency,
    inputPath,
    outputPath,
    rematchUnmatched,
    from,
    to,
    sinceLastSuccessfulRun,
    overlapMinutes,
    safetyLagMinutes,
    bootstrapLookbackHours,
  };
}

function normalizeText(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

function normalizeNumber(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toArray<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) {
    return value;
  }

  if (value === null || value === undefined) {
    return [];
  }

  return [value];
}

function normalizeGroups(groups: SkyBitzGlsRecord["asset"] extends infer T
  ? T extends { groups?: infer TGroups }
    ? TGroups
    : never
  : never) {
  const value = groups?.groupname;
  return toArray(value).map((group) => normalizeText(group)).filter(Boolean);
}

function normalizeSerialSensors(serial: SkyBitzGlsRecord["serial"]) {
  return toArray(serial)
    .map((entry) => ({
      serialType: normalizeText(entry.serialtype),
      serialId: normalizeText(entry.serialid),
      serialName: normalizeText(entry.serialname),
      serialData: normalizeText(entry.serialdata),
    }))
    .filter((entry) => entry.serialType || entry.serialId || entry.serialName || entry.serialData);
}

function normalizeLocation(record: SkyBitzGlsRecord): NormalizedLocation {
  return {
    assetId: normalizeText(record.asset?.assetid),
    mtsn: normalizeText(record.mtsn),
    assetType: normalizeText(record.asset?.assettype),
    owner: normalizeText(record.asset?.owner),
    groups: normalizeGroups(record.asset?.groups),
    messageType: normalizeText(record.messagetype),
    latitude: normalizeNumber(record.latitude),
    longitude: normalizeNumber(record.longitude),
    speed: normalizeNumber(record.speed),
    heading: normalizeText(record.heading),
    headingInDegrees: normalizeNumber(record.headingindegrees),
    battery: normalizeText(record.battery),
    externalPower: normalizeText(record.extpwr),
    observationTime: normalizeText(record.time),
    quality: normalizeText(record.quality),
    landmarkName: normalizeText(record.landmark?.geoname),
    landmarkState: normalizeText(record.landmark?.state),
    landmarkCountry: normalizeText(record.landmark?.country),
    landmarkDistance: normalizeNumber(record.landmark?.distance),
    landmarkDirection: normalizeText(record.landmark?.direction),
    geofenceStatus: normalizeText(record.skyfence?.skyfencestatus),
    departureGeofence: normalizeText(record.skyfence?.departureskyfence),
    serialSensors: normalizeSerialSensors(record.serial),
    transactionId: normalizeText(record.transid),
  };
}

function getSkyBitzTokenUrl() {
  return process.env.SKYBITZ_TOKEN_URL?.trim() || SKYBITZ_DEFAULT_TOKEN_URL;
}

function normalizeTokenCandidate(url: string) {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    parsed.search = "";
    return parsed.toString();
  } catch {
    return url.trim();
  }
}

function buildProxyTokenUrl(url: string) {
  try {
    const parsed = new URL(url);
    parsed.port = "";
    return parsed.toString();
  } catch {
    return url.trim();
  }
}

async function discoverSkyBitzTokenCandidates() {
  const candidates = new Set<string>([getSkyBitzTokenUrl()]);

  try {
    const response = await fetch(SKYBITZ_PROD_DISCOVERY_URL, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok) {
      return Array.from(candidates);
    }

    const payload = (await response.json()) as OidcConfiguration;
    if (payload.token_endpoint) {
      candidates.add(normalizeTokenCandidate(payload.token_endpoint));
      candidates.add(normalizeTokenCandidate(buildProxyTokenUrl(payload.token_endpoint)));
    }
  } catch {
    return Array.from(candidates);
  }

  return Array.from(candidates);
}

async function requestSkyBitzToken(url: string, clientId: string, clientSecret: string, usePostBody: boolean) {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: usePostBody
        ? {
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json",
          }
        : {
            Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`, "utf8").toString("base64")}`,
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json",
          },
      body: usePostBody
        ? new URLSearchParams({
            grant_type: "client_credentials",
            client_id: clientId,
            client_secret: clientSecret,
          })
        : "grant_type=client_credentials",
    });

    const bodyText = await response.text();
    return { response, bodyText, networkError: "" };
  } catch (error) {
    return {
      response: null,
      bodyText: "",
      networkError: error instanceof Error ? error.message : String(error),
    };
  }
}

async function getSkyBitzAccessToken() {
  const clientId = requireEnv("SKYBITZ_CLIENT_ID");
  const clientSecret = requireEnv("SKYBITZ_CLIENT_SECRET");
  const candidates = await discoverSkyBitzTokenCandidates();
  const failures: string[] = [];

  for (const url of candidates) {
    for (const usePostBody of [false, true]) {
      const method = usePostBody ? "client_secret_post" : "client_secret_basic";
      const result = await requestSkyBitzToken(url, clientId, clientSecret, usePostBody);
      if (!result.response) {
        failures.push(`${method} ${url} -> network error: ${result.networkError}`);
        continue;
      }

      let payload: TokenResponse | null = null;
      try {
        payload = JSON.parse(result.bodyText) as TokenResponse;
      } catch {
        payload = null;
      }

      if (result.response.ok && payload?.access_token) {
        return payload.access_token;
      }

      const detail = payload?.error_description ?? payload?.error ?? result.bodyText;
      failures.push(`${method} ${url} -> ${result.response.status}: ${detail}`);
    }
  }

  throw new Error(`SkyBitz token request failed.\n${failures.join("\n")}`);
}

async function fetchSkyBitzLatestLocations() {
  const accessToken = await getSkyBitzAccessToken();
  const url = new URL("QueryPositions", SKYBITZ_SERVICE_URL);
  url.searchParams.set("assetid", "ALL");
  url.searchParams.set("accessToken", accessToken);
  url.searchParams.set("version", SKYBITZ_VERSION);
  url.searchParams.set("sortby", "1");
  url.searchParams.set("getJson", "1");

  const { response, bodyText } = await skybitzQueryRequest(url);
  if (!response.ok) {
    throw new Error(`SkyBitz QueryPositions failed (${response.status}): ${bodyText}`);
  }

  const payload = JSON.parse(bodyText) as SkyBitzResponse;
  const records = toArray(payload.skybitz?.gls).map(normalizeLocation);
  return {
    requestUrl: url.toString(),
    responseErrorCode: normalizeText(payload.skybitz?.error),
    responseErrorText: normalizeText(payload.skybitz?.errorText),
    records,
  };
}

async function fetchSkyBitzWindowedLocations(windowStart: Date, windowEnd: Date) {
  const accessToken = await getSkyBitzAccessToken();
  const url = new URL("QueryPositions", SKYBITZ_SERVICE_URL);
  url.searchParams.set("assetid", "All");
  url.searchParams.set("accessToken", accessToken);
  url.searchParams.set("from", formatSkyBitzQueryDate(windowStart));
  url.searchParams.set("to", formatSkyBitzQueryDate(windowEnd));
  url.searchParams.set("version", SKYBITZ_VERSION);
  url.searchParams.set("sortby", "1");
  url.searchParams.set("getJson", "1");

  const { response, bodyText } = await skybitzQueryRequest(url);
  if (!response.ok) {
    throw new Error(`SkyBitz QueryPositions windowed query failed (${response.status}): ${bodyText}`);
  }

  const payload = JSON.parse(bodyText) as SkyBitzResponse;
  const records = toArray(payload.skybitz?.gls).map(normalizeLocation);
  const responseErrorCode = normalizeText(payload.skybitz?.error);
  const responseErrorText = normalizeText(payload.skybitz?.errorText);
  if (responseErrorCode && responseErrorCode !== "0") {
    throw new Error(`SkyBitz windowed query returned error ${responseErrorCode}: ${responseErrorText || "Unknown error"}`);
  }
  return {
    requestUrl: url.toString(),
    responseErrorCode,
    responseErrorText,
    records,
  };
}

async function skybitzQueryRequest(url: URL) {
  let lastBodyText = "";
  let lastStatus = 0;

  for (let attempt = 0; attempt <= MAX_SKYBITZ_RETRIES; attempt += 1) {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    const bodyText = await response.text();

    if (response.ok || (response.status !== 503 && response.status !== 429)) {
      return { response, bodyText };
    }

    lastBodyText = bodyText;
    lastStatus = response.status;

    if (attempt >= MAX_SKYBITZ_RETRIES) {
      return { response, bodyText };
    }

    const delayMs = Math.min(5000 * 2 ** attempt, 60000);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  throw new Error(`SkyBitz query retry state exhausted (${lastStatus}): ${lastBodyText}`);
}

async function loadLocationsFromInput(inputPath: string) {
  const content = await readFile(inputPath, "utf8");
  const payload = JSON.parse(content) as { locations?: NormalizedLocation[] };
  return {
    requestUrl: inputPath,
    responseErrorCode: "",
    responseErrorText: "",
    records: Array.isArray(payload.locations) ? payload.locations : [],
  };
}

async function getBcAccessToken() {
  const tenantId = requireEnv("METRO_GRAPH_TENANT_ID");
  const clientId = requireEnv("METRO_GRAPH_CLIENT_ID");
  const clientSecret = requireEnv("METRO_GRAPH_CLIENT_SECRET");

  const response = await fetch(
    `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "client_credentials",
        scope: "https://api.businesscentral.dynamics.com/.default",
      }),
    },
  );

  const payload = (await response.json()) as { access_token?: string; error_description?: string };
  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description || `BC authentication failed with HTTP ${response.status}.`);
  }

  return payload.access_token;
}

function getBcBaseApiRoot() {
  const tenantId = requireEnv("METRO_GRAPH_TENANT_ID");
  const environment = requireEnv("METRO_BC_ENVIRONMENT");
  return `${API_BASE_URL}/${encodeURIComponent(tenantId)}/${encodeURIComponent(environment)}`;
}

function getBcODataRoot() {
  return `${getBcBaseApiRoot()}/ODataV4`;
}

function getSkyBitzApiRoot(companyId: string) {
  const publisher = process.env.SKYBITZ_BC_API_PUBLISHER?.trim() || "metroTrailer";
  const group = process.env.SKYBITZ_BC_API_GROUP?.trim() || "skybitz";
  const version = process.env.SKYBITZ_BC_API_VERSION?.trim() || "v1.0";
  return `${getBcBaseApiRoot()}/api/${encodeURIComponent(publisher)}/${encodeURIComponent(group)}/${encodeURIComponent(version)}/companies(${companyId})`;
}

async function bcRequest(url: string, accessToken: string, init?: RequestInit) {
  for (let attempt = 0; attempt <= MAX_BC_RETRIES; attempt += 1) {
    const response = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        ...(init?.headers ?? {}),
      },
    });

    const bodyText = await response.text();
    if (response.status !== 429 && response.status !== 503) {
      return { response, bodyText };
    }

    if (attempt >= MAX_BC_RETRIES) {
      return { response, bodyText };
    }

    const retryAfter = Number.parseInt(response.headers.get("Retry-After") ?? "", 10);
    const delayMs = Number.isFinite(retryAfter)
      ? retryAfter * 1000
      : Math.min(2000 * 2 ** attempt, 30000);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  throw new Error("Unreachable retry state.");
}

function getJsonValueArray(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const value = (payload as { value?: unknown }).value;
  return Array.isArray(value) ? value : [];
}

async function resolveCompanyId(accessToken: string) {
  const configured = process.env.METRO_BC_COMPANY_ID?.trim();
  if (configured) {
    return configured;
  }

  const companyName = requireEnv("METRO_BC_COMPANY");
  const url = `${getBcBaseApiRoot()}/api/v2.0/companies`;
  const { response, bodyText } = await bcRequest(url, accessToken);
  if (!response.ok) {
    throw new Error(`Unable to load BC companies (${response.status}): ${bodyText}`);
  }

  const payload = JSON.parse(bodyText) as { value?: Array<{ id?: string; name?: string }> };
  const company = payload.value?.find((entry) => normalizeText(entry.name) === companyName);
  if (!company?.id) {
    throw new Error(`Unable to resolve BC company ID for company "${companyName}".`);
  }

  return company.id;
}

async function fetchAllFixedAssets(accessToken: string) {
  const company = requireEnv("METRO_BC_COMPANY");
  const rows: FixedAssetIndexRow[] = [];
  let skip = 0;
  const top = 1000;

  while (true) {
    const url = new URL(`${getBcODataRoot()}/FixedAssets`);
    url.searchParams.set("company", company);
    url.searchParams.set("$top", String(top));
    if (skip > 0) {
      url.searchParams.set("$skip", String(skip));
    }
    url.searchParams.set("$select", "No,RMI_Service_Item_No,MTRZ");

    const { response, bodyText } = await bcRequest(url.toString(), accessToken);
    if (!response.ok) {
      throw new Error(`Unable to fetch BC FixedAssets (${response.status}): ${bodyText}`);
    }

    const payload = JSON.parse(bodyText);
    const page = getJsonValueArray(payload);
    for (const row of page) {
      if (!row || typeof row !== "object") {
        continue;
      }
      rows.push({
        no: normalizeText((row as Record<string, unknown>).No),
        serviceItemNo: normalizeText((row as Record<string, unknown>).RMI_Service_Item_No),
        mtrz: normalizeText((row as Record<string, unknown>).MTRZ),
      });
    }

    if (page.length < top) {
      break;
    }

    skip += top;
  }

  return rows;
}

function addIndexValue(index: Map<string, Set<string>>, key: string, value: string) {
  if (!key || !value) {
    return;
  }

  const existing = index.get(key) ?? new Set<string>();
  existing.add(value);
  index.set(key, existing);
}

function buildFixedAssetIndexes(rows: FixedAssetIndexRow[]) {
  const byNo = new Map<string, Set<string>>();
  const byServiceItemNo = new Map<string, Set<string>>();
  const byMtrz = new Map<string, Set<string>>();
  const byNoDigits = new Map<string, Set<string>>();
  const byServiceItemDigits = new Map<string, Set<string>>();
  const byMtrzDigits = new Map<string, Set<string>>();

  for (const row of rows) {
    addIndexValue(byNo, row.no, row.no);
    addIndexValue(byServiceItemNo, row.serviceItemNo, row.no);
    addIndexValue(byMtrz, row.mtrz, row.no);

    const noDigits = row.no.replace(/\D/g, "");
    const serviceDigits = row.serviceItemNo.replace(/\D/g, "");
    const mtrzDigits = row.mtrz.replace(/\D/g, "");

    addIndexValue(byNoDigits, noDigits, row.no);
    addIndexValue(byServiceItemDigits, serviceDigits, row.no);
    addIndexValue(byMtrzDigits, mtrzDigits, row.no);
  }

  return {
    byNo,
    byServiceItemNo,
    byMtrz,
    byNoDigits,
    byServiceItemDigits,
    byMtrzDigits,
  };
}

function uniqueMatch(index: Map<string, Set<string>>, key: string) {
  const values = index.get(key);
  if (!values || values.size === 0) {
    return { status: "none" as const, value: "" };
  }

  if (values.size === 1) {
    return { status: "unique" as const, value: Array.from(values)[0] };
  }

  return { status: "ambiguous" as const, value: "" };
}

function matchFixedAsset(
  location: NormalizedLocation,
  indexes: ReturnType<typeof buildFixedAssetIndexes>,
): MatchResult {
  const assetId = location.assetId;
  if (!assetId) {
    return {
      matchStatus: "Unmatched",
      matchedBy: "None",
      fixedAssetNo: "",
      message: "SkyBitz assetId is blank.",
    };
  }

  const attempts: Array<{
    label: MatchedBy;
    result: ReturnType<typeof uniqueMatch>;
  }> = [
    { label: "AssetNo", result: uniqueMatch(indexes.byNo, assetId) },
    { label: "ServiceItemNo", result: uniqueMatch(indexes.byServiceItemNo, assetId) },
    { label: "MTRZ", result: uniqueMatch(indexes.byMtrz, assetId) },
  ];

  for (const attempt of attempts) {
    if (attempt.result.status === "unique") {
      return {
        matchStatus: "Matched",
        matchedBy: attempt.label,
        fixedAssetNo: attempt.result.value,
        message: "",
      };
    }

    if (attempt.result.status === "ambiguous") {
      return {
        matchStatus: "Ambiguous",
        matchedBy: "None",
        fixedAssetNo: "",
        message: `Asset ID ${assetId} matched multiple fixed assets.`,
      };
    }
  }

  const digits = assetId.replace(/\D/g, "");
  if (!digits) {
    return {
      matchStatus: "Unmatched",
      matchedBy: "None",
      fixedAssetNo: "",
      message: `No BC fixed asset match for assetId ${assetId}.`,
    };
  }

  const digitAttempts: Array<{
    label: MatchedBy;
    result: ReturnType<typeof uniqueMatch>;
  }> = [
    { label: "AssetNoDigits", result: uniqueMatch(indexes.byNoDigits, digits) },
    { label: "ServiceItemNoDigits", result: uniqueMatch(indexes.byServiceItemDigits, digits) },
    { label: "MTRZDigits", result: uniqueMatch(indexes.byMtrzDigits, digits) },
  ];

  for (const attempt of digitAttempts) {
    if (attempt.result.status === "unique") {
      return {
        matchStatus: "Matched",
        matchedBy: attempt.label,
        fixedAssetNo: attempt.result.value,
        message: "",
      };
    }

    if (attempt.result.status === "ambiguous") {
      return {
        matchStatus: "Ambiguous",
        matchedBy: "None",
        fixedAssetNo: "",
        message: `Digits derived from assetId ${assetId} matched multiple fixed assets.`,
      };
    }
  }

  return {
    matchStatus: "Unmatched",
    matchedBy: "None",
    fixedAssetNo: "",
    message: `No BC fixed asset match for assetId ${assetId}.`,
  };
}

function parseSkyBitzDateTime(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  const match = trimmed.match(/^(\d{4})\/(\d{2})\/(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
  if (!match) {
    return "";
  }

  const [, year, month, day, hour, minute, second] = match;
  return `${year}-${month}-${day}T${hour}:${minute}:${second}Z`;
}

function parseIsoDateTime(value: string, flagName: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${flagName} must be a non-empty ISO 8601 datetime.`);
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${flagName} must be a valid ISO 8601 datetime.`);
  }

  return parsed;
}

function formatSkyBitzQueryDate(date: Date) {
  const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = months[date.getUTCMonth()];
  const year = date.getUTCFullYear();
  const hour = String(date.getUTCHours()).padStart(2, "0");
  const minute = String(date.getUTCMinutes()).padStart(2, "0");
  const second = String(date.getUTCSeconds()).padStart(2, "0");
  return `${day}/${month}/${year}-${hour}:${minute}:${second}`;
}

function hashPayload(value: Record<string, unknown>) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function buildRawSourceSnapshot(location: NormalizedLocation) {
  return {
    assetId: location.assetId,
    mtsn: location.mtsn,
    assetType: location.assetType,
    owner: location.owner,
    groups: location.groups.join("|"),
    messageType: location.messageType,
    latitude: location.latitude,
    longitude: location.longitude,
    speed: location.speed,
    heading: location.heading,
    headingDegrees: location.headingInDegrees,
    battery: location.battery,
    externalPower: location.externalPower,
    observationDateTime: parseSkyBitzDateTime(location.observationTime),
    quality: location.quality,
    landmarkName: location.landmarkName,
    landmarkState: location.landmarkState,
    landmarkCountry: location.landmarkCountry,
    landmarkDistance: location.landmarkDistance,
    landmarkDirection: location.landmarkDirection,
    geofenceStatus: location.geofenceStatus,
    departureGeofence: location.departureGeofence,
    serialSensorsJson: JSON.stringify(location.serialSensors),
  };
}

function buildRawSourceHash(location: NormalizedLocation) {
  return hashPayload(buildRawSourceSnapshot(location));
}

function buildMatchFromExisting(existing: ExistingSkyBitzTracker): MatchResult {
  return {
    matchStatus: existing.matchStatus,
    matchedBy: existing.matchedBy,
    fixedAssetNo: existing.fixedAssetNo,
    fixedAssetSystemId: existing.fixedAssetSystemId,
    message: existing.lastError,
  };
}

function rawSourceMatchesExisting(existing: ExistingSkyBitzTracker, location: NormalizedLocation) {
  const observationDateTime = parseSkyBitzDateTime(location.observationTime);
  const groups = truncate(location.groups.join("|"), 250);
  const serialSensorsJson = truncate(JSON.stringify(location.serialSensors), 2048);

  return (
    existing.skybitzAssetId === truncate(location.assetId, 50) &&
    existing.assetType === truncate(location.assetType, 50) &&
    existing.owner === truncate(location.owner, 100) &&
    existing.groups === groups &&
    existing.messageType === truncate(location.messageType, 50) &&
    (existing.latitude ?? undefined) === (location.latitude ?? undefined) &&
    (existing.longitude ?? undefined) === (location.longitude ?? undefined) &&
    (existing.speed ?? undefined) === (location.speed ?? undefined) &&
    existing.heading === truncate(location.heading, 20) &&
    (existing.headingDegrees ?? undefined) === (location.headingInDegrees ?? undefined) &&
    existing.battery === truncate(location.battery, 30) &&
    existing.externalPower === truncate(location.externalPower, 30) &&
    (existing.observationDateTime ?? "") === (observationDateTime || "") &&
    existing.quality === truncate(location.quality, 20) &&
    existing.landmarkName === truncate(location.landmarkName, 100) &&
    existing.landmarkState === truncate(location.landmarkState, 50) &&
    existing.landmarkCountry === truncate(location.landmarkCountry, 10) &&
    (existing.landmarkDistance ?? undefined) === (location.landmarkDistance ?? undefined) &&
    existing.landmarkDirection === truncate(location.landmarkDirection, 20) &&
    existing.geofenceStatus === truncate(location.geofenceStatus, 30) &&
    existing.departureGeofence === truncate(location.departureGeofence, 100) &&
    existing.serialSensorsJson === serialSensorsJson
  );
}

function truncate(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  return value.slice(0, maxLength);
}

function buildTrackerPayload(
  location: NormalizedLocation,
  match: MatchResult,
  syncedAt: string,
  sourceHash: string,
): SkyBitzTrackerPayload {
  const observationDateTime = parseSkyBitzDateTime(location.observationTime);
  const groups = location.groups.join("|");
  const serialSensorsJson = JSON.stringify(location.serialSensors);
  const lastError = truncate(match.message, 2048);

  return {
    mtsn: truncate(location.mtsn, 30),
    skybitzAssetId: truncate(location.assetId, 50),
    fixedAssetNo: truncate(match.fixedAssetNo, 50),
    fixedAssetSystemId: match.fixedAssetSystemId,
    assetType: truncate(location.assetType, 50),
    owner: truncate(location.owner, 100),
    groups: truncate(groups, 250),
    messageType: truncate(location.messageType, 50),
    latitude: location.latitude ?? undefined,
    longitude: location.longitude ?? undefined,
    speed: location.speed ?? undefined,
    heading: truncate(location.heading, 20),
    headingDegrees: location.headingInDegrees ?? undefined,
    battery: truncate(location.battery, 30),
    externalPower: truncate(location.externalPower, 30),
    observationDateTime: observationDateTime || undefined,
    quality: truncate(location.quality, 20),
    landmarkName: truncate(location.landmarkName, 100),
    landmarkState: truncate(location.landmarkState, 50),
    landmarkCountry: truncate(location.landmarkCountry, 10),
    landmarkDistance: location.landmarkDistance ?? undefined,
    landmarkDirection: truncate(location.landmarkDirection, 20),
    geofenceStatus: truncate(location.geofenceStatus, 30),
    departureGeofence: truncate(location.departureGeofence, 100),
    serialSensorsJson: truncate(serialSensorsJson, 2048),
    matchStatus: match.matchStatus,
    matchedBy: match.matchedBy,
    syncStatus: match.matchStatus === "Matched" ? "Synced" : "Pending",
    lastSyncedAt: syncedAt,
    sourceHash,
    lastError,
  };
}

async function fetchExistingTrackers(accessToken: string, companyId: string, allowMissingApi: boolean) {
  const existing = new Map<string, ExistingSkyBitzTracker>();
  let url = `${getSkyBitzApiRoot(companyId)}/skybitzTrackers?$top=5000`;

  while (url) {
    const { response, bodyText } = await bcRequest(url, accessToken);
    if (!response.ok) {
      if (allowMissingApi && response.status === 404) {
        return {
          existing,
          apiAvailable: false,
        };
      }

      throw new Error(`Unable to fetch existing SkyBitz tracker rows (${response.status}): ${bodyText}`);
    }

    const payload = JSON.parse(bodyText) as { value?: ExistingSkyBitzTracker[]; "@odata.nextLink"?: string };
    for (const row of payload.value ?? []) {
      if (row?.mtsn) {
        existing.set(row.mtsn, row);
      }
    }

    url = payload["@odata.nextLink"] ?? "";
  }

  return {
    existing,
    apiAvailable: true,
  };
}

async function fetchLatestSuccessfulSyncRun(accessToken: string, companyId: string) {
  const url =
    `${getSkyBitzApiRoot(companyId)}/skybitzSyncRuns` +
    `?$filter=status eq 'Succeeded'&$orderby=finishedAt desc&$top=1`;
  const { response, bodyText } = await bcRequest(url, accessToken);
  if (!response.ok) {
    throw new Error(`Unable to fetch latest successful SkyBitz sync run (${response.status}): ${bodyText}`);
  }

  const payload = JSON.parse(bodyText) as { value?: Array<{ finishedAt?: string }> };
  return payload.value?.[0] ?? null;
}

function dedupeAndCollapseLatest(locations: NormalizedLocation[]) {
  const exactSeen = new Set<string>();
  const latestByMtsn = new Map<string, NormalizedLocation>();

  for (const location of locations) {
    const mtsn = truncate(location.mtsn, 30);
    const observationDateTime = parseSkyBitzDateTime(location.observationTime);
    const exactKey = `${mtsn}::${observationDateTime}`;
    if (exactSeen.has(exactKey)) {
      continue;
    }

    exactSeen.add(exactKey);
    const existing = latestByMtsn.get(mtsn);
    if (!existing) {
      latestByMtsn.set(mtsn, location);
      continue;
    }

    const existingTime = parseSkyBitzDateTime(existing.observationTime);
    if (!existingTime || (observationDateTime && observationDateTime > existingTime)) {
      latestByMtsn.set(mtsn, location);
    }
  }

  return {
    distinctMessages: exactSeen.size,
    latestPerTracker: Array.from(latestByMtsn.values()),
  };
}

function payloadNeedsUpdate(existing: ExistingSkyBitzTracker, next: SkyBitzTrackerPayload) {
  return existing.sourceHash !== next.sourceHash || existing.fixedAssetNo !== next.fixedAssetNo || existing.lastError !== next.lastError;
}

async function createSyncRun(accessToken: string, companyId: string, payload: SyncRunPayload, write: boolean) {
  if (!write) {
    return { id: "dry-run-sync-run" };
  }

  const url = `${getSkyBitzApiRoot(companyId)}/skybitzSyncRuns`;
  const { response, bodyText } = await bcRequest(url, accessToken, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Unable to create SkyBitz sync run (${response.status}): ${bodyText}`);
  }

  return JSON.parse(bodyText) as { id: string };
}

async function updateSyncRun(accessToken: string, companyId: string, id: string, payload: SyncRunPayload, write: boolean) {
  if (!write) {
    return;
  }

  const url = `${getSkyBitzApiRoot(companyId)}/skybitzSyncRuns(${id})`;
  const { response, bodyText } = await bcRequest(url, accessToken, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "If-Match": "*",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Unable to update SkyBitz sync run (${response.status}): ${bodyText}`);
  }
}

async function createSyncError(accessToken: string, companyId: string, payload: SyncErrorPayload, write: boolean) {
  if (!write) {
    return;
  }

  const url = `${getSkyBitzApiRoot(companyId)}/skybitzSyncErrors`;
  const { response, bodyText } = await bcRequest(url, accessToken, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Unable to create SkyBitz sync error (${response.status}): ${bodyText}`);
  }
}

function buildErrorSummary(errors: string[]) {
  if (errors.length === 0) {
    return "";
  }

  let summary = "";
  for (const message of errors) {
    const next = summary ? `${summary} | ${message}` : message;
    if (next.length > MAX_ERROR_SUMMARY_LENGTH) {
      break;
    }

    summary = next;
  }

  return summary;
}

async function upsertTracker(
  accessToken: string,
  companyId: string,
  existingMap: Map<string, ExistingSkyBitzTracker>,
  payload: SkyBitzTrackerPayload,
  write: boolean,
) {
  const existing = existingMap.get(payload.mtsn);
  if (existing) {
    if (!payloadNeedsUpdate(existing, payload)) {
      return "skipped" as const;
    }

    if (write) {
      const url = `${getSkyBitzApiRoot(companyId)}/skybitzTrackers(${existing.id})`;
      const { response, bodyText } = await bcRequest(url, accessToken, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "If-Match": "*",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Unable to update SkyBitz tracker ${payload.mtsn} (${response.status}): ${bodyText}`);
      }
    }

    existingMap.set(payload.mtsn, { ...existing, ...payload });
    return "updated" as const;
  }

  if (write) {
    const url = `${getSkyBitzApiRoot(companyId)}/skybitzTrackers`;
    const { response, bodyText } = await bcRequest(url, accessToken, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Unable to insert SkyBitz tracker ${payload.mtsn} (${response.status}): ${bodyText}`);
    }

    const created = JSON.parse(bodyText) as ExistingSkyBitzTracker;
    existingMap.set(payload.mtsn, created);
  }

  return "inserted" as const;
}

async function runWithConcurrency<T>(items: T[], concurrency: number, worker: (item: T) => Promise<void>) {
  let index = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (index < items.length) {
      const current = items[index];
      index += 1;
      await worker(current);
    }
  });

  await Promise.all(runners);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const startedAt = new Date().toISOString();
  const runId = `skybitz-${startedAt}`;
  const accessToken = await getBcAccessToken();
  const companyId = await resolveCompanyId(accessToken);
  const existingState = await fetchExistingTrackers(accessToken, companyId, !options.write);
  const existingTrackers = existingState.existing;
  let source:
    | {
        requestUrl: string;
        responseErrorCode: string;
        responseErrorText: string;
        records: NormalizedLocation[];
      }
    | undefined;
  let windowStartIso = "";
  let windowEndIso = "";
  let windowMode = "latest-all";
  let dedupeStats: { distinctMessages: number; latestPerTrackerCount: number } | null = null;

  if (options.inputPath) {
    source = await loadLocationsFromInput(options.inputPath);
    windowMode = "input";
  } else if (options.from || options.to || options.sinceLastSuccessfulRun) {
    let windowEnd = options.to ? parseIsoDateTime(options.to, "--to") : new Date(Date.now() - options.safetyLagMinutes * 60 * 1000);
    let windowStart: Date;

    if (options.from) {
      windowStart = parseIsoDateTime(options.from, "--from");
      windowMode = "explicit-window";
    } else if (options.sinceLastSuccessfulRun) {
      const latestSuccessful = await fetchLatestSuccessfulSyncRun(accessToken, companyId);
      if (latestSuccessful?.finishedAt) {
        windowStart = new Date(new Date(latestSuccessful.finishedAt).getTime() - options.overlapMinutes * 60 * 1000);
        windowMode = "since-last-successful-run";
      } else {
        windowStart = new Date(windowEnd.getTime() - options.bootstrapLookbackHours * 60 * 60 * 1000);
        windowMode = "bootstrap-lookback";
      }
    } else {
      windowStart = new Date(windowEnd.getTime() - options.bootstrapLookbackHours * 60 * 60 * 1000);
      windowMode = "implicit-lookback";
    }

    if (windowStart.getTime() >= windowEnd.getTime()) {
      throw new Error("SkyBitz sync window start must be earlier than window end.");
    }

    windowStartIso = windowStart.toISOString();
    windowEndIso = windowEnd.toISOString();

    const windowedSource = await fetchSkyBitzWindowedLocations(windowStart, windowEnd);
    const collapsed = dedupeAndCollapseLatest(windowedSource.records);
    dedupeStats = {
      distinctMessages: collapsed.distinctMessages,
      latestPerTrackerCount: collapsed.latestPerTracker.length,
    };
    source = {
      ...windowedSource,
      records: collapsed.latestPerTracker,
    };
  } else {
    source = await fetchSkyBitzLatestLocations();
  }

  const locations = options.limit ? source.records.slice(0, options.limit) : source.records;
  const counters: SyncCounters = {
    recordsSeen: 0,
    recordsInserted: 0,
    recordsUpdated: 0,
    recordsSkipped: 0,
    recordsFailed: 0,
    matchedCount: 0,
    unmatchedCount: 0,
  };
  const errors: string[] = [];
  const syncRunPayload: SyncRunPayload = {
    runId,
    startedAt,
    status: "Running",
    recordsSeen: 0,
    recordsInserted: 0,
    recordsUpdated: 0,
    recordsSkipped: 0,
    recordsFailed: 0,
    matchedCount: 0,
    unmatchedCount: 0,
    errorSummary: "",
    jobVersion: JOB_VERSION,
  };
  const createdRun = await createSyncRun(accessToken, companyId, syncRunPayload, options.write);
  const syncedAt = new Date().toISOString();
  const pendingWithoutLookup: PendingTracker[] = [];
  const pendingWithLookup: PendingTracker[] = [];

  for (const location of locations) {
    counters.recordsSeen += 1;
    const sourceHash = buildRawSourceHash(location);
    const existing = existingTrackers.get(truncate(location.mtsn, 30));

    if (existing && (existing.sourceHash === sourceHash || rawSourceMatchesExisting(existing, location))) {
      const existingMatched = existing.matchStatus === "Matched";
      const shouldSkip = existingMatched || !options.rematchUnmatched;

      if (shouldSkip) {
        counters.recordsSkipped += 1;
        if (existingMatched) {
          counters.matchedCount += 1;
        } else {
          counters.unmatchedCount += 1;
        }
        continue;
      }
    }

    const existingAssetMatches = existing && existing.skybitzAssetId === truncate(location.assetId, 50);
    const shouldReuseExistingMatch =
      Boolean(existing) &&
      existingAssetMatches &&
      (existing.matchStatus === "Matched" || !options.rematchUnmatched);

    if (shouldReuseExistingMatch) {
      pendingWithoutLookup.push({ location, sourceHash, existing: existing ?? null });
      continue;
    }

    pendingWithLookup.push({ location, sourceHash, existing: existing ?? null });
  }

  let indexes: ReturnType<typeof buildFixedAssetIndexes> | null = null;
  if (pendingWithLookup.length > 0) {
    const fixedAssets = await fetchAllFixedAssets(accessToken);
    indexes = buildFixedAssetIndexes(fixedAssets);
  }

  await runWithConcurrency(pendingWithoutLookup, options.concurrency, async ({ location, sourceHash, existing }) => {
    if (!existing) {
      throw new Error("Existing tracker row was required for no-lookup update.");
    }

    const match = buildMatchFromExisting(existing);
    if (match.matchStatus === "Matched") {
      counters.matchedCount += 1;
    } else {
      counters.unmatchedCount += 1;
    }

    const payload = buildTrackerPayload(location, match, syncedAt, sourceHash);

    try {
      const result = await upsertTracker(accessToken, companyId, existingTrackers, payload, options.write);
      if (result === "inserted") {
        counters.recordsInserted += 1;
      } else if (result === "updated") {
        counters.recordsUpdated += 1;
      } else {
        counters.recordsSkipped += 1;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      counters.recordsFailed += 1;
      errors.push(message);
    }
  });

  await runWithConcurrency(pendingWithLookup, options.concurrency, async ({ location, sourceHash }) => {
    if (!indexes) {
      throw new Error("Fixed asset indexes were not initialized.");
    }

    const match = matchFixedAsset(location, indexes);
    if (match.matchStatus === "Matched") {
      counters.matchedCount += 1;
    } else {
      counters.unmatchedCount += 1;
    }

    const payload = buildTrackerPayload(location, match, syncedAt, sourceHash);

    try {
      const result = await upsertTracker(accessToken, companyId, existingTrackers, payload, options.write);
      if (result === "inserted") {
        counters.recordsInserted += 1;
      } else if (result === "updated") {
        counters.recordsUpdated += 1;
      } else {
        counters.recordsSkipped += 1;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      counters.recordsFailed += 1;
      errors.push(message);
      try {
        await createSyncError(
          accessToken,
          companyId,
          {
            runId,
            mtsn: payload.mtsn,
            skybitzAssetId: payload.skybitzAssetId,
            errorType: "Api",
            errorMessage: truncate(message, 2048),
            rawPayloadPointer: options.inputPath ?? source.requestUrl,
            createdAt: new Date().toISOString(),
            resolved: false,
          },
          options.write,
        );
      } catch (logError) {
        const logMessage = logError instanceof Error ? logError.message : String(logError);
        errors.push(`Failed to log sync error for ${payload.mtsn}: ${logMessage}`);
      }
    }
  });

  const finishedAt = new Date().toISOString();
  const finalRunPayload: SyncRunPayload = {
    runId,
    startedAt,
    finishedAt,
    status: counters.recordsFailed > 0 ? (counters.recordsInserted + counters.recordsUpdated > 0 ? "PartialFailure" : "Failed") : "Succeeded",
    recordsSeen: counters.recordsSeen,
    recordsInserted: counters.recordsInserted,
    recordsUpdated: counters.recordsUpdated,
    recordsSkipped: counters.recordsSkipped,
    recordsFailed: counters.recordsFailed,
    matchedCount: counters.matchedCount,
    unmatchedCount: counters.unmatchedCount,
    errorSummary: buildErrorSummary(errors),
    jobVersion: JOB_VERSION,
  };
  await updateSyncRun(accessToken, companyId, createdRun.id, finalRunPayload, options.write);

  const summary = {
    runId,
    write: options.write,
    companyId,
    windowMode,
    windowStart: windowStartIso || null,
    windowEnd: windowEndIso || null,
    requestUrl: source.requestUrl,
    sourceErrorCode: source.responseErrorCode,
    sourceErrorText: source.responseErrorText,
    customApiAvailable: existingState.apiAvailable,
    totalFetched: source.records.length,
    distinctMessagesInWindow: dedupeStats?.distinctMessages ?? null,
    latestTrackersInWindow: dedupeStats?.latestPerTrackerCount ?? null,
    processed: locations.length,
    pendingLocations: pendingWithoutLookup.length + pendingWithLookup.length,
    pendingWithoutLookup: pendingWithoutLookup.length,
    pendingWithLookup: pendingWithLookup.length,
    fixedAssetLookupSkipped: pendingWithLookup.length === 0,
    counters,
    sample: locations[0] ?? null,
    outputGeneratedAt: new Date().toISOString(),
  };

  await mkdir(path.dirname(options.outputPath), { recursive: true });
  await writeFile(options.outputPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exit(1);
});

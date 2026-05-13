import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import * as path from "node:path";

import { config as loadEnv } from "dotenv";

import {
  ExistingTelematicsTracker,
  MatchResult,
  TelematicsTrackerPayload,
  buildFixedAssetIndexes,
  createTelematicsSyncError,
  createTelematicsSyncRun,
  fetchAllFixedAssets,
  fetchExistingTelematicsTrackers,
  fetchLatestSuccessfulTelematicsRun,
  fetchTelematicsByFixedAsset,
  getBcAccessToken,
  matchFixedAssetByProviderAssetId,
  normalizeText,
  resolveCompanyId,
  runWithConcurrency,
  toNumber,
  truncate,
  updateTelematicsSyncRun,
  upsertTelematicsTracker,
} from "../../telematics/scripts/shared";

loadEnv();

type TokenResponse = {
  access_token?: string;
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

type SourceFetchResult = {
  requestUrl: string;
  responseErrorCode: string;
  responseErrorText: string;
  records: NormalizedLocation[];
};

type Options = {
  write: boolean;
  syncMethod: "latest-snapshot" | "history-window";
  sinceLastSuccessfulRun: boolean;
  from: string;
  to: string;
  assetId: string;
  fixedAssetNo: string;
  limit: number | null;
  concurrency: number;
  maxWindowCount: number | null;
  windowChunkMinutes: number;
  overlapMinutes: number;
  safetyLagMinutes: number;
  maxLookbackHours: number;
  bootstrapLookbackHours: number;
  outputPath: string;
};

type Counters = {
  recordsSeen: number;
  recordsInserted: number;
  recordsUpdated: number;
  recordsSkipped: number;
  recordsFailed: number;
  matchedCount: number;
  unmatchedCount: number;
};

const SKYBITZ_SERVICE_URL = "https://xml-gen2.skybitz.com/";
const SKYBITZ_DEFAULT_TOKEN_URL = "https://prodssoidp.skybitz.com/oauth2/token";
const SKYBITZ_PROD_DISCOVERY_URL =
  "https://prodssoidp.skybitz.com/oauth2/oidcdiscovery/.well-known/openid-configuration";
const SKYBITZ_VERSION = "2.76";
const JOB_VERSION = "skybitz-telematics-sync-v1";
const MAX_SKYBITZ_RETRIES = 5;
const MAX_ERROR_SUMMARY_LENGTH = 2048;

function parseArgs(argv: string[]): Options {
  const get = (name: string) => {
    const prefix = `--${name}=`;
    return argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length).trim() ?? "";
  };
  const syncMethod = argv.includes("--history-window") ? "history-window" : "latest-snapshot";
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return {
    write: argv.includes("--write"),
    syncMethod,
    sinceLastSuccessfulRun: argv.includes("--since-last-successful-run"),
    from: get("from"),
    to: get("to"),
    assetId: get("assetid") || "ALL",
    fixedAssetNo: get("fixed-asset-no"),
    limit: get("limit") ? Number(get("limit")) : null,
    concurrency: Number(get("concurrency") || "3"),
    maxWindowCount: get("max-window-count") ? Number(get("max-window-count")) : null,
    windowChunkMinutes: Number(get("window-chunk-minutes") || "60"),
    overlapMinutes: Number(get("overlap-minutes") || "15"),
    safetyLagMinutes: Number(get("safety-lag-minutes") || "5"),
    maxLookbackHours: Number(get("max-lookback-hours") || "24"),
    bootstrapLookbackHours: Number(get("bootstrap-lookback-hours") || "24"),
    outputPath: get("output") || path.join(process.cwd(), "artifacts", "skybitz", `skybitz-telematics-sync-${timestamp}.json`),
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const startedAt = new Date().toISOString();
  const accessToken = await getBcAccessToken();
  const companyId = await resolveCompanyId(accessToken);
  const sourceWindow = await resolveSourceWindow(accessToken, companyId, options);
  const source = await fetchSourceLocations(accessToken, companyId, options, sourceWindow);
  const collapsed = collapseLatestByTracker(source.records);
  const locations = options.limit ? collapsed.latestPerTracker.slice(0, options.limit) : collapsed.latestPerTracker;
  const existingState = await fetchExistingTelematicsTrackers(accessToken, companyId);
  if (!existingState.apiAvailable && options.write) {
    throw new Error("Telematics API is not available in Business Central. Upload the Telematics extension before writing.");
  }

  const fixedAssets = await fetchAllFixedAssets(accessToken);
  const indexes = buildFixedAssetIndexes(fixedAssets);
  const counters: Counters = {
    recordsSeen: locations.length,
    recordsInserted: 0,
    recordsUpdated: 0,
    recordsSkipped: 0,
    recordsFailed: 0,
    matchedCount: 0,
    unmatchedCount: 0,
  };
  const errors: string[] = [];
  const runId = `skybitz-${new Date().toISOString()}`;
  const createdRun = await createTelematicsSyncRun(
    accessToken,
    companyId,
    {
      runId,
      provider: "SkyBitz",
      startedAt,
      status: "Running",
      sourceWindowStart: sourceWindow.from ?? undefined,
      sourceWindowEnd: sourceWindow.to ?? undefined,
      recordsSeen: counters.recordsSeen,
      recordsInserted: 0,
      recordsUpdated: 0,
      recordsSkipped: 0,
      recordsFailed: 0,
      matchedCount: 0,
      unmatchedCount: 0,
      errorSummary: "",
      jobVersion: JOB_VERSION,
    },
    options.write,
  );
  const syncedAt = new Date().toISOString();

  await runWithConcurrency(locations, options.concurrency, async (location) => {
    const match = matchFixedAssetByProviderAssetId(location.assetId, indexes);
    if (match.matchStatus === "Matched") {
      counters.matchedCount += 1;
    } else {
      counters.unmatchedCount += 1;
    }

    const payload = buildTelematicsPayload(location, match, syncedAt);
    try {
      const result = await upsertTelematicsTracker(accessToken, companyId, existingState.existing, payload, options.write);
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
      await createTelematicsSyncError(
        accessToken,
        companyId,
        {
          runId,
          provider: "SkyBitz",
          providerTrackerId: payload.providerTrackerId,
          providerAssetId: payload.providerAssetId,
          errorType: "Api",
          errorMessage: truncate(message, 2048),
          rawPayloadPointer: truncate(source.requestUrl, 2048),
          createdAt: new Date().toISOString(),
          resolved: false,
        },
        options.write,
      );
    }
  });

  const finalStatus = counters.recordsFailed > 0 ? (counters.recordsInserted + counters.recordsUpdated > 0 ? "PartialFailure" : "Failed") : "Succeeded";
  await updateTelematicsSyncRun(
    accessToken,
    companyId,
    createdRun.id,
    {
      runId,
      provider: "SkyBitz",
      startedAt,
      finishedAt: new Date().toISOString(),
      status: finalStatus,
      sourceWindowStart: sourceWindow.from ?? undefined,
      sourceWindowEnd: sourceWindow.to ?? undefined,
      recordsSeen: counters.recordsSeen,
      recordsInserted: counters.recordsInserted,
      recordsUpdated: counters.recordsUpdated,
      recordsSkipped: counters.recordsSkipped,
      recordsFailed: counters.recordsFailed,
      matchedCount: counters.matchedCount,
      unmatchedCount: counters.unmatchedCount,
      errorSummary: buildErrorSummary(errors),
      jobVersion: JOB_VERSION,
    },
    options.write,
  );

  const summary = {
    write: options.write,
    companyId,
    syncMethod: options.syncMethod,
    sourceWindow,
    requestUrl: redactAccessToken(source.requestUrl),
    sourceErrorCode: source.responseErrorCode,
    sourceErrorText: source.responseErrorText,
    rawRecordsFetched: source.records.length,
    distinctMessages: collapsed.distinctMessages,
    latestTrackers: collapsed.latestPerTracker.length,
    processed: locations.length,
    counters,
    finalStatus,
    errorSummary: buildErrorSummary(errors),
    generatedAt: new Date().toISOString(),
  };
  await writeSummary(options.outputPath, summary);
  console.log(JSON.stringify(summary, null, 2));
}

async function resolveSourceWindow(accessToken: string, companyId: string, options: Options) {
  if (options.syncMethod !== "history-window") {
    return { from: null as string | null, to: null as string | null };
  }

  const to = options.to ? parseDate(options.to, "--to") : new Date(Date.now() - options.safetyLagMinutes * 60 * 1000);
  let from = options.from ? parseDate(options.from, "--from") : new Date(to.getTime() - options.bootstrapLookbackHours * 60 * 60 * 1000);
  if (options.sinceLastSuccessfulRun && !options.from) {
    const latest = await fetchLatestSuccessfulTelematicsRun(accessToken, companyId, "SkyBitz");
    if (latest?.sourceWindowEnd) {
      from = new Date(new Date(latest.sourceWindowEnd).getTime() - options.overlapMinutes * 60 * 1000);
    }
  }

  const earliestAllowed = new Date(to.getTime() - options.maxLookbackHours * 60 * 60 * 1000);
  if (from < earliestAllowed) {
    from = earliestAllowed;
  }
  if (from >= to) {
    throw new Error("SkyBitz source window start must be earlier than source window end.");
  }
  return { from: from.toISOString(), to: to.toISOString() };
}

async function fetchSourceLocations(
  accessToken: string,
  companyId: string,
  options: Options,
  sourceWindow: { from: string | null; to: string | null },
): Promise<SourceFetchResult> {
  if (options.fixedAssetNo) {
    const assetIds = await resolveAssetIdsForFixedAsset(accessToken, companyId, options.fixedAssetNo);
    const results = await Promise.all(assetIds.map((assetId) => fetchSkyBitzLatestLocations(assetId)));
    return combineSourceResults(results);
  }

  if (options.syncMethod === "latest-snapshot") {
    return fetchSkyBitzLatestLocations(options.assetId);
  }

  if (!sourceWindow.from || !sourceWindow.to) {
    throw new Error("SkyBitz history sync requires a source window.");
  }

  const windows = buildWindowPlans(new Date(sourceWindow.from), new Date(sourceWindow.to), options.windowChunkMinutes, options.overlapMinutes);
  const planned = options.maxWindowCount === null ? windows : windows.slice(0, options.maxWindowCount);
  const results: SourceFetchResult[] = [];
  for (let index = 0; index < planned.length; index += 1) {
    const window = planned[index];
    console.log(`[skybitz:telematics] fetching window ${index + 1}/${planned.length}: ${window.from.toISOString()} to ${window.to.toISOString()}`);
    results.push(await fetchSkyBitzWindowedLocations(window.from, window.to, options.assetId));
  }
  return combineSourceResults(results);
}

async function resolveAssetIdsForFixedAsset(accessToken: string, companyId: string, fixedAssetNo: string) {
  const candidates = new Set<string>([fixedAssetNo]);
  const existing = await fetchTelematicsByFixedAsset(accessToken, companyId, fixedAssetNo, "SkyBitz");
  for (const row of existing) {
    if (row.providerAssetId) {
      candidates.add(row.providerAssetId);
    }
  }
  return [...candidates].filter(Boolean);
}

async function fetchSkyBitzLatestLocations(assetId: string): Promise<SourceFetchResult> {
  const accessToken = await getSkyBitzAccessToken();
  const url = new URL("QueryPositions", SKYBITZ_SERVICE_URL);
  url.searchParams.set("assetid", assetId === "ALL" ? "All" : assetId);
  url.searchParams.set("accessToken", accessToken);
  url.searchParams.set("version", SKYBITZ_VERSION);
  url.searchParams.set("sortby", "1");
  url.searchParams.set("getJson", "1");
  return fetchSkyBitzQuery(url, "SkyBitz QueryPositions failed");
}

async function fetchSkyBitzWindowedLocations(windowStart: Date, windowEnd: Date, assetId: string): Promise<SourceFetchResult> {
  const accessToken = await getSkyBitzAccessToken();
  const url = new URL("QueryPositions", SKYBITZ_SERVICE_URL);
  url.searchParams.set("assetid", assetId === "ALL" ? "All" : assetId);
  url.searchParams.set("accessToken", accessToken);
  url.searchParams.set("from", formatSkyBitzQueryDate(windowStart));
  url.searchParams.set("to", formatSkyBitzQueryDate(windowEnd));
  url.searchParams.set("version", SKYBITZ_VERSION);
  url.searchParams.set("sortby", "1");
  url.searchParams.set("getJson", "1");
  return fetchSkyBitzQuery(url, "SkyBitz QueryPositions windowed query failed");
}

async function fetchSkyBitzQuery(url: URL, errorPrefix: string): Promise<SourceFetchResult> {
  const { response, bodyText } = await skybitzQueryRequest(url);
  if (!response.ok) {
    throw new Error(`${errorPrefix} (${response.status}): ${bodyText}`);
  }
  const payload = JSON.parse(bodyText) as SkyBitzResponse;
  const responseErrorCode = normalizeText(payload.skybitz?.error);
  const responseErrorText = normalizeText(payload.skybitz?.errorText);
  if (responseErrorCode && responseErrorCode !== "0") {
    throw new Error(`SkyBitz query returned error ${responseErrorCode}: ${responseErrorText || "Unknown error"}`);
  }
  return {
    requestUrl: url.toString(),
    responseErrorCode,
    responseErrorText,
    records: toArray(payload.skybitz?.gls).map(normalizeLocation),
  };
}

async function skybitzQueryRequest(url: URL) {
  let lastBodyText = "";
  let lastStatus = 0;
  for (let attempt = 0; attempt <= MAX_SKYBITZ_RETRIES; attempt += 1) {
    const response = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store" });
    const bodyText = await response.text();
    if (response.ok || (response.status !== 503 && response.status !== 429)) {
      return { response, bodyText };
    }
    lastBodyText = bodyText;
    lastStatus = response.status;
    if (attempt >= MAX_SKYBITZ_RETRIES) {
      return { response, bodyText };
    }
    await sleep(Math.min(5000 * 2 ** attempt, 60000));
  }
  throw new Error(`SkyBitz query retry state exhausted (${lastStatus}): ${lastBodyText}`);
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
      failures.push(`${method} ${url} -> ${result.response.status}: ${payload?.error_description ?? payload?.error ?? result.bodyText}`);
    }
  }
  throw new Error(`SkyBitz token request failed.\n${failures.join("\n")}`);
}

async function discoverSkyBitzTokenCandidates() {
  const candidates = new Set<string>([process.env.SKYBITZ_TOKEN_URL?.trim() || SKYBITZ_DEFAULT_TOKEN_URL]);
  try {
    const response = await fetch(SKYBITZ_PROD_DISCOVERY_URL, { headers: { Accept: "application/json" }, cache: "no-store" });
    if (!response.ok) {
      return [...candidates];
    }
    const payload = (await response.json()) as OidcConfiguration;
    if (payload.token_endpoint) {
      candidates.add(normalizeTokenCandidate(payload.token_endpoint));
      candidates.add(normalizeTokenCandidate(buildProxyTokenUrl(payload.token_endpoint)));
    }
  } catch {
    return [...candidates];
  }
  return [...candidates];
}

async function requestSkyBitzToken(url: string, clientId: string, clientSecret: string, usePostBody: boolean) {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: usePostBody
        ? { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" }
        : {
            Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`, "utf8").toString("base64")}`,
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json",
          },
      body: usePostBody
        ? new URLSearchParams({ grant_type: "client_credentials", client_id: clientId, client_secret: clientSecret })
        : "grant_type=client_credentials",
    });
    return { response, bodyText: await response.text(), networkError: "" };
  } catch (error) {
    return { response: null, bodyText: "", networkError: error instanceof Error ? error.message : String(error) };
  }
}

function buildTelematicsPayload(location: NormalizedLocation, match: MatchResult, syncedAt: string): TelematicsTrackerPayload {
  const observationDateTime = parseSkyBitzDateTime(location.observationTime);
  const sourceSnapshot = {
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
    observationDateTime,
    quality: location.quality,
    landmarkName: location.landmarkName,
    landmarkState: location.landmarkState,
    landmarkCountry: location.landmarkCountry,
    landmarkDistance: location.landmarkDistance,
    landmarkDirection: location.landmarkDirection,
    geofenceStatus: location.geofenceStatus,
    departureGeofence: location.departureGeofence,
    serialSensors: location.serialSensors,
  };
  return {
    provider: "SkyBitz",
    providerTrackerId: truncate(location.mtsn || location.assetId || location.transactionId, 80),
    providerAssetId: truncate(location.assetId, 100),
    fixedAssetNo: truncate(match.fixedAssetNo, 50),
    fixedAssetSystemId: match.fixedAssetSystemId,
    assetType: truncate(location.assetType, 50),
    productType: "",
    groups: truncate(location.groups.join("|"), 250),
    messageId: truncate(location.transactionId, 80),
    observationDateTime: observationDateTime || undefined,
    receivedDateTime: undefined,
    latitude: location.latitude ?? undefined,
    longitude: location.longitude ?? undefined,
    battery: truncate(location.battery, 50),
    batteryVoltage: undefined,
    powerSource: truncate(location.externalPower, 50),
    speed: location.speed ?? undefined,
    heading: truncate(location.heading || (location.headingInDegrees === null ? "" : String(location.headingInDegrees)), 50),
    address: "",
    city: "",
    state: truncate(location.landmarkState, 50),
    country: truncate(location.landmarkCountry, 10),
    nearestGeofence: truncate(location.landmarkName, 100),
    geofenceStatus: truncate(location.geofenceStatus || location.departureGeofence, 50),
    matchStatus: match.matchStatus,
    matchedBy: match.matchedBy,
    syncStatus: match.matchStatus === "Matched" ? "Synced" : "Pending",
    lastSyncedAt: syncedAt,
    sourceHash: sha256(sourceSnapshot),
    lastError: truncate(match.message, 2048),
  };
}

function normalizeLocation(record: SkyBitzGlsRecord): NormalizedLocation {
  return {
    assetId: normalizeText(record.asset?.assetid),
    mtsn: normalizeText(record.mtsn),
    assetType: normalizeText(record.asset?.assettype),
    owner: normalizeText(record.asset?.owner),
    groups: normalizeGroups(record.asset?.groups),
    messageType: normalizeText(record.messagetype),
    latitude: toNumber(record.latitude),
    longitude: toNumber(record.longitude),
    speed: toNumber(record.speed),
    heading: normalizeText(record.heading),
    headingInDegrees: toNumber(record.headingindegrees),
    battery: normalizeText(record.battery),
    externalPower: normalizeText(record.extpwr),
    observationTime: normalizeText(record.time),
    quality: normalizeText(record.quality),
    landmarkName: normalizeText(record.landmark?.geoname),
    landmarkState: normalizeText(record.landmark?.state),
    landmarkCountry: normalizeText(record.landmark?.country),
    landmarkDistance: toNumber(record.landmark?.distance),
    landmarkDirection: normalizeText(record.landmark?.direction),
    geofenceStatus: normalizeText(record.skyfence?.skyfencestatus),
    departureGeofence: normalizeText(record.skyfence?.departureskyfence),
    serialSensors: normalizeSerialSensors(record.serial),
    transactionId: normalizeText(record.transid),
  };
}

function collapseLatestByTracker(locations: NormalizedLocation[]) {
  const exactSeen = new Set<string>();
  const latestByMtsn = new Map<string, NormalizedLocation>();
  for (const location of locations) {
    const key = truncate(location.mtsn || location.assetId, 80);
    if (!key) {
      continue;
    }
    const observationDateTime = parseSkyBitzDateTime(location.observationTime);
    const exactKey = `${key}::${observationDateTime}`;
    if (exactSeen.has(exactKey)) {
      continue;
    }
    exactSeen.add(exactKey);
    const existing = latestByMtsn.get(key);
    if (!existing || compareSkyBitzTimes(location, existing) >= 0) {
      latestByMtsn.set(key, location);
    }
  }
  return { distinctMessages: exactSeen.size, latestPerTracker: [...latestByMtsn.values()] };
}

function compareSkyBitzTimes(left: NormalizedLocation, right: NormalizedLocation) {
  return timestamp(parseSkyBitzDateTime(left.observationTime)) - timestamp(parseSkyBitzDateTime(right.observationTime));
}

function timestamp(value: string) {
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseSkyBitzDateTime(value: string) {
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{4})\/(\d{2})\/(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
  if (!match) {
    return "";
  }
  const [, year, month, day, hour, minute, second] = match;
  return `${year}-${month}-${day}T${hour}:${minute}:${second}Z`;
}

function buildWindowPlans(start: Date, end: Date, chunkMinutes: number, overlapMinutes: number) {
  const windows: Array<{ from: Date; to: Date }> = [];
  const chunkMs = chunkMinutes * 60 * 1000;
  const overlapMs = overlapMinutes * 60 * 1000;
  let cursor = new Date(start);
  while (cursor < end) {
    const next = new Date(Math.min(cursor.getTime() + chunkMs, end.getTime()));
    windows.push({ from: new Date(cursor), to: next });
    if (next >= end) {
      break;
    }
    cursor = new Date(next.getTime() - overlapMs);
  }
  return windows;
}

function formatSkyBitzQueryDate(date: Date) {
  const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  return `${String(date.getUTCDate()).padStart(2, "0")}/${months[date.getUTCMonth()]}/${date.getUTCFullYear()}-${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}:${String(date.getUTCSeconds()).padStart(2, "0")}`;
}

function combineSourceResults(results: SourceFetchResult[]): SourceFetchResult {
  return {
    requestUrl: results.map((result) => redactAccessToken(result.requestUrl)).join(";"),
    responseErrorCode: results.find((result) => result.responseErrorCode)?.responseErrorCode ?? "",
    responseErrorText: results.find((result) => result.responseErrorText)?.responseErrorText ?? "",
    records: results.flatMap((result) => result.records),
  };
}

function normalizeGroups(groups: SkyBitzGlsRecord["asset"] extends infer T ? T extends { groups?: infer TGroups } ? TGroups | undefined : never : never) {
  return toArray(groups?.groupname).map((group) => normalizeText(group)).filter(Boolean);
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

function toArray<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) {
    return value;
  }
  if (value === null || value === undefined) {
    return [];
  }
  return [value];
}

function parseDate(value: string, flagName: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${flagName} must be a valid ISO 8601 datetime.`);
  }
  return parsed;
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

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

function sha256(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function buildErrorSummary(errors: string[]) {
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

function redactAccessToken(value: string) {
  return value.replace(/([?&]accessToken=)[^&;]+/gi, "$1REDACTED");
}

async function writeSummary(outputPath: string, summary: unknown) {
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(summary, null, 2));
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exit(1);
});

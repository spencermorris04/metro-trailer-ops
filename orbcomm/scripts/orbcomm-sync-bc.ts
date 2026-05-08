import {
  OrbcommAssetStatusRecord,
  fetchOrbcommAssetStatus,
} from "./orbcomm-client";
import { readFile } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";
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
  sha256,
  toBcDateTime,
  toNumber,
  truncate,
  updateTelematicsSyncRun,
  upsertTelematicsTracker,
} from "../../telematics/scripts/shared";

type Options = {
  write: boolean;
  concurrency: number;
  limit: number | null;
  from: string | null;
  to: string | null;
  sinceLastSuccessfulRun: boolean;
  fixedAssetNo: string;
  assetName: string;
  maxLookbackHours: number;
  windowChunkMinutes: number;
  sleepBetweenWindowsSeconds: number;
  inputFile: string;
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

type NormalizedOrbcommStatus = {
  messageId: string;
  providerTrackerId: string;
  providerAssetId: string;
  assetType: string;
  productType: string;
  observationDateTime: string;
  receivedDateTime: string;
  latitude: number | null;
  longitude: number | null;
  battery: string;
  batteryVoltage: number | null;
  powerSource: string;
  speed: number | null;
  heading: string;
  address: string;
  city: string;
  state: string;
  country: string;
  nearestGeofence: string;
  geofenceStatus: string;
};

const JOB_VERSION = "orbcomm-sync-bc-v1";
const MAX_ERROR_SUMMARY_LENGTH = 2048;
const MIN_ADAPTIVE_WINDOW_MINUTES = 15;

function parseArgs(): Options {
  const args = process.argv.slice(2);
  const get = (name: string) => {
    const prefix = `--${name}=`;
    return args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) ?? "";
  };
  return {
    write: args.includes("--write"),
    concurrency: Number(get("concurrency") || "3"),
    limit: get("limit") ? Number(get("limit")) : null,
    from: get("from") || null,
    to: get("to") || null,
    sinceLastSuccessfulRun: args.includes("--since-last-successful-run"),
    fixedAssetNo: get("fixed-asset-no") || get("assetid") || "",
    assetName: get("asset-name") || "",
    maxLookbackHours: Number(get("max-lookback-hours") || "24"),
    windowChunkMinutes: Number(get("window-chunk-minutes") || "60"),
    sleepBetweenWindowsSeconds: Number(get("sleep-between-windows-seconds") || "0"),
    inputFile: get("input-file"),
  };
}

async function main() {
  const options = parseArgs();
  const startedAt = new Date().toISOString();
  const accessToken = await getBcAccessToken();
  const companyId = await resolveCompanyId(accessToken);
  const existingState = await fetchExistingTelematicsTrackers(accessToken, companyId);
  if (!existingState.apiAvailable && options.write) {
    throw new Error("Telematics API is not available in Business Central. Upload the Telematics extension before writing.");
  }

  const sourceWindow = await resolveSourceWindow(accessToken, companyId, options);
  const statuses = await fetchSourceStatuses(accessToken, companyId, options, sourceWindow);
  const latest = collapseLatestByTracker(statuses);
  const limited = options.limit ? latest.slice(0, options.limit) : latest;
  const fixedAssets = await fetchAllFixedAssets(accessToken);
  const indexes = buildFixedAssetIndexes(fixedAssets);
  const runId = `orbcomm-${new Date().toISOString()}`;
  const counters: Counters = createCounters(limited.length);
  const errors: string[] = [];

  const runPayload = buildRunPayload(runId, startedAt, "Running", counters, "", sourceWindow.from, sourceWindow.to);
  const createdRun = await createTelematicsSyncRun(accessToken, companyId, runPayload, options.write);
  const syncedAt = new Date().toISOString();

  await runWithConcurrency(limited, options.concurrency, async (status) => {
    const match = matchFixedAssetByProviderAssetId(status.providerAssetId, indexes);
    if (match.matchStatus === "Matched") {
      counters.matchedCount += 1;
    } else {
      counters.unmatchedCount += 1;
    }

    const payload = buildTelematicsPayload(status, match, syncedAt);
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
          provider: "ORBCOMM",
          providerTrackerId: payload.providerTrackerId,
          providerAssetId: payload.providerAssetId,
          errorType: "Api",
          errorMessage: truncate(message, 2048),
          rawPayloadPointer: truncate(`messageId=${status.messageId}`, 2048),
          createdAt: new Date().toISOString(),
          resolved: false,
        },
        options.write,
      );
    }
  });

  const finalStatus = counters.recordsFailed > 0 ? "PartialFailure" : "Succeeded";
  const finalPayload = buildRunPayload(runId, startedAt, finalStatus, counters, buildErrorSummary(errors), sourceWindow.from, sourceWindow.to);
  await updateTelematicsSyncRun(accessToken, companyId, createdRun.id, finalPayload, options.write);

  console.log(JSON.stringify({ write: options.write, companyId, ...finalPayload }, null, 2));
}

async function resolveSourceWindow(accessToken: string, companyId: string, options: Options) {
  if (options.fixedAssetNo || options.assetName) {
    return { from: null as string | null, to: null as string | null };
  }

  const to = options.to ? new Date(options.to) : new Date();
  let from = options.from ? new Date(options.from) : new Date(to.getTime() - options.maxLookbackHours * 60 * 60 * 1000);
  if (options.sinceLastSuccessfulRun) {
    const latest = await fetchLatestSuccessfulTelematicsRun(accessToken, companyId, "ORBCOMM");
    if (latest?.sourceWindowEnd) {
      from = new Date(latest.sourceWindowEnd);
    }
  }

  const maxFrom = new Date(to.getTime() - options.maxLookbackHours * 60 * 60 * 1000);
  if (from < maxFrom) {
    from = maxFrom;
  }
  return { from: from.toISOString(), to: to.toISOString() };
}

async function fetchSourceStatuses(
  accessToken: string,
  companyId: string,
  options: Options,
  sourceWindow: { from: string | null; to: string | null },
) {
  if (options.inputFile) {
    const parsed = JSON.parse(await readFile(options.inputFile, "utf8")) as OrbcommAssetStatusRecord[];
    const normalized = parsed.map(normalizeOrbcommStatus).filter((record) => record.providerTrackerId || record.providerAssetId);
    console.log(JSON.stringify({ provider: "ORBCOMM", inputFile: options.inputFile, inputRecords: parsed.length, recordsFetched: normalized.length }));
    return normalized;
  }

  const records: NormalizedOrbcommStatus[] = [];
  const assetNames = await resolveAssetNames(accessToken, companyId, options);
  const windows = buildSourceWindows(sourceWindow, options.windowChunkMinutes);

  for (let windowIndex = 0; windowIndex < windows.length; windowIndex += 1) {
    const window = windows[windowIndex];
    const windowRecords = await fetchWindowRecords(window, assetNames);
    records.push(...windowRecords);
    console.log(
      JSON.stringify({
        provider: "ORBCOMM",
        windowIndex: windowIndex + 1,
        windowCount: windows.length,
        windowFrom: window.from,
        windowTo: window.to,
        windowRecords: windowRecords.length,
        recordsFetched: records.length,
      }),
    );

    if (options.sleepBetweenWindowsSeconds > 0 && windowIndex < windows.length - 1) {
      console.log(JSON.stringify({ provider: "ORBCOMM", sleepingSeconds: options.sleepBetweenWindowsSeconds, nextWindowIndex: windowIndex + 1 }));
      await sleep(options.sleepBetweenWindowsSeconds * 1000);
    }
  }

  return records;
}

async function fetchWindowRecords(window: { from: string | null; to: string | null }, assetNames: string[]): Promise<NormalizedOrbcommStatus[]> {
  try {
    return await fetchWindowRecordsPageByPage(window, assetNames);
  } catch (error) {
    if (!shouldSplitWindow(window, error)) {
      throw error;
    }

    const [left, right] = splitWindow(window);
    console.warn(
      JSON.stringify({
        provider: "ORBCOMM",
        event: "split-window-after-failure",
        windowFrom: window.from,
        windowTo: window.to,
        leftFrom: left.from,
        leftTo: left.to,
        rightFrom: right.from,
        rightTo: right.to,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    return [...(await fetchWindowRecords(left, assetNames)), ...(await fetchWindowRecords(right, assetNames))];
  }
}

async function fetchWindowRecordsPageByPage(window: { from: string | null; to: string | null }, assetNames: string[]) {
  const records: NormalizedOrbcommStatus[] = [];
  let watermark: unknown = null;
  do {
    const body: Record<string, unknown> = {
      assetNames,
      assetGroupNames: [],
      watermark,
    };
    if (window.from && window.to) {
      body.fromDate = window.from;
      body.toDate = window.to;
    }

    const response = await fetchOrbcommAssetStatus(body);
    const normalized = (response.data ?? []).map(normalizeOrbcommStatus).filter((record) => record.providerTrackerId || record.providerAssetId);
    records.push(...normalized);
    watermark = response.watermark ?? null;
    console.log(
      JSON.stringify({
        provider: "ORBCOMM",
        windowFrom: window.from,
        windowTo: window.to,
        pageRecords: normalized.length,
        windowRecords: records.length,
        hasMore: Boolean(watermark),
      }),
    );
  } while (watermark);
  return records;
}

function shouldSplitWindow(window: { from: string | null; to: string | null }, error: unknown) {
  const minutes = windowDurationMinutes(window);
  if (minutes <= MIN_ADAPTIVE_WINDOW_MINUTES) {
    return false;
  }

  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return message.includes("504") || message.includes("timeout") || message.includes("timed out") || message.includes("aborted");
}

function splitWindow(window: { from: string | null; to: string | null }) {
  if (!window.from || !window.to) {
    throw new Error("Cannot split an open-ended ORBCOMM window.");
  }
  const from = new Date(window.from);
  const to = new Date(window.to);
  const middle = new Date(from.getTime() + Math.floor((to.getTime() - from.getTime()) / 2));
  return [
    { from: from.toISOString(), to: middle.toISOString() },
    { from: middle.toISOString(), to: to.toISOString() },
  ];
}

function windowDurationMinutes(window: { from: string | null; to: string | null }) {
  if (!window.from || !window.to) {
    return 0;
  }
  return (new Date(window.to).getTime() - new Date(window.from).getTime()) / 60_000;
}

function buildSourceWindows(sourceWindow: { from: string | null; to: string | null }, windowChunkMinutes: number) {
  if (!sourceWindow.from || !sourceWindow.to || windowChunkMinutes <= 0) {
    return [sourceWindow];
  }

  const windows: Array<{ from: string; to: string }> = [];
  const end = new Date(sourceWindow.to);
  let cursor = new Date(sourceWindow.from);
  while (cursor < end) {
    const next = new Date(Math.min(cursor.getTime() + windowChunkMinutes * 60 * 1000, end.getTime()));
    windows.push({ from: cursor.toISOString(), to: next.toISOString() });
    cursor = next;
  }
  return windows;
}

async function resolveAssetNames(accessToken: string, companyId: string, options: Options) {
  const candidates = new Set<string>();
  if (options.assetName) {
    candidates.add(options.assetName);
  }
  if (options.fixedAssetNo) {
    candidates.add(options.fixedAssetNo);
    const existing = await fetchTelematicsByFixedAsset(accessToken, companyId, options.fixedAssetNo, "ORBCOMM");
    for (const row of existing) {
      if (row.providerAssetId) {
        candidates.add(row.providerAssetId);
      }
    }
    const fixedAssets = await fetchAllFixedAssets(accessToken);
    const fixedAsset = fixedAssets.find((row) => row.no === options.fixedAssetNo);
    if (fixedAsset?.serviceItemNo) {
      candidates.add(fixedAsset.serviceItemNo);
    }
    if (fixedAsset?.mtrz) {
      candidates.add(fixedAsset.mtrz);
    }
  }
  return [...candidates].filter(Boolean);
}

function normalizeOrbcommStatus(record: OrbcommAssetStatusRecord): NormalizedOrbcommStatus {
  const asset = record.assetStatus ?? {};
  const position = record.positionStatus ?? {};
  const providerAssetId = normalizeText(asset.assetName);
  const providerTrackerId = normalizeText(asset.deviceSN) || providerAssetId || normalizeText(record.messageId);
  const nearestGeofence = normalizeText(position.nearestGeofence) || normalizeText(position.geofenceName);

  return {
    messageId: normalizeText(record.messageId),
    providerTrackerId,
    providerAssetId,
    assetType: normalizeText(asset.assetType),
    productType: normalizeText(asset.productType),
    observationDateTime: normalizeText(asset.messageStamp),
    receivedDateTime: normalizeText(asset.messageReceivedStamp),
    latitude: toNumber(position.latitude),
    longitude: toNumber(position.longitude),
    battery: normalizeText(asset.batteryStatus),
    batteryVoltage: toNumber(asset.batteryVoltage),
    powerSource: normalizeText(asset.powerSource),
    speed: toNumber(asset.speed),
    heading: normalizeText(position.direction),
    address: normalizeText(position.address),
    city: normalizeText(position.city),
    state: normalizeText(position.state),
    country: normalizeText(position.country),
    nearestGeofence,
    geofenceStatus: normalizeText(position.geofenceStatus),
  };
}

function collapseLatestByTracker(records: NormalizedOrbcommStatus[]) {
  const byTracker = new Map<string, NormalizedOrbcommStatus>();
  for (const record of records) {
    const key = record.providerTrackerId || record.providerAssetId;
    const existing = byTracker.get(key);
    if (!existing || timestamp(record) >= timestamp(existing)) {
      byTracker.set(key, record);
    }
  }
  return [...byTracker.values()];
}

function timestamp(record: NormalizedOrbcommStatus) {
  const parsed = new Date(record.observationDateTime || record.receivedDateTime).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildTelematicsPayload(status: NormalizedOrbcommStatus, match: MatchResult, syncedAt: string): TelematicsTrackerPayload {
  const sourceHash = sha256(status);
  return {
    provider: "ORBCOMM",
    providerTrackerId: truncate(status.providerTrackerId || status.providerAssetId || status.messageId, 80),
    providerAssetId: truncate(status.providerAssetId, 100),
    fixedAssetNo: truncate(match.fixedAssetNo, 50),
    fixedAssetSystemId: match.fixedAssetSystemId,
    assetType: truncate(status.assetType, 50),
    productType: truncate(status.productType, 50),
    groups: "",
    messageId: truncate(status.messageId, 80),
    observationDateTime: toBcDateTime(status.observationDateTime),
    receivedDateTime: toBcDateTime(status.receivedDateTime),
    latitude: status.latitude ?? undefined,
    longitude: status.longitude ?? undefined,
    battery: truncate(status.battery, 50),
    batteryVoltage: status.batteryVoltage ?? undefined,
    powerSource: truncate(status.powerSource, 50),
    speed: status.speed ?? undefined,
    heading: truncate(status.heading, 50),
    address: truncate(status.address, 250),
    city: truncate(status.city, 100),
    state: truncate(status.state, 50),
    country: truncate(status.country, 10),
    nearestGeofence: truncate(status.nearestGeofence, 100),
    geofenceStatus: truncate(status.geofenceStatus, 50),
    matchStatus: match.matchStatus,
    matchedBy: match.matchedBy,
    syncStatus: match.matchStatus === "Matched" ? "Synced" : "Pending",
    lastSyncedAt: syncedAt,
    sourceHash,
    lastError: truncate(match.message, 2048),
  };
}

function buildRunPayload(
  runId: string,
  startedAt: string,
  status: "Running" | "Succeeded" | "PartialFailure" | "Failed",
  counters: Counters,
  errorSummary: string,
  sourceWindowStart: string | null,
  sourceWindowEnd: string | null,
) {
  return {
    runId,
    provider: "ORBCOMM" as const,
    startedAt,
    finishedAt: status === "Running" ? undefined : new Date().toISOString(),
    status,
    sourceWindowStart: sourceWindowStart ?? undefined,
    sourceWindowEnd: sourceWindowEnd ?? undefined,
    recordsSeen: counters.recordsSeen,
    recordsInserted: counters.recordsInserted,
    recordsUpdated: counters.recordsUpdated,
    recordsSkipped: counters.recordsSkipped,
    recordsFailed: counters.recordsFailed,
    matchedCount: counters.matchedCount,
    unmatchedCount: counters.unmatchedCount,
    errorSummary,
    jobVersion: JOB_VERSION,
  };
}

function createCounters(recordsSeen: number): Counters {
  return {
    recordsSeen,
    recordsInserted: 0,
    recordsUpdated: 0,
    recordsSkipped: 0,
    recordsFailed: 0,
    matchedCount: 0,
    unmatchedCount: 0,
  };
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

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exit(1);
});

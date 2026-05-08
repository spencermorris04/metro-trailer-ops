import {
  ExistingTelematicsTracker,
  TelematicsTrackerPayload,
  bcRequest,
  createTelematicsSyncRun,
  fetchExistingTelematicsTrackers,
  getBcAccessToken,
  getBcBaseApiRoot,
  normalizeText,
  resolveCompanyId,
  runWithConcurrency,
  sha256,
  toBcDateTime,
  toNumber,
  truncate,
  updateTelematicsSyncRun,
  upsertTelematicsTracker,
} from "./shared";

type ExistingSkyBitzTracker = {
  id: string;
  mtsn?: string;
  skybitzAssetId?: string;
  fixedAssetNo?: string;
  fixedAssetSystemId?: string;
  assetType?: string;
  groups?: string;
  latitude?: number;
  longitude?: number;
  speed?: number;
  heading?: string;
  battery?: string;
  externalPower?: string;
  observationDateTime?: string;
  landmarkName?: string;
  landmarkState?: string;
  landmarkCountry?: string;
  geofenceStatus?: string;
  matchStatus?: string;
  matchedBy?: string;
  syncStatus?: string;
  lastSyncedAt?: string;
  sourceHash?: string;
  lastError?: string;
};

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (name: string) => {
    const prefix = `--${name}=`;
    return args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) ?? "";
  };
  return {
    write: args.includes("--write"),
    fixedAssetNo: get("fixed-asset-no") || get("assetid"),
    limit: get("limit") ? Number(get("limit")) : null,
    concurrency: Number(get("concurrency") || "4"),
  };
}

async function main() {
  const options = parseArgs();
  const accessToken = await getBcAccessToken();
  const companyId = await resolveCompanyId(accessToken);
  const skybitzRows = await fetchSkyBitzRows(accessToken, companyId, options.fixedAssetNo);
  const limited = options.limit ? skybitzRows.slice(0, options.limit) : skybitzRows;
  const existingState = await fetchExistingTelematicsTrackers(accessToken, companyId);
  if (!existingState.apiAvailable && options.write) {
    throw new Error("Telematics API is not available in Business Central. Upload the Telematics extension before writing.");
  }

  const startedAt = new Date().toISOString();
  const runId = `skybitz-backfill-${compactTimestamp(startedAt)}`;
  const counters = {
    recordsSeen: limited.length,
    recordsInserted: 0,
    recordsUpdated: 0,
    recordsSkipped: 0,
    recordsFailed: 0,
    matchedCount: 0,
    unmatchedCount: 0,
  };
  const createdRun = await createTelematicsSyncRun(
    accessToken,
    companyId,
    {
      runId,
      provider: "SkyBitz",
      startedAt,
      status: "Running",
      recordsSeen: counters.recordsSeen,
      recordsInserted: 0,
      recordsUpdated: 0,
      recordsSkipped: 0,
      recordsFailed: 0,
      matchedCount: 0,
      unmatchedCount: 0,
      errorSummary: "",
      jobVersion: "telematics-backfill-skybitz-v1",
    },
    options.write,
  );

  await runWithConcurrency(limited, options.concurrency, async (row) => {
    const payload = buildTelematicsPayload(row);
    if (payload.matchStatus === "Matched") {
      counters.matchedCount += 1;
    } else {
      counters.unmatchedCount += 1;
    }
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
      counters.recordsFailed += 1;
      console.error(`[telematics] SkyBitz backfill failed for ${payload.providerTrackerId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  await updateTelematicsSyncRun(
    accessToken,
    companyId,
    createdRun.id,
    {
      runId,
      provider: "SkyBitz",
      startedAt,
      finishedAt: new Date().toISOString(),
      status: counters.recordsFailed > 0 ? "PartialFailure" : "Succeeded",
      recordsSeen: counters.recordsSeen,
      recordsInserted: counters.recordsInserted,
      recordsUpdated: counters.recordsUpdated,
      recordsSkipped: counters.recordsSkipped,
      recordsFailed: counters.recordsFailed,
      matchedCount: counters.matchedCount,
      unmatchedCount: counters.unmatchedCount,
      errorSummary: "",
      jobVersion: "telematics-backfill-skybitz-v1",
    },
    options.write,
  );

  console.log(JSON.stringify({ write: options.write, companyId, ...counters }, null, 2));
}

async function fetchSkyBitzRows(accessToken: string, companyId: string, fixedAssetNo: string) {
  const rows: ExistingSkyBitzTracker[] = [];
  const pageSize = 5000;
  let skip = 0;
  const filter = fixedAssetNo ? `&$filter=fixedAssetNo eq '${fixedAssetNo.replace(/'/g, "''")}'` : "";

  while (true) {
    const url =
      `${getBcBaseApiRoot()}/api/metroTrailer/skybitz/v1.0/companies(${companyId})/skybitzTrackers` +
      `?$top=${pageSize}&$skip=${skip}&$orderby=mtsn${filter}`;
    const { response, bodyText } = await bcRequest(url, accessToken);
    if (!response.ok) {
      throw new Error(`Unable to fetch SkyBitz trackers (${response.status}): ${bodyText}`);
    }
    const parsed = JSON.parse(bodyText) as { value?: ExistingSkyBitzTracker[] };
    const page = parsed.value ?? [];
    rows.push(...page);
    if (page.length < pageSize) {
      break;
    }
    skip += pageSize;
  }
  return rows;
}

function buildTelematicsPayload(row: ExistingSkyBitzTracker): TelematicsTrackerPayload {
  const matchStatus = mapMatchStatus(row.matchStatus);
  const matchedBy = mapMatchedBy(row.matchedBy);
  const payloadSource = {
    provider: "SkyBitz",
    mtsn: normalizeText(row.mtsn),
    skybitzAssetId: normalizeText(row.skybitzAssetId),
    observationDateTime: normalizeText(row.observationDateTime),
    latitude: row.latitude,
    longitude: row.longitude,
    battery: normalizeText(row.battery),
    geofenceStatus: normalizeText(row.geofenceStatus),
  };

  return {
    provider: "SkyBitz",
    providerTrackerId: truncate(normalizeText(row.mtsn), 80),
    providerAssetId: truncate(normalizeText(row.skybitzAssetId), 100),
    fixedAssetNo: truncate(normalizeText(row.fixedAssetNo), 50),
    fixedAssetSystemId: normalizeText(row.fixedAssetSystemId) || undefined,
    assetType: truncate(normalizeText(row.assetType), 50),
    productType: "",
    groups: truncate(normalizeText(row.groups), 250),
    messageId: "",
    observationDateTime: toBcDateTime(normalizeText(row.observationDateTime)),
    latitude: toNumber(row.latitude) ?? undefined,
    longitude: toNumber(row.longitude) ?? undefined,
    battery: truncate(normalizeText(row.battery), 50),
    powerSource: truncate(normalizeText(row.externalPower), 50),
    speed: toNumber(row.speed) ?? undefined,
    heading: truncate(normalizeText(row.heading), 50),
    address: "",
    city: "",
    state: truncate(normalizeText(row.landmarkState), 50),
    country: truncate(normalizeText(row.landmarkCountry), 10),
    nearestGeofence: truncate(normalizeText(row.landmarkName), 100),
    geofenceStatus: truncate(normalizeText(row.geofenceStatus), 50),
    matchStatus,
    matchedBy,
    syncStatus: mapSyncStatus(row.syncStatus),
    lastSyncedAt: toBcDateTime(normalizeText(row.lastSyncedAt)),
    sourceHash: normalizeText(row.sourceHash) || sha256(payloadSource),
    lastError: truncate(normalizeText(row.lastError), 2048),
  };
}

function mapMatchStatus(value: string | undefined) {
  const normalized = normalizeText(value);
  if (["Matched", "Unmatched", "Ambiguous", "Error"].includes(normalized)) {
    return normalized as ExistingTelematicsTracker["matchStatus"];
  }
  return "Unknown";
}

function mapMatchedBy(value: string | undefined) {
  const normalized = normalizeText(value);
  if (["None", "AssetNo", "ServiceItemNo", "MTRZ", "AssetNoDigits", "ServiceItemNoDigits", "MTRZDigits", "Manual"].includes(normalized)) {
    return normalized as ExistingTelematicsTracker["matchedBy"];
  }
  return "None";
}

function mapSyncStatus(value: string | undefined) {
  const normalized = normalizeText(value);
  if (["Pending", "Synced", "Failed", "Skipped"].includes(normalized)) {
    return normalized as ExistingTelematicsTracker["syncStatus"];
  }
  return "Pending";
}

function compactTimestamp(value: string) {
  return value.replace(/[-:.]/g, "").replace("T", "-").replace("Z", "");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exit(1);
});

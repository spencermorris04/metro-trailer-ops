import { createHash } from "node:crypto";

import { config as loadEnv } from "dotenv";

loadEnv();

export type TelematicsProvider = "SkyBitz" | "ORBCOMM";
export type MatchStatus = "Unknown" | "Matched" | "Unmatched" | "Ambiguous" | "Error";
export type MatchedBy =
  | "None"
  | "AssetNo"
  | "ServiceItemNo"
  | "MTRZ"
  | "AssetNoDigits"
  | "ServiceItemNoDigits"
  | "MTRZDigits"
  | "Manual";
export type SyncStatus = "Pending" | "Synced" | "Failed" | "Skipped";
export type SyncRunStatus = "Running" | "Succeeded" | "PartialFailure" | "Failed";
export type ErrorType = "Unknown" | "Validation" | "AssetMatch" | "Api" | "Permission" | "Auth";

export type FixedAssetIndexRow = {
  no: string;
  serviceItemNo: string;
  mtrz: string;
};

export type MatchResult = {
  matchStatus: MatchStatus;
  matchedBy: MatchedBy;
  fixedAssetNo: string;
  fixedAssetSystemId?: string;
  message: string;
};

export type TelematicsTrackerPayload = {
  provider: TelematicsProvider;
  providerTrackerId: string;
  providerAssetId: string;
  fixedAssetNo: string;
  fixedAssetSystemId?: string;
  assetType: string;
  productType: string;
  groups: string;
  messageId: string;
  observationDateTime?: string;
  receivedDateTime?: string;
  latitude?: number;
  longitude?: number;
  battery: string;
  batteryVoltage?: number;
  powerSource: string;
  speed?: number;
  heading: string;
  address: string;
  city: string;
  state: string;
  country: string;
  nearestGeofence: string;
  geofenceStatus: string;
  matchStatus: MatchStatus;
  matchedBy: MatchedBy;
  syncStatus: SyncStatus;
  lastSyncedAt?: string;
  sourceHash: string;
  lastError: string;
};

export type ExistingTelematicsTracker = TelematicsTrackerPayload & {
  id: string;
};

export type TelematicsSyncRunPayload = {
  runId: string;
  provider: TelematicsProvider;
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
  matchedCount: number;
  unmatchedCount: number;
  errorSummary: string;
  jobVersion: string;
};

export type TelematicsSyncErrorPayload = {
  runId: string;
  provider: TelematicsProvider;
  providerTrackerId: string;
  providerAssetId: string;
  errorType: ErrorType;
  errorMessage: string;
  rawPayloadPointer: string;
  createdAt: string;
  resolved: boolean;
};

let cachedBcAccessToken: string | null = null;

export function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

export function optionalEnv(name: string, fallback = "") {
  return process.env[name]?.trim() || fallback;
}

export function normalizeText(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value).trim();
}

export function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export function truncate(value: string, maxLength: number) {
  return value.length <= maxLength ? value : value.slice(0, maxLength);
}

export function sha256(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function toBcDateTime(value: string | null | undefined) {
  if (!value) {
    return undefined;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }
  return parsed.toISOString();
}

export function escapeODataString(value: string) {
  return value.replace(/'/g, "''");
}

export function getBcBaseApiRoot() {
  const environment = requireEnv("METRO_BC_ENVIRONMENT");
  const tenant = process.env.METRO_GRAPH_TENANT_ID?.trim();
  if (tenant) {
    return `https://api.businesscentral.dynamics.com/v2.0/${encodeURIComponent(tenant)}/${encodeURIComponent(environment)}`;
  }
  return `https://api.businesscentral.dynamics.com/v2.0/${encodeURIComponent(environment)}`;
}

export function getTelematicsApiRoot(companyId: string) {
  const publisher = process.env.TELEMATICS_BC_API_PUBLISHER?.trim() || "metroTrailer";
  const group = process.env.TELEMATICS_BC_API_GROUP?.trim() || "telematics";
  const version = process.env.TELEMATICS_BC_API_VERSION?.trim() || "v1.0";
  return `${getBcBaseApiRoot()}/api/${encodeURIComponent(publisher)}/${encodeURIComponent(group)}/${encodeURIComponent(version)}/companies(${companyId})`;
}

export async function getBcAccessToken() {
  if (cachedBcAccessToken) {
    return cachedBcAccessToken;
  }

  const tenantId = requireEnv("METRO_GRAPH_TENANT_ID");
  const clientId = requireEnv("METRO_GRAPH_CLIENT_ID");
  const clientSecret = requireEnv("METRO_GRAPH_CLIENT_SECRET");
  const response = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "client_credentials",
      scope: "https://api.businesscentral.dynamics.com/.default",
    }),
  });
  const bodyText = await response.text();
  if (!response.ok) {
    throw new Error(`Unable to obtain Business Central token (${response.status}): ${bodyText}`);
  }

  const parsed = JSON.parse(bodyText) as { access_token?: string };
  if (!parsed.access_token) {
    throw new Error("Business Central token response did not include access_token.");
  }
  cachedBcAccessToken = parsed.access_token;
  return cachedBcAccessToken;
}

export async function bcRequest(url: string, accessToken: string, init?: RequestInit) {
  let token = cachedBcAccessToken ?? accessToken;
  let refreshed = false;

  for (let attempt = 0; attempt < 6; attempt += 1) {
    let response: Response;
    let bodyText = "";
    try {
      response = await fetch(url, {
        ...init,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          ...(init?.headers ?? {}),
        },
      });
      bodyText = await response.text();
    } catch (error) {
      if (attempt < 5) {
        await sleep(1000 * (attempt + 1));
        continue;
      }
      throw error;
    }

    if (response.status === 401 && !refreshed) {
      cachedBcAccessToken = null;
      token = await getBcAccessToken();
      refreshed = true;
      continue;
    }

    if ((response.status === 429 || response.status === 503) && attempt < 5) {
      await sleep(1000 * Math.pow(2, attempt));
      continue;
    }

    return { response, bodyText };
  }

  throw new Error(`Business Central request retry loop exhausted for ${url}`);
}

export async function resolveCompanyId(accessToken: string) {
  const configured = process.env.METRO_BC_COMPANY_ID?.trim();
  if (configured) {
    return configured;
  }

  const companyName = requireEnv("METRO_BC_COMPANY");
  const { response, bodyText } = await bcRequest(`${getBcBaseApiRoot()}/api/v2.0/companies`, accessToken);
  if (!response.ok) {
    throw new Error(`Unable to load BC companies (${response.status}): ${bodyText}`);
  }

  const parsed = JSON.parse(bodyText) as { value?: Array<{ id?: string; name?: string }> };
  const company = (parsed.value ?? []).find((entry) => entry.name === companyName);
  if (!company?.id) {
    throw new Error(`Unable to find Business Central company named ${companyName}.`);
  }
  return company.id;
}

export async function fetchAllFixedAssets(accessToken: string) {
  const company = requireEnv("METRO_BC_COMPANY");
  const rows: FixedAssetIndexRow[] = [];
  let skip = 0;
  const top = 1000;

  while (true) {
    const url = new URL(`${getBcBaseApiRoot()}/ODataV4/Company('${encodeURIComponent(company).replace(/'/g, "''")}')/FixedAssets`);
    url.searchParams.set("$top", String(top));
    url.searchParams.set("$skip", String(skip));
    url.searchParams.set("$select", "No,RMI_Service_Item_No,MTRZ");

    const { response, bodyText } = await bcRequest(url.toString(), accessToken);
    if (!response.ok) {
      throw new Error(`Unable to fetch BC FixedAssets (${response.status}): ${bodyText}`);
    }

    const parsed = JSON.parse(bodyText) as { value?: Array<Record<string, unknown>> };
    const page = parsed.value ?? [];
    for (const row of page) {
      rows.push({
        no: normalizeText(row.No),
        serviceItemNo: normalizeText(row.RMI_Service_Item_No),
        mtrz: normalizeText(row.MTRZ),
      });
    }

    if (page.length < top) {
      break;
    }
    skip += top;
  }

  return rows;
}

export function buildFixedAssetIndexes(rows: FixedAssetIndexRow[]) {
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
    addIndexValue(byNoDigits, row.no.replace(/\D/g, ""), row.no);
    addIndexValue(byServiceItemDigits, row.serviceItemNo.replace(/\D/g, ""), row.no);
    addIndexValue(byMtrzDigits, row.mtrz.replace(/\D/g, ""), row.no);
  }

  return { byNo, byServiceItemNo, byMtrz, byNoDigits, byServiceItemDigits, byMtrzDigits, rows };
}

export function matchFixedAssetByProviderAssetId(providerAssetId: string, indexes: ReturnType<typeof buildFixedAssetIndexes>): MatchResult {
  const assetId = normalizeText(providerAssetId);
  if (!assetId) {
    return { matchStatus: "Unmatched", matchedBy: "None", fixedAssetNo: "", message: "Provider asset ID is blank." };
  }

  const exactAttempts: Array<{ label: MatchedBy; result: ReturnType<typeof uniqueMatch> }> = [
    { label: "AssetNo", result: uniqueMatch(indexes.byNo, assetId) },
    { label: "ServiceItemNo", result: uniqueMatch(indexes.byServiceItemNo, assetId) },
    { label: "MTRZ", result: uniqueMatch(indexes.byMtrz, assetId) },
  ];

  for (const attempt of exactAttempts) {
    if (attempt.result.status === "unique") {
      return { matchStatus: "Matched", matchedBy: attempt.label, fixedAssetNo: attempt.result.value, message: "" };
    }
    if (attempt.result.status === "multiple") {
      return { matchStatus: "Ambiguous", matchedBy: "None", fixedAssetNo: "", message: `Provider asset ID ${assetId} matched multiple fixed assets.` };
    }
  }

  const digits = assetId.replace(/\D/g, "");
  if (!digits) {
    return { matchStatus: "Unmatched", matchedBy: "None", fixedAssetNo: "", message: `No BC fixed asset match for provider asset ID ${assetId}.` };
  }

  const digitAttempts: Array<{ label: MatchedBy; result: ReturnType<typeof uniqueMatch> }> = [
    { label: "AssetNoDigits", result: uniqueMatch(indexes.byNoDigits, digits) },
    { label: "ServiceItemNoDigits", result: uniqueMatch(indexes.byServiceItemDigits, digits) },
    { label: "MTRZDigits", result: uniqueMatch(indexes.byMtrzDigits, digits) },
  ];

  for (const attempt of digitAttempts) {
    if (attempt.result.status === "unique") {
      return { matchStatus: "Matched", matchedBy: attempt.label, fixedAssetNo: attempt.result.value, message: "" };
    }
    if (attempt.result.status === "multiple") {
      return { matchStatus: "Ambiguous", matchedBy: "None", fixedAssetNo: "", message: `Digits derived from provider asset ID ${assetId} matched multiple fixed assets.` };
    }
  }

  return { matchStatus: "Unmatched", matchedBy: "None", fixedAssetNo: "", message: `No BC fixed asset match for provider asset ID ${assetId}.` };
}

function addIndexValue(index: Map<string, Set<string>>, key: string, value: string) {
  const normalized = normalizeText(key).toUpperCase();
  if (!normalized || !value) {
    return;
  }
  const existing = index.get(normalized) ?? new Set<string>();
  existing.add(value);
  index.set(normalized, existing);
}

function uniqueMatch(index: Map<string, Set<string>>, key: string) {
  const matches = index.get(normalizeText(key).toUpperCase());
  if (!matches || matches.size === 0) {
    return { status: "none" as const, value: "" };
  }
  if (matches.size === 1) {
    return { status: "unique" as const, value: [...matches][0] };
  }
  return { status: "multiple" as const, value: "" };
}

export async function fetchExistingTelematicsTrackers(accessToken: string, companyId: string) {
  const existing = new Map<string, ExistingTelematicsTracker>();
  const pageSize = 5000;
  let skip = 0;

  while (true) {
    const url = `${getTelematicsApiRoot(companyId)}/telematicsTrackers?$top=${pageSize}&$skip=${skip}&$orderby=providerTrackerId`;
    const { response, bodyText } = await bcRequest(url, accessToken);
    if (!response.ok) {
      if (response.status === 404) {
        return { existing, apiAvailable: false };
      }
      throw new Error(`Unable to fetch telematics trackers (${response.status}): ${bodyText}`);
    }

    const parsed = JSON.parse(bodyText) as { value?: ExistingTelematicsTracker[] };
    const page = parsed.value ?? [];
    for (const row of page) {
      existing.set(telematicsKey(row.provider, row.providerTrackerId), row);
    }
    if (page.length < pageSize) {
      break;
    }
    skip += pageSize;
  }

  return { existing, apiAvailable: true };
}

export async function fetchTelematicsByFixedAsset(accessToken: string, companyId: string, fixedAssetNo: string, provider?: TelematicsProvider) {
  const filters = [`fixedAssetNo eq '${escapeODataString(fixedAssetNo)}'`];
  if (provider) {
    filters.push(`provider eq '${provider}'`);
  }
  const url = `${getTelematicsApiRoot(companyId)}/telematicsTrackers?$filter=${encodeURIComponent(filters.join(" and "))}&$top=100`;
  const { response, bodyText } = await bcRequest(url, accessToken);
  if (!response.ok) {
    if (response.status === 404) {
      return [];
    }
    throw new Error(`Unable to fetch telematics rows for fixed asset ${fixedAssetNo} (${response.status}): ${bodyText}`);
  }
  const parsed = JSON.parse(bodyText) as { value?: ExistingTelematicsTracker[] };
  return parsed.value ?? [];
}

export function telematicsKey(provider: TelematicsProvider, providerTrackerId: string) {
  return `${provider}|${providerTrackerId}`;
}

export async function upsertTelematicsTracker(
  accessToken: string,
  companyId: string,
  existingMap: Map<string, ExistingTelematicsTracker>,
  payload: TelematicsTrackerPayload,
  write: boolean,
) {
  const key = telematicsKey(payload.provider, payload.providerTrackerId);
  const existing = existingMap.get(key);
  if (existing) {
    if (!telematicsPayloadNeedsUpdate(existing, payload)) {
      return "skipped" as const;
    }
    if (write) {
      const { response, bodyText } = await bcRequest(`${getTelematicsApiRoot(companyId)}/telematicsTrackers(${existing.id})`, accessToken, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "If-Match": "*",
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error(`Unable to update telematics tracker ${key} (${response.status}): ${bodyText}`);
      }
    }
    existingMap.set(key, { ...existing, ...payload });
    return "updated" as const;
  }

  if (write) {
    const { response, bodyText } = await bcRequest(`${getTelematicsApiRoot(companyId)}/telematicsTrackers`, accessToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error(`Unable to insert telematics tracker ${key} (${response.status}): ${bodyText}`);
    }
    const created = JSON.parse(bodyText) as ExistingTelematicsTracker;
    existingMap.set(key, created);
  }

  return "inserted" as const;
}

export function telematicsPayloadNeedsUpdate(existing: ExistingTelematicsTracker, payload: TelematicsTrackerPayload) {
  return existing.sourceHash !== payload.sourceHash ||
    existing.fixedAssetNo !== payload.fixedAssetNo ||
    existing.matchStatus !== payload.matchStatus ||
    existing.matchedBy !== payload.matchedBy ||
    existing.syncStatus !== payload.syncStatus ||
    existing.lastError !== payload.lastError;
}

export async function createTelematicsSyncRun(accessToken: string, companyId: string, payload: TelematicsSyncRunPayload, write: boolean) {
  if (!write) {
    return { id: "dry-run-sync-run" };
  }

  const { response, bodyText } = await bcRequest(`${getTelematicsApiRoot(companyId)}/telematicsSyncRuns`, accessToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`Unable to create telematics sync run (${response.status}): ${bodyText}`);
  }
  return JSON.parse(bodyText) as { id: string };
}

export async function updateTelematicsSyncRun(accessToken: string, companyId: string, id: string, payload: TelematicsSyncRunPayload, write: boolean) {
  if (!write) {
    return;
  }

  const { response, bodyText } = await bcRequest(`${getTelematicsApiRoot(companyId)}/telematicsSyncRuns(${id})`, accessToken, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "If-Match": "*",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`Unable to update telematics sync run (${response.status}): ${bodyText}`);
  }
}

export async function createTelematicsSyncError(accessToken: string, companyId: string, payload: TelematicsSyncErrorPayload, write: boolean) {
  if (!write) {
    return;
  }

  const { response, bodyText } = await bcRequest(`${getTelematicsApiRoot(companyId)}/telematicsSyncErrors`, accessToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`Unable to create telematics sync error (${response.status}): ${bodyText}`);
  }
}

export async function fetchLatestSuccessfulTelematicsRun(accessToken: string, companyId: string, provider: TelematicsProvider) {
  const filter = encodeURIComponent(`provider eq '${provider}' and status eq 'Succeeded'`);
  const url = `${getTelematicsApiRoot(companyId)}/telematicsSyncRuns?$filter=${filter}&$orderby=sourceWindowEnd desc&$top=1`;
  const { response, bodyText } = await bcRequest(url, accessToken);
  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }
    throw new Error(`Unable to fetch latest telematics sync run (${response.status}): ${bodyText}`);
  }
  const parsed = JSON.parse(bodyText) as { value?: Array<{ sourceWindowEnd?: string }> };
  return parsed.value?.[0] ?? null;
}

export async function runWithConcurrency<T>(items: T[], concurrency: number, worker: (item: T) => Promise<void>) {
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

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}


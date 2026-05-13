import { mkdir, writeFile } from "node:fs/promises";
import * as path from "node:path";

import { config as loadEnv } from "dotenv";

loadEnv();

type ScriptOptions = {
  assetId: string;
  version: string;
  maxResults: number;
  outputPath: string;
  rawOutputPath: string;
  csvOutputPath: string | null;
};

type TokenResponse = {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

type OidcConfiguration = {
  token_endpoint?: string;
  token_endpoint_auth_methods_supported?: string[];
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

const DEFAULT_SERVICE_URL = "https://xml-gen2.skybitz.com/";
const DEFAULT_TOKEN_URL = "https://prodssoidp.skybitz.com/oauth2/token";
const PROD_DISCOVERY_URL = "https://prodssoidp.skybitz.com/oauth2/oidcdiscovery/.well-known/openid-configuration";
const DEFAULT_API_VERSION = "2.76";
const DEFAULT_MAX_RESULTS = 100;

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

function buildDefaultOutputPath(label: string) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return path.join(process.cwd(), "artifacts", "skybitz", `${label}-${timestamp}.json`);
}

function parseArgs(argv: string[]): ScriptOptions {
  let assetId = "ALL";
  let version = DEFAULT_API_VERSION;
  let maxResults = DEFAULT_MAX_RESULTS;
  let outputPath: string | null = null;
  let rawOutputPath: string | null = null;
  let csvOutputPath: string | null = null;

  for (const arg of argv) {
    if (arg.startsWith("--assetid=")) {
      assetId = arg.slice("--assetid=".length).trim() || "ALL";
      continue;
    }

    if (arg.startsWith("--version=")) {
      version = arg.slice("--version=".length).trim() || DEFAULT_API_VERSION;
      continue;
    }

    if (arg.startsWith("--max-results=")) {
      maxResults = parsePositiveInteger(arg.slice("--max-results=".length), "--max-results");
      continue;
    }

    if (arg.startsWith("--output=")) {
      outputPath = path.resolve(arg.slice("--output=".length).trim());
      continue;
    }

    if (arg.startsWith("--raw-output=")) {
      rawOutputPath = path.resolve(arg.slice("--raw-output=".length).trim());
      continue;
    }

    if (arg.startsWith("--csv-output=")) {
      csvOutputPath = path.resolve(arg.slice("--csv-output=".length).trim());
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return {
    assetId,
    version,
    maxResults,
    outputPath: outputPath ?? buildDefaultOutputPath("skybitz-latest-locations"),
    rawOutputPath: rawOutputPath ?? buildDefaultOutputPath("skybitz-latest-locations-raw"),
    csvOutputPath,
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
    ? TGroups | undefined
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

function getServiceUrl() {
  return process.env.SKYBITZ_SERVICE_URL?.trim() || DEFAULT_SERVICE_URL;
}

function getTokenUrl() {
  return process.env.SKYBITZ_TOKEN_URL?.trim() || DEFAULT_TOKEN_URL;
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

async function discoverTokenCandidates() {
  const candidates = new Set<string>([getTokenUrl()]);

  try {
    const response = await fetch(PROD_DISCOVERY_URL, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
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

async function requestTokenWithBasicAuth(url: string, clientId: string, clientSecret: string) {
  const basic = Buffer.from(`${clientId}:${clientSecret}`, "utf8").toString("base64");

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: "grant_type=client_credentials",
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

async function requestTokenWithPostBody(url: string, clientId: string, clientSecret: string) {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
      }),
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

async function getAccessToken() {
  const clientId = requireEnv("SKYBITZ_CLIENT_ID");
  const clientSecret = requireEnv("SKYBITZ_CLIENT_SECRET");
  const tokenCandidates = await discoverTokenCandidates();
  const failures: string[] = [];

  for (const tokenUrl of tokenCandidates) {
    for (const method of ["client_secret_basic", "client_secret_post"] as const) {
      const result = method === "client_secret_basic"
        ? await requestTokenWithBasicAuth(tokenUrl, clientId, clientSecret)
        : await requestTokenWithPostBody(tokenUrl, clientId, clientSecret);

      if (!result.response) {
        failures.push(`${method} ${tokenUrl} -> network error: ${result.networkError}`);
        continue;
      }

      let payload: TokenResponse | null = null;
      try {
        payload = JSON.parse(result.bodyText) as TokenResponse;
      } catch {
        payload = null;
      }

      if (result.response.ok && payload?.access_token) {
        return {
          accessToken: payload.access_token,
          tokenType: payload.token_type ?? "",
          expiresIn: payload.expires_in ?? null,
          tokenUrl,
          authMethod: method,
        };
      }

      const detail = payload?.error_description ?? payload?.error ?? result.bodyText;
      failures.push(`${method} ${tokenUrl} -> ${result.response.status}: ${detail}`);
    }
  }

  throw new Error(`SkyBitz token request failed.\n${failures.join("\n")}`);
}

async function fetchLatestLocations(options: Pick<ScriptOptions, "assetId" | "version">, accessToken: string) {
  const baseUrl = new URL("QueryPositions", getServiceUrl());
  baseUrl.searchParams.set("assetid", options.assetId);
  baseUrl.searchParams.set("accessToken", accessToken);
  baseUrl.searchParams.set("version", options.version);
  baseUrl.searchParams.set("sortby", "1");
  baseUrl.searchParams.set("getJson", "1");

  const response = await fetch(baseUrl, {
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  const bodyText = await response.text();
  if (!response.ok) {
    throw new Error(`SkyBitz QueryPositions failed (${response.status}): ${bodyText}`);
  }

  return {
    requestUrl: baseUrl.toString(),
    payload: JSON.parse(bodyText) as SkyBitzResponse,
    rawBody: bodyText,
  };
}

async function writeJson(outputPath: string, payload: Record<string, unknown>) {
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function fieldHasValue(value: unknown) {
  if (Array.isArray(value)) {
    return value.length > 0;
  }

  return value !== null && value !== undefined && value !== "";
}

function chooseCsvColumns(sampleRows: NormalizedLocation[]) {
  const columns = new Set<string>();

  for (const row of sampleRows) {
    for (const [key, value] of Object.entries(row)) {
      if (fieldHasValue(value)) {
        columns.add(key);
      }
    }
  }

  return [...columns];
}

function serializeCsvCell(value: unknown) {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return "";
    }

    if (typeof value[0] === "string") {
      return value.join("|");
    }

    return JSON.stringify(value);
  }

  if (value === null || value === undefined) {
    return "";
  }

  return String(value);
}

function escapeCsvCell(value: string) {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, "\"\"")}"`;
  }

  return value;
}

async function writeCsv(outputPath: string, rows: NormalizedLocation[], columns: string[]) {
  const lines = [columns.join(",")];

  for (const row of rows) {
    const values = columns.map((column) =>
      escapeCsvCell(serializeCsvCell(row[column as keyof NormalizedLocation])),
    );
    lines.push(values.join(","));
  }

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${lines.join("\n")}\n`, "utf8");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  console.log(`Requesting SkyBitz latest positions for asset scope "${options.assetId}"`);

  const token = await getAccessToken();
  const latestLocations = await fetchLatestLocations(options, token.accessToken);
  const skybitzError = normalizeText(latestLocations.payload.skybitz?.error);
  const glsRecords = toArray(latestLocations.payload.skybitz?.gls);
  const normalizedLocations = glsRecords.map(normalizeLocation);
  const limitedLocations = normalizedLocations.slice(0, options.maxResults);

  const summaryPayload = {
    fetchedAt: new Date().toISOString(),
    serviceUrl: getServiceUrl(),
    tokenUrl: getTokenUrl(),
    apiVersion: options.version,
    assetIdScope: options.assetId,
    tokenType: token.tokenType,
    tokenExpiresInSeconds: token.expiresIn,
    tokenAuthMethod: token.authMethod,
    resolvedTokenUrl: token.tokenUrl,
    responseErrorCode: skybitzError,
    responseErrorText: normalizeText(latestLocations.payload.skybitz?.errorText),
    totalRecordsReturned: normalizedLocations.length,
    returnedBatchSize: limitedLocations.length,
    requestUrl: latestLocations.requestUrl,
    locations: limitedLocations,
  };

  const rawPayload = {
    fetchedAt: summaryPayload.fetchedAt,
    requestUrl: latestLocations.requestUrl,
    raw: latestLocations.payload,
  };

  await writeJson(options.outputPath, summaryPayload);
  await writeJson(options.rawOutputPath, rawPayload);

  if (options.csvOutputPath) {
    const sampleColumns = chooseCsvColumns(normalizedLocations.slice(0, options.maxResults));
    await writeCsv(options.csvOutputPath, normalizedLocations, sampleColumns);
  }

  console.log(`Saved normalized output to ${options.outputPath}`);
  console.log(`Saved raw output to ${options.rawOutputPath}`);
  if (options.csvOutputPath) {
    console.log(`Saved CSV output to ${options.csvOutputPath}`);
  }
  console.log(
    JSON.stringify(
      {
        responseErrorCode: skybitzError,
        totalRecordsReturned: normalizedLocations.length,
        returnedBatchSize: limitedLocations.length,
        sample: limitedLocations[0] ?? null,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exit(1);
});

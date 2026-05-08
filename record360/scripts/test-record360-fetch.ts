import { mkdir, writeFile } from "node:fs/promises";
import * as path from "node:path";

import { config as loadEnv } from "dotenv";

loadEnv();

type ResourceName = "units" | "tasks" | "inspections";

type ResourceListResponse<TItem> = {
  data: TItem[];
  paging?: {
    per_page?: number;
    next?: string | null;
  };
};

type ResourceFetchResult = {
  resource: ResourceName;
  count: number;
  pages: number;
  items: Array<Record<string, unknown>>;
};

type ScriptOptions = {
  perPage: number;
  maxPages: number | null;
  outputPath: string;
  resources: ResourceName[];
  createdAfter: string | null;
  createdBefore: string | null;
};

const DEFAULT_API_BASE_URL = "https://api.record360.com/v3/";
const DEFAULT_PER_PAGE = 100;
const DEFAULT_RESOURCES: ResourceName[] = ["units", "tasks", "inspections"];

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

function parseArgs(argv: string[]): ScriptOptions {
  let perPage = DEFAULT_PER_PAGE;
  let maxPages: number | null = null;
  let outputPath: string | null = null;
  let resources = [...DEFAULT_RESOURCES];
  let createdAfter: string | null = null;
  let createdBefore: string | null = null;

  for (const arg of argv) {
    if (arg.startsWith("--per-page=")) {
      perPage = Math.min(parsePositiveInteger(arg.slice("--per-page=".length), "--per-page"), 100);
      continue;
    }

    if (arg.startsWith("--max-pages=")) {
      maxPages = parsePositiveInteger(arg.slice("--max-pages=".length), "--max-pages");
      continue;
    }

    if (arg.startsWith("--output=")) {
      outputPath = arg.slice("--output=".length).trim();
      continue;
    }

    if (arg.startsWith("--resources=")) {
      const requested = arg
        .slice("--resources=".length)
        .split(",")
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean);

      if (requested.length === 0) {
        throw new Error("--resources must include at least one resource.");
      }

      const invalid = requested.filter(
        (value): value is string => !DEFAULT_RESOURCES.includes(value as ResourceName),
      );
      if (invalid.length > 0) {
        throw new Error(`Unsupported resources: ${invalid.join(", ")}`);
      }

      resources = requested as ResourceName[];
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

    throw new Error(`Unknown argument: ${arg}`);
  }

  return {
    perPage,
    maxPages,
    outputPath: outputPath ? path.resolve(outputPath) : buildDefaultOutputPath(),
    resources,
    createdAfter,
    createdBefore,
  };
}

function buildDefaultOutputPath() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return path.join(process.cwd(), "artifacts", "record360", `record360-fetch-${timestamp}.json`);
}

function getApiBaseUrl() {
  const configured = process.env.RECORD360_API_BASE_URL?.trim();
  if (!configured) {
    return new URL(DEFAULT_API_BASE_URL);
  }

  const normalized = new URL(configured);
  if (normalized.pathname === "/" || normalized.pathname === "") {
    normalized.pathname = "/v3/";
  } else if (normalized.pathname === "/v3") {
    normalized.pathname = "/v3/";
  }

  return normalized;
}

function getAuthHeaders() {
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

async function fetchJson<TData>(url: URL | string, headers: Record<string, string>) {
  const response = await fetch(url, {
    headers,
    cache: "no-store",
  });

  const bodyText = await response.text();
  if (!response.ok) {
    throw new Error(
      `Record360 request failed for ${typeof url === "string" ? url : url.toString()} (${response.status}): ${bodyText}`,
    );
  }

  return JSON.parse(bodyText) as TData;
}

async function fetchResource(
  resource: ResourceName,
  options: Pick<ScriptOptions, "perPage" | "maxPages" | "createdAfter" | "createdBefore">,
  headers: Record<string, string>,
  apiBaseUrl: URL,
): Promise<ResourceFetchResult> {
  const items: Array<Record<string, unknown>> = [];
  let pages = 0;
  let nextUrl: string | null = new URL(resource, apiBaseUrl).toString();

  while (nextUrl) {
    const url = new URL(nextUrl);
    if (!url.searchParams.has("per_page")) {
      url.searchParams.set("per_page", String(options.perPage));
    }

    if (resource === "inspections") {
      if (options.createdAfter && !url.searchParams.has("created_after")) {
        url.searchParams.set("created_after", options.createdAfter);
      }

      if (options.createdBefore && !url.searchParams.has("created_before")) {
        url.searchParams.set("created_before", options.createdBefore);
      }
    }

    const payload = await fetchJson<ResourceListResponse<Record<string, unknown>>>(url, headers);
    items.push(...payload.data);
    pages += 1;

    if (options.maxPages !== null && pages >= options.maxPages) {
      break;
    }

    nextUrl = payload.paging?.next ?? null;
  }

  return {
    resource,
    count: items.length,
    pages,
    items,
  };
}

function summarizeItem(resource: ResourceName, item: Record<string, unknown>) {
  if (resource === "units") {
    return {
      id: item.id ?? null,
      reference_number: item.reference_number ?? null,
      serial_number: item.serial_number ?? null,
      vin: item.vin ?? null,
      updated_at: item.updated_at ?? null,
    };
  }

  if (resource === "tasks") {
    const unit = item.unit as Record<string, unknown> | undefined;
    return {
      id: item.id ?? null,
      type: item.type ?? null,
      status: item.status ?? null,
      name: item.name ?? null,
      unit_reference_number: unit?.reference_number ?? null,
      due_by: item.due_by ?? null,
    };
  }

  const unit = item.unit as Record<string, unknown> | undefined;
  return {
    id: item.id ?? null,
    type: item.type ?? null,
    unit_reference_number: unit?.reference_number ?? null,
    workflow: item.workflow ?? null,
    created_at: item.created_at ?? null,
    updated_at: item.updated_at ?? null,
  };
}

async function writeOutputFile(outputPath: string, payload: Record<string, unknown>) {
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const headers = getAuthHeaders();
  const apiBaseUrl = getApiBaseUrl();

  console.log(`Fetching Record360 resources from ${apiBaseUrl.toString()}`);

  const results = await Promise.all(
    options.resources.map((resource) => fetchResource(resource, options, headers, apiBaseUrl)),
  );

  const outputPayload = {
    fetchedAt: new Date().toISOString(),
    apiBaseUrl: apiBaseUrl.toString(),
    perPage: options.perPage,
    maxPages: options.maxPages,
    createdAfter: options.createdAfter,
    createdBefore: options.createdBefore,
    resources: Object.fromEntries(
      results.map((result) => [
        result.resource,
        {
          count: result.count,
          pages: result.pages,
          data: result.items,
        },
      ]),
    ),
  };

  for (const result of results) {
    console.log(`${result.resource}: ${result.count} record(s) across ${result.pages} page(s)`);
    if (result.items[0]) {
      console.log(`  sample: ${JSON.stringify(summarizeItem(result.resource, result.items[0]))}`);
    }
  }

  await writeOutputFile(options.outputPath, outputPayload);
  console.log(`Saved raw output to ${options.outputPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

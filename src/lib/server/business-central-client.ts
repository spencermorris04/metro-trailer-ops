const DEFAULT_BC_API_VERSION = "v2.0";

export interface BusinessCentralConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  environment: string;
  company: string;
  companyId?: string | null;
  apiVersion: string;
}

export interface BusinessCentralCollectionPage<T> {
  value: T[];
  nextLink: string | null;
  count?: number;
}

export interface BusinessCentralRequestOptions extends RequestInit {
  path?: string;
  url?: string;
  retryOnUnauthorized?: boolean;
}

export interface BusinessCentralCollectionOptions {
  path?: string;
  url?: string;
  top?: number;
  skip?: number;
  filter?: string;
  select?: string[];
  expand?: string[];
  count?: boolean;
}

type AccessTokenCache = {
  accessToken: string;
  expiresAt: number;
};

let accessTokenCache: AccessTokenCache | null = null;

function requireEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required for Business Central access.`);
  }

  return value;
}

export function getBusinessCentralConfig(): BusinessCentralConfig {
  return {
    tenantId: requireEnv("METRO_GRAPH_TENANT_ID"),
    clientId: requireEnv("METRO_GRAPH_CLIENT_ID"),
    clientSecret: requireEnv("METRO_GRAPH_CLIENT_SECRET"),
    environment: requireEnv("METRO_BC_ENVIRONMENT"),
    company: requireEnv("METRO_BC_COMPANY"),
    companyId: process.env.METRO_BC_COMPANY_ID?.trim() || null,
    apiVersion:
      process.env.METRO_BC_API_VERSION?.trim() || DEFAULT_BC_API_VERSION,
  };
}

function encodeCompany(company: string) {
  return company.replace(/'/g, "''");
}

function buildBusinessCentralBaseUrl(config: BusinessCentralConfig) {
  return `https://api.businesscentral.dynamics.com/v2.0/${config.tenantId}/${config.environment}`;
}

function buildODataUrl(config: BusinessCentralConfig, path: string) {
  const normalizedPath = path.replace(/^\/+/, "");

  if (/^https?:\/\//i.test(normalizedPath)) {
    return normalizedPath;
  }

  return `${buildBusinessCentralBaseUrl(config)}/ODataV4/Company('${encodeCompany(config.company)}')/${normalizedPath}`;
}

function appendCollectionParams(
  url: URL,
  options: Pick<
    BusinessCentralCollectionOptions,
    "top" | "skip" | "filter" | "select" | "expand" | "count"
  >,
) {
  if (typeof options.top === "number") {
    url.searchParams.set("$top", String(options.top));
  }
  if (typeof options.skip === "number") {
    url.searchParams.set("$skip", String(options.skip));
  }
  if (options.filter) {
    url.searchParams.set("$filter", options.filter);
  }
  if (options.select && options.select.length > 0) {
    url.searchParams.set("$select", options.select.join(","));
  }
  if (options.expand && options.expand.length > 0) {
    url.searchParams.set("$expand", options.expand.join(","));
  }
  if (options.count) {
    url.searchParams.set("$count", "true");
  }
}

async function requestAccessToken(config: BusinessCentralConfig) {
  const tokenUrl = `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: "client_credentials",
    scope: "https://api.businesscentral.dynamics.com/.default",
  });

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body,
  });

  const payload = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
    error_description?: string;
  };

  if (!response.ok || !payload.access_token) {
    throw new Error(
      payload.error_description ||
        `Business Central token request failed with status ${response.status}.`,
    );
  }

  accessTokenCache = {
    accessToken: payload.access_token,
    expiresAt: Date.now() + ((payload.expires_in ?? 3600) - 60) * 1000,
  };

  return accessTokenCache.accessToken;
}

async function getAccessToken(forceRefresh = false) {
  const config = getBusinessCentralConfig();

  if (
    !forceRefresh &&
    accessTokenCache &&
    accessTokenCache.expiresAt > Date.now()
  ) {
    return accessTokenCache.accessToken;
  }

  return requestAccessToken(config);
}

async function parseResponse(response: Response) {
  const text = await response.text();
  if (!text) {
    return null;
  }

  return JSON.parse(text) as Record<string, unknown>;
}

export async function businessCentralRequest<T = Record<string, unknown>>(
  options: BusinessCentralRequestOptions,
): Promise<T> {
  const config = getBusinessCentralConfig();
  const url = options.url ?? buildODataUrl(config, options.path ?? "");
  const accessToken = await getAccessToken();

  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers ?? {}),
    },
  });

  if (response.status === 401 && options.retryOnUnauthorized !== false) {
    const refreshedToken = await getAccessToken(true);
    const retryResponse = await fetch(url, {
      ...options,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${refreshedToken}`,
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.headers ?? {}),
      },
    });

    const retryPayload = await parseResponse(retryResponse);

    if (!retryResponse.ok) {
      throw new Error(
        `Business Central request failed with status ${retryResponse.status}: ${JSON.stringify(retryPayload)}`,
      );
    }

    return retryPayload as T;
  }

  const payload = await parseResponse(response);

  if (!response.ok) {
    throw new Error(
      `Business Central request failed with status ${response.status}: ${JSON.stringify(payload)}`,
    );
  }

  return payload as T;
}

export async function getBusinessCentralCollectionPage<T>(
  options: BusinessCentralCollectionOptions,
): Promise<BusinessCentralCollectionPage<T>> {
  const config = getBusinessCentralConfig();
  const rawUrl = options.url ?? buildODataUrl(config, options.path ?? "");
  const url = new URL(rawUrl);

  if (!options.url) {
    appendCollectionParams(url, options);
  }

  const payload = await businessCentralRequest<{
    value?: T[];
    "@odata.nextLink"?: string;
    "@odata.count"?: number;
  }>({
    url: url.toString(),
  });

  return {
    value: Array.isArray(payload.value) ? payload.value : [],
    nextLink:
      typeof payload["@odata.nextLink"] === "string"
        ? payload["@odata.nextLink"]
        : null,
    count:
      typeof payload["@odata.count"] === "number"
        ? payload["@odata.count"]
        : undefined,
  };
}

export async function* iterateBusinessCentralCollection<T>(
  options: BusinessCentralCollectionOptions,
): AsyncGenerator<BusinessCentralCollectionPage<T>, void, unknown> {
  let nextUrl: string | null = options.url ?? null;
  let firstPass = true;

  while (firstPass || nextUrl) {
    const page = await getBusinessCentralCollectionPage<T>({
      ...options,
      url: nextUrl ?? undefined,
    });

    yield page;
    nextUrl = page.nextLink;
    firstPass = false;
  }
}

export async function collectBusinessCentralCollection<T>(
  options: BusinessCentralCollectionOptions,
) {
  const values: T[] = [];
  let totalCount: number | undefined;

  for await (const page of iterateBusinessCentralCollection<T>(options)) {
    values.push(...page.value);
    if (typeof page.count === "number") {
      totalCount = page.count;
    }
  }

  return {
    value: values,
    count: totalCount ?? values.length,
  };
}

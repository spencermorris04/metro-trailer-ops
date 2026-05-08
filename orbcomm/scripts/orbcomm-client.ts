import { GetSecretValueCommand, PutSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { config as loadEnv } from "dotenv";

import { normalizeText, optionalEnv, requireEnv, sleep } from "../../telematics/scripts/shared";

loadEnv();

export type OrbcommTokenState = {
  ORBCOMM_USER_ID?: string;
  ORBCOMM_USERNAME?: string;
  ORBCOMM_PASSWORD?: string;
  ORBCOMM_BASE_URL?: string;
  ORBCOMM_ACCESS_TOKEN?: string;
  ORBCOMM_REFRESH_TOKEN?: string;
  ORBCOMM_ACCESS_TOKEN_EXPIRES_AT?: string;
  ORBCOMM_REFRESH_TOKEN_EXPIRES_AT?: string;
};

export type OrbcommAssetStatusRecord = {
  messageId?: string;
  assetStatus?: {
    assetName?: string;
    assetType?: string;
    messageStamp?: string;
    messageReceivedStamp?: string;
    deviceSN?: string;
    productType?: string;
    batteryVoltage?: number | string;
    batteryStatus?: string;
    powerSource?: string;
    speed?: number | string;
    messageType?: string;
  };
  positionStatus?: {
    city?: string;
    state?: string;
    street?: string;
    zipCode?: string;
    country?: string;
    geofenceName?: string;
    geofenceType?: string;
    latitude?: number | string;
    longitude?: number | string;
    direction?: string;
    geofenceStatus?: string;
    nearestGeofence?: string;
    address?: string;
  };
};

export type OrbcommAssetStatusResponse = {
  watermark?: number | string | null;
  data?: OrbcommAssetStatusRecord[];
  message?: string | null;
  exception?: boolean;
  code?: number;
};

const secretsClient = new SecretsManagerClient({});

export function getOrbcommBaseUrl() {
  return trimTrailingSlash(optionalEnv("ORBCOMM_BASE_URL", "https://platform.orbcomm.com/SynB2BGatewayService/api/"));
}

export async function getOrbcommAccessToken() {
  const state = await loadTokenState();
  const accessToken = normalizeText(state.ORBCOMM_ACCESS_TOKEN);
  const accessExpiresAt = normalizeText(state.ORBCOMM_ACCESS_TOKEN_EXPIRES_AT);
  if (accessToken && accessExpiresAt && new Date(accessExpiresAt).getTime() > Date.now() + 5 * 60 * 1000) {
    return accessToken;
  }

  const refreshToken = normalizeText(state.ORBCOMM_REFRESH_TOKEN);
  const refreshExpiresAt = normalizeText(state.ORBCOMM_REFRESH_TOKEN_EXPIRES_AT);
  if (refreshToken && (!refreshExpiresAt || new Date(refreshExpiresAt).getTime() > Date.now() + 5 * 60 * 1000)) {
    try {
      return await refreshOrbcommToken(refreshToken, state);
    } catch (error) {
      console.warn(`[orbcomm] refreshToken failed, falling back to generateToken: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return generateOrbcommToken(state);
}

export async function orbcommRequest(path: string, init?: RequestInit) {
  let token = await getOrbcommAccessToken();
  let rateLimitRetries = 0;
  let concurrentRequestRetries = 0;
  const maxRateLimitRetries = Number(optionalEnv("ORBCOMM_RATE_LIMIT_MAX_RETRIES", "1"));
  const rateLimitRetrySeconds = Number(optionalEnv("ORBCOMM_RATE_LIMIT_RETRY_SECONDS", "305"));
  const maxConcurrentRequestRetries = Number(optionalEnv("ORBCOMM_CONCURRENT_REQUEST_MAX_RETRIES", "5"));
  const concurrentRequestRetrySeconds = Number(optionalEnv("ORBCOMM_CONCURRENT_REQUEST_RETRY_SECONDS", "60"));
  const requestTimeoutSeconds = Number(optionalEnv("ORBCOMM_REQUEST_TIMEOUT_SECONDS", "300"));
  const maxAttempts = Math.max(4, maxRateLimitRetries + maxConcurrentRequestRetries + 4);
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    let response: Response;
    let bodyText: string;
    try {
      response = await fetch(`${getOrbcommBaseUrl()}/${path.replace(/^\/+/, "")}`, {
        ...init,
        signal: init?.signal ?? AbortSignal.timeout(requestTimeoutSeconds * 1000),
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          ...(init?.headers ?? {}),
        },
      });
      bodyText = await response.text();
    } catch (error) {
      if (attempt < maxAttempts - 1) {
        const message = error instanceof Error ? error.message : String(error);
        const retrySeconds = message.toLowerCase().includes("timeout") || message.toLowerCase().includes("aborted")
          ? concurrentRequestRetrySeconds
          : 5;
        console.warn(`[orbcomm] request failed before response; retrying after ${retrySeconds}s: ${message}`);
        await sleep(retrySeconds * 1000);
        continue;
      }
      throw error;
    }
    if ((response.status === 401 || response.status === 403) && attempt === 0) {
      token = await generateOrbcommToken(await loadTokenState());
      continue;
    }
    if (response.status === 429 && bodyText.includes('"code":1008') && rateLimitRetries < maxRateLimitRetries) {
      rateLimitRetries += 1;
      console.warn(`[orbcomm] API polling throttle hit; waiting ${rateLimitRetrySeconds}s before retry ${rateLimitRetries}/${maxRateLimitRetries}.`);
      await sleep(rateLimitRetrySeconds * 1000);
      continue;
    }
    if (response.status === 423 && bodyText.includes('"code":1007') && concurrentRequestRetries < maxConcurrentRequestRetries) {
      concurrentRequestRetries += 1;
      console.warn(
        `[orbcomm] concurrent request lock detected; waiting ${concurrentRequestRetrySeconds}s before retry ${concurrentRequestRetries}/${maxConcurrentRequestRetries}.`,
      );
      await sleep(concurrentRequestRetrySeconds * 1000);
      continue;
    }
    if ((response.status === 429 || response.status >= 500) && attempt < 3) {
      await sleep(1000 * Math.pow(2, attempt));
      continue;
    }
    return { response, bodyText };
  }
  throw new Error(`ORBCOMM request retry loop exhausted for ${path}`);
}

export async function fetchOrbcommAssetStatus(body: Record<string, unknown>) {
  const { response, bodyText } = await orbcommRequest("getAssetStatus", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`ORBCOMM getAssetStatus failed (${response.status}): ${bodyText}`);
  }
  const parsed = JSON.parse(bodyText) as OrbcommAssetStatusResponse;
  if (parsed.exception) {
    throw new Error(`ORBCOMM getAssetStatus returned exception code ${parsed.code}: ${parsed.message ?? ""}`);
  }
  return parsed;
}

async function refreshOrbcommToken(refreshToken: string, state: OrbcommTokenState) {
  const response = await fetch(`${getOrbcommBaseUrl()}/refreshToken`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  const bodyText = await response.text();
  if (!response.ok) {
    throw new Error(`ORBCOMM refreshToken failed (${response.status}): ${bodyText}`);
  }
  return persistTokenResponse(JSON.parse(bodyText), state);
}

async function generateOrbcommToken(state: OrbcommTokenState) {
  const userName = normalizeText(state.ORBCOMM_USER_ID) || normalizeText(state.ORBCOMM_USERNAME) || optionalEnv("ORBCOMM_USER_ID") || optionalEnv("ORBCOMM_USERNAME");
  const password = normalizeText(state.ORBCOMM_PASSWORD) || optionalEnv("ORBCOMM_PASSWORD");
  if (!userName || !password) {
    requireEnv("ORBCOMM_USER_ID");
    requireEnv("ORBCOMM_PASSWORD");
  }

  const response = await fetch(`${getOrbcommBaseUrl()}/generateToken`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ userName, password }),
  });
  const bodyText = await response.text();
  if (!response.ok) {
    throw new Error(`ORBCOMM generateToken failed (${response.status}): ${bodyText}`);
  }
  return persistTokenResponse(JSON.parse(bodyText), { ...state, ORBCOMM_USER_ID: userName, ORBCOMM_PASSWORD: password });
}

async function persistTokenResponse(parsed: any, state: OrbcommTokenState) {
  const data = parsed?.data;
  if (!data?.accessToken) {
    throw new Error(`ORBCOMM token response did not include data.accessToken: ${JSON.stringify(parsed)}`);
  }

  const nextState: OrbcommTokenState = {
    ...state,
    ORBCOMM_BASE_URL: getOrbcommBaseUrl(),
    ORBCOMM_ACCESS_TOKEN: data.accessToken,
    ORBCOMM_REFRESH_TOKEN: data.refreshToken ?? state.ORBCOMM_REFRESH_TOKEN,
    ORBCOMM_ACCESS_TOKEN_EXPIRES_AT: data.accessTokenexpireOn ?? state.ORBCOMM_ACCESS_TOKEN_EXPIRES_AT,
    ORBCOMM_REFRESH_TOKEN_EXPIRES_AT: data.refreshTokenexpireOn ?? state.ORBCOMM_REFRESH_TOKEN_EXPIRES_AT,
  };
  await saveTokenState(nextState);
  return data.accessToken as string;
}

async function loadTokenState(): Promise<OrbcommTokenState> {
  const secretId = optionalEnv("ORBCOMM_SECRET_ID");
  const fromEnv: OrbcommTokenState = {
    ORBCOMM_USER_ID: optionalEnv("ORBCOMM_USER_ID") || optionalEnv("ORBCOMM_USERNAME"),
    ORBCOMM_PASSWORD: optionalEnv("ORBCOMM_PASSWORD"),
    ORBCOMM_BASE_URL: optionalEnv("ORBCOMM_BASE_URL"),
    ORBCOMM_ACCESS_TOKEN: optionalEnv("ORBCOMM_ACCESS_TOKEN"),
    ORBCOMM_REFRESH_TOKEN: optionalEnv("ORBCOMM_REFRESH_TOKEN"),
    ORBCOMM_ACCESS_TOKEN_EXPIRES_AT: optionalEnv("ORBCOMM_ACCESS_TOKEN_EXPIRES_AT"),
    ORBCOMM_REFRESH_TOKEN_EXPIRES_AT: optionalEnv("ORBCOMM_REFRESH_TOKEN_EXPIRES_AT"),
  };

  if (!secretId) {
    return fromEnv;
  }

  const result = await secretsClient.send(new GetSecretValueCommand({ SecretId: secretId }));
  const parsed = JSON.parse(result.SecretString ?? "{}") as OrbcommTokenState;
  return { ...fromEnv, ...parsed };
}

async function saveTokenState(state: OrbcommTokenState) {
  const secretId = optionalEnv("ORBCOMM_SECRET_ID");
  if (!secretId) {
    return;
  }
  await secretsClient.send(new PutSecretValueCommand({ SecretId: secretId, SecretString: JSON.stringify(state) }));
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

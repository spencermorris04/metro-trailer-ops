import { config as loadEnv } from "dotenv";

loadEnv();

type AttemptResult = {
  name: string;
  url: string;
  status: number | null;
  ok: boolean;
  body: string;
};

type OidcConfiguration = {
  token_endpoint?: string;
  token_endpoint_auth_methods_supported?: string[];
};

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

async function tryTokenRequest(name: string, url: string, init: RequestInit): Promise<AttemptResult> {
  try {
    const response = await fetch(url, init);
    const body = await response.text();
    return {
      name,
      url,
      status: response.status,
      ok: response.ok,
      body,
    };
  } catch (error) {
    return {
      name,
      url,
      status: null,
      ok: false,
      body: error instanceof Error ? error.message : String(error),
    };
  }
}

async function fetchDiscovery(url: string) {
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    const body = await response.text();
    if (!response.ok) {
      return {
        url,
        status: response.status,
        ok: false,
        body,
        tokenEndpoint: null,
        authMethods: [] as string[],
      };
    }

    const payload = JSON.parse(body) as OidcConfiguration;
    return {
      url,
      status: response.status,
      ok: true,
      body,
      tokenEndpoint: payload.token_endpoint ?? null,
      authMethods: payload.token_endpoint_auth_methods_supported ?? [],
    };
  } catch (error) {
    return {
      url,
      status: null,
      ok: false,
      body: error instanceof Error ? error.message : String(error),
      tokenEndpoint: null,
      authMethods: [] as string[],
    };
  }
}

async function main() {
  const clientId = requireEnv("SKYBITZ_CLIENT_ID");
  const clientSecret = requireEnv("SKYBITZ_CLIENT_SECRET");
  const basic = Buffer.from(`${clientId}:${clientSecret}`, "utf8").toString("base64");
  const prodDiscovery = await fetchDiscovery(
    "https://prodssoidp.skybitz.com/oauth2/oidcdiscovery/.well-known/openid-configuration",
  );
  const docsDiscovery = await fetchDiscovery(
    "https://ssoidp.skybitz.com/oauth2/oidcdiscovery/.well-known/openid-configuration",
  );

  const discoveredProdTokenUrl = prodDiscovery.tokenEndpoint;
  const discoveredProdProxyUrl = discoveredProdTokenUrl
    ? discoveredProdTokenUrl.replace(/:\d+(?=\/oauth2\/token$)/, "")
    : null;

  const attempts = await Promise.all([
    tryTokenRequest("prod_443_basic", "https://prodssoidp.skybitz.com/oauth2/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    }),
    tryTokenRequest("prod_443_post", "https://prodssoidp.skybitz.com/oauth2/token", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
      }),
    }),
    tryTokenRequest("legacy_docs_host_basic", "https://ssoidp.skybitz.com/oauth2/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    }),
    ...(discoveredProdTokenUrl
      ? [
          tryTokenRequest("prod_discovered_basic", discoveredProdTokenUrl, {
            method: "POST",
            headers: {
              Authorization: `Basic ${basic}`,
              Accept: "application/json",
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: "grant_type=client_credentials",
          }),
        ]
      : []),
    ...(discoveredProdProxyUrl && discoveredProdProxyUrl !== "https://prodssoidp.skybitz.com/oauth2/token"
      ? [
          tryTokenRequest("prod_discovered_proxy_basic", discoveredProdProxyUrl, {
            method: "POST",
            headers: {
              Authorization: `Basic ${basic}`,
              Accept: "application/json",
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: "grant_type=client_credentials",
          }),
        ]
      : []),
  ]);

  console.log(
    JSON.stringify(
      {
        discovery: [prodDiscovery, docsDiscovery],
        attempts,
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

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

type GraphTokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
};

type GraphTokenPayload = {
  app_displayname?: string;
  roles?: string[];
};

type GraphSite = {
  id: string;
  displayName?: string;
  webUrl?: string;
};

type GraphDrive = {
  id: string;
  name: string;
  webUrl?: string;
};

type GraphDriveItem = {
  id: string;
  name: string;
  webUrl?: string;
  file?: {
    mimeType?: string;
  };
};

type GraphCollectionResponse<T> = {
  value: T[];
};

const GRAPH_BASE_URL = "https://graph.microsoft.com/v1.0";
const DEFAULT_TRAILER_NUMBER = "5318190";
const DEFAULT_BASE_FOLDER = "FixedAssets";

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function getOptionalEnv(name: string) {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function decodeJwtPayload(token: string): GraphTokenPayload {
  const [, payload] = token.split(".");
  if (!payload) {
    throw new Error("Unable to decode Graph access token payload.");
  }

  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as GraphTokenPayload;
}

function normalizeFolderPath(folderPath: string) {
  return folderPath
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .join("/");
}

function encodeGraphPath(folderPath: string) {
  return normalizeFolderPath(folderPath)
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function buildOutputPath(trailerNumber: string, fileName: string) {
  const outputDir =
    getOptionalEnv("REGISTRATION_OUTPUT_DIR") ??
    path.join(process.cwd(), "artifacts", "registration-tests");

  return path.join(outputDir, `${trailerNumber}-${sanitizeFileName(fileName)}`);
}

async function getGraphAccessToken() {
  const tenantId = requireEnv("GRAPH_TENANT_ID");
  const clientId = requireEnv("GRAPH_CLIENT_ID");
  const clientSecret = requireEnv("GRAPH_CLIENT_SECRET");

  const response = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        scope: "https://graph.microsoft.com/.default",
        grant_type: "client_credentials",
      }),
    },
  );

  const payload = (await response.json()) as GraphTokenResponse;
  if (!response.ok || !payload.access_token) {
    throw new Error(
      `Failed to get Graph access token (${response.status}): ${payload.error_description ?? payload.error ?? "Unknown error"}`,
    );
  }

  const tokenClaims = decodeJwtPayload(payload.access_token);
  if (!tokenClaims.roles?.length) {
    throw new Error(
      `Graph token for app "${tokenClaims.app_displayname ?? "unknown"}" does not contain any Graph application roles. Grant admin consent for Microsoft Graph application permissions such as Sites.Read.All or Files.Read.All, then try again.`,
    );
  }

  return payload.access_token;
}

async function graphFetch(
  resourcePath: string,
  accessToken: string,
  init?: RequestInit,
) {
  const response = await fetch(`${GRAPH_BASE_URL}${resourcePath}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  return response;
}

async function graphJson<T>(
  resourcePath: string,
  accessToken: string,
  options?: {
    allowNotFound?: boolean;
  },
) {
  const response = await graphFetch(resourcePath, accessToken);
  if (response.status === 404 && options?.allowNotFound) {
    return null;
  }

  const bodyText = await response.text();
  if (!response.ok) {
    throw new Error(
      `Graph request failed for ${resourcePath} (${response.status}): ${bodyText}`,
    );
  }

  return JSON.parse(bodyText) as T;
}

async function resolveSites(accessToken: string) {
  const configuredSiteId = getOptionalEnv("SHAREPOINT_SITE_ID");
  if (configuredSiteId) {
    const site = await graphJson<GraphSite>(
      `/sites/${encodeURIComponent(configuredSiteId)}?$select=id,displayName,webUrl`,
      accessToken,
    );
    return [site];
  }

  const hostname = getOptionalEnv("SHAREPOINT_HOSTNAME");
  const sitePath = getOptionalEnv("SHAREPOINT_SITE_PATH");
  if (hostname && sitePath) {
    const normalizedPath = sitePath.startsWith("/") ? sitePath : `/${sitePath}`;
    const encodedPath = normalizedPath
      .split("/")
      .map((segment, index) => (index === 0 ? segment : encodeURIComponent(segment)))
      .join("/");
    const site = await graphJson<GraphSite>(
      `/sites/${hostname}:${encodedPath}?$select=id,displayName,webUrl`,
      accessToken,
    );
    return [site];
  }

  if (hostname) {
    const site = await graphJson<GraphSite>(
      `/sites/${hostname}:?$select=id,displayName,webUrl`,
      accessToken,
    );
    return [site];
  }

  const discoveredSites = await graphJson<GraphCollectionResponse<GraphSite>>(
    "/sites?search=*",
    accessToken,
  );
  return discoveredSites.value;
}

async function resolveDrives(siteId: string, accessToken: string) {
  const configuredDriveId = getOptionalEnv("SHAREPOINT_DRIVE_ID");
  if (configuredDriveId) {
    const drive = await graphJson<GraphDrive>(
      `/drives/${encodeURIComponent(configuredDriveId)}?$select=id,name,webUrl`,
      accessToken,
    );
    return [drive];
  }

  const drives = await graphJson<GraphCollectionResponse<GraphDrive>>(
    `/sites/${encodeURIComponent(siteId)}/drives?$select=id,name,webUrl`,
    accessToken,
  );

  const configuredLibraryName = getOptionalEnv("SHAREPOINT_LIBRARY_NAME");
  if (!configuredLibraryName) {
    return drives.value;
  }

  return drives.value.filter(
    (drive) => drive.name.toLowerCase() === configuredLibraryName.toLowerCase(),
  );
}

function pickPdf(items: GraphDriveItem[]) {
  return items
    .filter(
      (item) =>
        Boolean(item.file) &&
        item.name.toLowerCase().endsWith(".pdf"),
    )
    .sort((left, right) => left.name.localeCompare(right.name))[0];
}

async function findRegistrationPdf(
  trailerNumber: string,
  accessToken: string,
) {
  const baseFolderPath = normalizeFolderPath(
    getOptionalEnv("SHAREPOINT_BASE_FOLDER_PATH") ?? DEFAULT_BASE_FOLDER,
  );
  const folderPath = `${baseFolderPath}/${trailerNumber}`;
  const encodedFolderPath = encodeGraphPath(folderPath);
  const sites = await resolveSites(accessToken);

  if (!sites.length) {
    throw new Error("No SharePoint sites were returned by Microsoft Graph.");
  }

  for (const site of sites) {
    const drives = await resolveDrives(site.id, accessToken);
    for (const drive of drives) {
      console.log(`Checking site "${site.displayName ?? site.id}" drive "${drive.name}"...`);

      const children = await graphJson<GraphCollectionResponse<GraphDriveItem>>(
        `/drives/${encodeURIComponent(drive.id)}/root:/${encodedFolderPath}:/children?$select=id,name,webUrl,file`,
        accessToken,
        { allowNotFound: true },
      );

      if (!children) {
        continue;
      }

      const pdf = pickPdf(children.value);
      if (!pdf) {
        throw new Error(
          `Found folder "${folderPath}" in drive "${drive.name}" but it does not contain a PDF.`,
        );
      }

      return {
        site,
        drive,
        pdf,
      };
    }
  }

  throw new Error(
    `Could not find SharePoint folder "${baseFolderPath}/${trailerNumber}" in any accessible site or document library.`,
  );
}

async function downloadPdf(
  driveId: string,
  itemId: string,
  accessToken: string,
) {
  const response = await graphFetch(
    `/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(itemId)}/content`,
    accessToken,
  );

  if (!response.ok) {
    const bodyText = await response.text();
    throw new Error(
      `Failed to download PDF (${response.status}): ${bodyText}`,
    );
  }

  return Buffer.from(await response.arrayBuffer());
}

async function main() {
  const trailerNumber = process.argv[2]?.trim() || DEFAULT_TRAILER_NUMBER;
  const accessToken = await getGraphAccessToken();

  console.log(`Looking up trailer ${trailerNumber}...`);
  const match = await findRegistrationPdf(trailerNumber, accessToken);
  console.log(`Found PDF "${match.pdf.name}" in "${match.drive.name}".`);

  const bytes = await downloadPdf(match.drive.id, match.pdf.id, accessToken);
  const outputPath = buildOutputPath(trailerNumber, match.pdf.name);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, bytes);

  console.log(`Saved PDF to ${outputPath}`);
  console.log(`Site: ${match.site.displayName ?? match.site.id}`);
  console.log(`Drive: ${match.drive.name}`);
  console.log(`File URL: ${match.pdf.webUrl ?? "n/a"}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

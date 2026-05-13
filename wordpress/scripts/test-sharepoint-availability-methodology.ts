// @ts-nocheck
import { performance } from "node:perf_hooks";

type GraphTokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
};

type GraphDriveItem = {
  id: string;
  name: string;
  webUrl?: string;
  parentReference?: {
    driveId?: string;
    id?: string;
    path?: string;
  };
  file?: {
    mimeType?: string;
  };
  folder?: {
    childCount?: number;
  };
  deleted?: unknown;
  lastModifiedDateTime?: string;
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

type GraphCollectionResponse<T> = {
  value: T[];
  "@odata.nextLink"?: string;
  "@odata.deltaLink"?: string;
};

const GRAPH_BASE_URL = "https://graph.microsoft.com/v1.0";
const DEFAULT_BASE_FOLDER = "FixedAssets";
const DEFAULT_SAMPLE_FOLDERS = 120;
const DEFAULT_DELTA_PAGES = 8;
const DEFAULT_ROOT_DELTA_PAGES = 12;
const CHILDREN_PAGE_SIZE = 999;

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

function detectDocumentType(fileName: string) {
  const upper = fileName.toUpperCase();
  if (upper.endsWith("_R.PDF")) {
    return "Registration";
  }

  if (upper.endsWith("_I.PDF")) {
    return "Inspection";
  }

  return "Other";
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

  return payload.access_token;
}

async function graphFetch(resourcePathOrUrl: string, accessToken: string) {
  const url = resourcePathOrUrl.startsWith("http")
    ? resourcePathOrUrl
    : `${GRAPH_BASE_URL}${resourcePathOrUrl}`;

  return fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });
}

async function graphJson<T>(
  resourcePathOrUrl: string,
  accessToken: string,
  options?: { allowNotFound?: boolean },
) {
  const response = await graphFetch(resourcePathOrUrl, accessToken);
  if (response.status === 404 && options?.allowNotFound) {
    return null;
  }

  const bodyText = await response.text();
  if (!response.ok) {
    throw new Error(
      `Graph request failed for ${resourcePathOrUrl} (${response.status}): ${bodyText}`,
    );
  }

  return JSON.parse(bodyText) as T;
}

async function resolveSite(accessToken: string) {
  const configuredSiteId = getOptionalEnv("SHAREPOINT_SITE_ID");
  if (configuredSiteId) {
    return graphJson<GraphSite>(
      `/sites/${encodeURIComponent(configuredSiteId)}?$select=id,displayName,webUrl`,
      accessToken,
    );
  }

  const hostname = requireEnv("SHAREPOINT_HOSTNAME");
  const sitePath = getOptionalEnv("SHAREPOINT_SITE_PATH");
  if (sitePath) {
    const normalizedPath = sitePath.startsWith("/") ? sitePath : `/${sitePath}`;
    const encodedPath = normalizedPath
      .split("/")
      .map((segment, index) => (index === 0 ? segment : encodeURIComponent(segment)))
      .join("/");

    return graphJson<GraphSite>(
      `/sites/${hostname}:${encodedPath}?$select=id,displayName,webUrl`,
      accessToken,
    );
  }

  return graphJson<GraphSite>(
    `/sites/${hostname}:?$select=id,displayName,webUrl`,
    accessToken,
  );
}

async function resolveDrive(siteId: string, accessToken: string) {
  const configuredDriveId = getOptionalEnv("SHAREPOINT_DRIVE_ID");
  if (configuredDriveId) {
    return graphJson<GraphDrive>(
      `/drives/${encodeURIComponent(configuredDriveId)}?$select=id,name,webUrl`,
      accessToken,
    );
  }

  const libraryName = requireEnv("SHAREPOINT_LIBRARY_NAME");
  const drives = await graphJson<GraphCollectionResponse<GraphDrive>>(
    `/sites/${encodeURIComponent(siteId)}/drives?$select=id,name,webUrl`,
    accessToken,
  );

  const match = drives.value.find(
    (drive) => drive.name.toLowerCase() === libraryName.toLowerCase(),
  );
  if (!match) {
    throw new Error(`Could not find drive/library named "${libraryName}".`);
  }

  return match;
}

async function listAllChildrenByPath(
  driveId: string,
  folderPath: string,
  accessToken: string,
) {
  const items: GraphDriveItem[] = [];
  let nextUrl:
    | string
    | undefined = `/drives/${encodeURIComponent(driveId)}/root:/${encodeGraphPath(folderPath)}:/children?$top=${CHILDREN_PAGE_SIZE}&$select=id,name,folder,file,parentReference,lastModifiedDateTime`;

  while (nextUrl) {
    const payload = await graphJson<GraphCollectionResponse<GraphDriveItem>>(nextUrl, accessToken);
    items.push(...payload.value);
    nextUrl = payload["@odata.nextLink"];
  }

  return items;
}

async function getItemByPath(
  driveId: string,
  folderPath: string,
  accessToken: string,
) {
  return graphJson<GraphDriveItem>(
    `/drives/${encodeURIComponent(driveId)}/root:/${encodeGraphPath(folderPath)}?$select=id,name,parentReference,folder,file,lastModifiedDateTime`,
    accessToken,
  );
}

function summarizeFolderDocuments(items: GraphDriveItem[]) {
  let registration = 0;
  let inspection = 0;
  let otherPdf = 0;

  for (const item of items) {
    if (!item.file || !item.name.toLowerCase().endsWith(".pdf")) {
      continue;
    }

    const type = detectDocumentType(item.name);
    if (type === "Registration") {
      registration++;
    } else if (type === "Inspection") {
      inspection++;
    } else {
      otherPdf++;
    }
  }

  return {
    registration,
    inspection,
    otherPdf,
  };
}

async function runBaselineSample(
  driveId: string,
  baseFolderPath: string,
  accessToken: string,
  sampleSize: number,
) {
  const allFolders = await listAllChildrenByPath(driveId, baseFolderPath, accessToken);
  const trailerFolders = allFolders.filter((item) => item.folder);
  const sample = trailerFolders.slice(0, sampleSize);

  const started = performance.now();
  const rows: Array<{
    folder: string;
    registration: number;
    inspection: number;
    otherPdf: number;
    fileCount: number;
  }> = [];

  for (const folder of sample) {
    const children = await listAllChildrenByPath(
      driveId,
      `${baseFolderPath}/${folder.name}`,
      accessToken,
    );
    const summary = summarizeFolderDocuments(children);
    rows.push({
      folder: folder.name,
      registration: summary.registration,
      inspection: summary.inspection,
      otherPdf: summary.otherPdf,
      fileCount: children.filter((item) => !!item.file).length,
    });
  }

  const elapsedMs = performance.now() - started;
  const foldersWithRegistration = rows.filter((row) => row.registration > 0).length;
  const foldersWithInspection = rows.filter((row) => row.inspection > 0).length;
  const foldersWithEither = rows.filter(
    (row) => row.registration > 0 || row.inspection > 0,
  ).length;

  return {
    totalFoldersInLibrary: trailerFolders.length,
    sampledFolders: rows.length,
    elapsedMs,
    avgMsPerFolder: rows.length ? elapsedMs / rows.length : 0,
    estimatedHoursForFullBaseline:
      trailerFolders.length && rows.length
        ? (elapsedMs / rows.length) * trailerFolders.length / 1000 / 60 / 60
        : 0,
    foldersWithRegistration,
    foldersWithInspection,
    foldersWithEither,
    sampleRows: rows.slice(0, 12),
  };
}

function extractTrailerFolderFromPath(pathValue: string | undefined, baseFolderName: string) {
  if (!pathValue) {
    return null;
  }

  const normalized = pathValue.toLowerCase();
  const needle = `/${baseFolderName.toLowerCase()}/`;
  const index = normalized.indexOf(needle);
  if (index === -1) {
    return null;
  }

  const after = pathValue.slice(index + needle.length);
  const [folderName] = after.split("/");
  return folderName || null;
}

async function testDeltaMethodology(
  label: string,
  initialUrl: string,
  baseFolderName: string,
  accessToken: string,
  maxPages: number,
) {
  const pageSummaries: Array<{
    page: number;
    items: number;
    folderItems: number;
    fileItems: number;
    matchingDocs: number;
  }> = [];
  const docExamples: Array<{
    name: string;
    type: string;
    trailerFolder: string | null;
    parentPath?: string;
  }> = [];

  let nextUrl: string | undefined = initialUrl;
  let deltaLink: string | undefined;

  for (let page = 1; page <= maxPages && nextUrl; page += 1) {
    const payload = await graphJson<GraphCollectionResponse<GraphDriveItem>>(nextUrl, accessToken);
    const items = payload.value;
    let folderItems = 0;
    let fileItems = 0;
    let matchingDocs = 0;

    for (const item of items) {
      if (item.folder) {
        folderItems += 1;
      }

      if (item.file) {
        fileItems += 1;
        const type = detectDocumentType(item.name);
        if (type !== "Other") {
          matchingDocs += 1;
          if (docExamples.length < 15) {
            docExamples.push({
              name: item.name,
              type,
              trailerFolder: extractTrailerFolderFromPath(
                item.parentReference?.path,
                baseFolderName,
              ),
              parentPath: item.parentReference?.path,
            });
          }
        }
      }
    }

    pageSummaries.push({
      page,
      items: items.length,
      folderItems,
      fileItems,
      matchingDocs,
    });

    nextUrl = payload["@odata.nextLink"];
    deltaLink = payload["@odata.deltaLink"] ?? deltaLink;
  }

  const totalMatchingDocs = pageSummaries.reduce((sum, page) => sum + page.matchingDocs, 0);
  const examplesWithTrailerFolder = docExamples.filter((item) => !!item.trailerFolder).length;

  return {
    label,
    pagesRead: pageSummaries.length,
    totalMatchingDocs,
    examplesWithTrailerFolder,
    pageSummaries,
    docExamples,
    deltaLinkAvailable: Boolean(deltaLink),
  };
}

async function main() {
  const accessToken = await getGraphAccessToken();
  const site = await resolveSite(accessToken);
  const drive = await resolveDrive(site.id, accessToken);
  const baseFolderPath = normalizeFolderPath(
    getOptionalEnv("SHAREPOINT_BASE_FOLDER_PATH") ?? DEFAULT_BASE_FOLDER,
  );
  const fixedAssetsItem = await getItemByPath(drive.id, baseFolderPath, accessToken);
  const sampleSize = Number(getOptionalEnv("BASELINE_SAMPLE_FOLDERS") ?? DEFAULT_SAMPLE_FOLDERS);
  const deltaPages = Number(getOptionalEnv("DELTA_TEST_PAGES") ?? DEFAULT_DELTA_PAGES);
  const rootDeltaPages = Number(
    getOptionalEnv("ROOT_DELTA_TEST_PAGES") ?? DEFAULT_ROOT_DELTA_PAGES,
  );

  console.log(`Site: ${site.displayName ?? site.id}`);
  console.log(`Drive: ${drive.name} (${drive.id})`);
  console.log(`Base folder: ${baseFolderPath} (${fixedAssetsItem.id})`);
  console.log("");

  console.log(`Running baseline sample over ${sampleSize} trailer folders...`);
  const baseline = await runBaselineSample(
    drive.id,
    baseFolderPath,
    accessToken,
    sampleSize,
  );

  console.log(
    JSON.stringify(
      {
        baseline: {
          totalFoldersInLibrary: baseline.totalFoldersInLibrary,
          sampledFolders: baseline.sampledFolders,
          elapsedMs: Math.round(baseline.elapsedMs),
          avgMsPerFolder: Math.round(baseline.avgMsPerFolder * 100) / 100,
          estimatedHoursForFullBaseline:
            Math.round(baseline.estimatedHoursForFullBaseline * 100) / 100,
          foldersWithRegistration: baseline.foldersWithRegistration,
          foldersWithInspection: baseline.foldersWithInspection,
          foldersWithEither: baseline.foldersWithEither,
          sampleRows: baseline.sampleRows,
        },
      },
      null,
      2,
    ),
  );

  console.log("");
  console.log(`Testing FixedAssets-item delta methodology over ${deltaPages} page(s)...`);
  const fixedAssetsDelta = await testDeltaMethodology(
    "fixedAssetsItemDelta",
    `/drives/${encodeURIComponent(drive.id)}/items/${encodeURIComponent(fixedAssetsItem.id)}/delta?$top=200&$select=id,name,parentReference,file,folder,deleted,lastModifiedDateTime`,
    baseFolderPath.split("/").pop() ?? DEFAULT_BASE_FOLDER,
    accessToken,
    deltaPages,
  );

  console.log(JSON.stringify({ fixedAssetsDelta }, null, 2));

  console.log("");
  console.log(`Testing drive-root delta methodology over ${rootDeltaPages} page(s)...`);
  const rootDelta = await testDeltaMethodology(
    "driveRootDelta",
    `/drives/${encodeURIComponent(drive.id)}/root/delta?$top=200&$select=id,name,parentReference,file,folder,deleted,lastModifiedDateTime`,
    baseFolderPath.split("/").pop() ?? DEFAULT_BASE_FOLDER,
    accessToken,
    rootDeltaPages,
  );

  console.log(JSON.stringify({ rootDelta }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

import { mkdir, writeFile } from "node:fs/promises";
import * as path from "node:path";

import { config as loadEnv } from "dotenv";

loadEnv();

type ExportKind = "odata" | "api-root";

type DatasetConfig = {
  key: string;
  kind: ExportKind;
  label: string;
  group: string;
  serviceName?: string;
  description: string;
};

type DatasetResult = {
  key: string;
  kind: ExportKind;
  label: string;
  group: string;
  description: string;
  status: "exported" | "blocked" | "missing" | "failed";
  httpStatus: number | null;
  records: number;
  pages: number;
  jsonPath: string | null;
  csvPath: string | null;
  error: string;
  sampleFields: string[];
};

type ExportOptions = {
  outDir: string;
  pageSize: number;
  maxPages: number | null;
  datasetKeys: Set<string> | null;
};

type HttpResponse = {
  status: number;
  body: string;
  headers: Headers;
};

type FetchJsonResult = {
  ok: boolean;
  status: number;
  payload: Record<string, unknown> | null;
  rawBody: string;
  error: string;
};

type AccessTokenState = {
  value: string;
};

const API_BASE_URL = "https://api.businesscentral.dynamics.com/v2.0";

const DEFAULT_OUT_DIR = path.join(process.cwd(), "artifacts", "business-central");
const DEFAULT_PAGE_SIZE = 1000;

const DATASETS: DatasetConfig[] = [
  {
    key: "api-root",
    kind: "api-root",
    label: "Standard API Root",
    group: "metadata",
    description: "Built-in API v2.0 service document listing available entity sets.",
  },
  {
    key: "odata-catalog",
    kind: "odata",
    label: "OData Service Catalog",
    group: "metadata",
    serviceName: "",
    description: "Published OData web service catalog for the tenant/environment.",
  },
  {
    key: "fixed-assets",
    kind: "odata",
    label: "Fixed Assets",
    group: "assets",
    serviceName: "FixedAssets",
    description: "Primary trailer and equipment master records.",
  },
  {
    key: "fixed-asset-card",
    kind: "odata",
    label: "Fixed Asset Card",
    group: "assets",
    serviceName: "FixedAssetCard",
    description: "Card-style fixed asset view with additional fields.",
  },
  {
    key: "fa-ledger-entries",
    kind: "odata",
    label: "FA Ledger Entries",
    group: "assets",
    serviceName: "FALedgerEntries",
    description: "Fixed asset ledger activity and depreciation-adjacent records.",
  },
  {
    key: "fa-classes",
    kind: "odata",
    label: "FA Classes",
    group: "assets",
    serviceName: "FAClasses",
    description: "Fixed asset class master data.",
  },
  {
    key: "customers",
    kind: "odata",
    label: "Customers",
    group: "customers",
    serviceName: "Customers",
    description: "Customer list web service.",
  },
  {
    key: "customer-card",
    kind: "odata",
    label: "Customer Card",
    group: "customers",
    serviceName: "CustomerCard",
    description: "Customer card web service.",
  },
  {
    key: "customer-ledger-entries",
    kind: "odata",
    label: "Customer Ledger Entries",
    group: "customers",
    serviceName: "CustomerLedgerEntries",
    description: "Customer receivables ledger entries.",
  },
  {
    key: "cust-ledger-entries",
    kind: "odata",
    label: "Cust. Ledger Entries",
    group: "customers",
    serviceName: "Cust_LedgerEntries",
    description: "Alternate customer ledger entry view.",
  },
  {
    key: "power-bi-customer-list",
    kind: "odata",
    label: "Power BI Customer List",
    group: "customers",
    serviceName: "Power_BI_Customer_List",
    description: "Accessible customer projection used for reporting.",
  },
  {
    key: "power-bi-cust-ledger-entries",
    kind: "odata",
    label: "Power BI Customer Ledger Entries",
    group: "customers",
    serviceName: "Power_BI_Cust_Ledger_Entries",
    description: "Customer ledger reporting projection.",
  },
  {
    key: "top-customer-overview",
    kind: "odata",
    label: "Top Customer Overview",
    group: "customers",
    serviceName: "TopCustomerOverview",
    description: "Customer revenue summary view.",
  },
  {
    key: "web-portal-customer-list",
    kind: "odata",
    label: "Web Portal Customer List",
    group: "customers",
    serviceName: "WebPortalCustomerList",
    description: "Custom web portal customer projection.",
  },
  {
    key: "sales-order",
    kind: "odata",
    label: "Sales Order",
    group: "orders",
    serviceName: "SalesOrder",
    description: "Standard sales order page published as OData.",
  },
  {
    key: "sales-order-lines",
    kind: "odata",
    label: "Sales Order Lines",
    group: "orders",
    serviceName: "SalesOrderSalesLines",
    description: "Sales order lines for the standard sales order page.",
  },
  {
    key: "sales-documents",
    kind: "odata",
    label: "Sales Documents",
    group: "orders",
    serviceName: "salesDocuments",
    description: "Workflow-oriented sales document API page.",
  },
  {
    key: "sales-document-lines",
    kind: "odata",
    label: "Sales Document Lines",
    group: "orders",
    serviceName: "salesDocumentLines",
    description: "Workflow-oriented sales document lines.",
  },
  {
    key: "power-bi-sales-list",
    kind: "odata",
    label: "Power BI Sales List",
    group: "orders",
    serviceName: "Power_BI_Sales_List",
    description: "Accessible sales-line reporting projection.",
  },
  {
    key: "power-bi-sales-hdr-cust",
    kind: "odata",
    label: "Power BI Sales Header Customer",
    group: "orders",
    serviceName: "Power_BI_Sales_Hdr_Cust",
    description: "Accessible sales header to customer projection.",
  },
  {
    key: "sales-orders-by-salesperson",
    kind: "odata",
    label: "Sales Orders By Salesperson",
    group: "orders",
    serviceName: "SalesOrdersBySalesPerson",
    description: "Sales line/reporting view keyed by salesperson.",
  },
  {
    key: "workflow-sales-documents",
    kind: "odata",
    label: "Workflow Sales Documents",
    group: "orders",
    serviceName: "workflowSalesDocuments",
    description: "Workflow sales document page.",
  },
  {
    key: "workflow-sales-document-lines",
    kind: "odata",
    label: "Workflow Sales Document Lines",
    group: "orders",
    serviceName: "workflowSalesDocumentLines",
    description: "Workflow sales document line page.",
  },
  {
    key: "posted-rental-header",
    kind: "odata",
    label: "WS Posted Rental Header",
    group: "rentals",
    serviceName: "WSPostedRentalHeader",
    description: "Custom posted rental header web service.",
  },
  {
    key: "posted-rental-line",
    kind: "odata",
    label: "WS Posted Rental Line",
    group: "rentals",
    serviceName: "WSPostedRentalLine",
    description: "Custom posted rental line web service.",
  },
  {
    key: "rental-ledger-entries",
    kind: "odata",
    label: "Rental Ledger Entries",
    group: "rentals",
    serviceName: "RentalLedgerEntries",
    description: "Rental ledger activity page.",
  },
  {
    key: "ws-rental-ledger-entries",
    kind: "odata",
    label: "WS Rental Ledger Entries",
    group: "rentals",
    serviceName: "WSRentalLedgerEntries",
    description: "Custom rental ledger entry web service.",
  },
  {
    key: "posted-rental-invoice",
    kind: "odata",
    label: "Posted Rental Invoice Excel",
    group: "rentals",
    serviceName: "Posted_Rental_Invoice_Excel",
    description: "Custom posted rental invoice export page.",
  },
  {
    key: "posted-rental-invoice-rentals-subform",
    kind: "odata",
    label: "Posted Rental Invoice Rentals Subform",
    group: "rentals",
    serviceName: "Posted_Rental_Invoice_ExcelRentalsSubform",
    description: "Custom posted rental invoice rental lines page.",
  },
  {
    key: "posted-rental-invoice-sales-subform",
    kind: "odata",
    label: "Posted Rental Invoice Sales Subform",
    group: "rentals",
    serviceName: "Posted_Rental_Invoice_ExcelSalesSubform",
    description: "Custom posted rental invoice sales lines page.",
  },
  {
    key: "gl-entries",
    kind: "odata",
    label: "G/L Entries",
    group: "finance",
    serviceName: "G_LEntries",
    description: "General ledger entries.",
  },
  {
    key: "gl-entries-excel",
    kind: "odata",
    label: "General Ledger Entries Excel",
    group: "finance",
    serviceName: "General_Ledger_Entries_Excel",
    description: "General ledger export page used for Excel/reporting.",
  },
  {
    key: "chart-of-accounts",
    kind: "odata",
    label: "Chart of Accounts",
    group: "finance",
    serviceName: "Chart_of_Accounts",
    description: "G/L account master data.",
  },
  {
    key: "bank-ledger-entries",
    kind: "odata",
    label: "Bank Account Ledger Entries",
    group: "finance",
    serviceName: "BankAccountLedgerEntries",
    description: "Bank ledger entry history.",
  },
  {
    key: "vendor-ledger-entries",
    kind: "odata",
    label: "Vendor Ledger Entries",
    group: "finance",
    serviceName: "VendorLedgerEntries",
    description: "Vendor payables ledger entries.",
  },
  {
    key: "dimension-sets",
    kind: "odata",
    label: "Dimension Sets",
    group: "finance",
    serviceName: "DimensionSets",
    description: "Dimension set headers used across BC transactions.",
  },
  {
    key: "dimension-set-entries",
    kind: "odata",
    label: "Dimension Set Entries",
    group: "finance",
    serviceName: "DimensionSetEntries",
    description: "Dimension set line values for analytic joins.",
  },
  {
    key: "value-entries",
    kind: "odata",
    label: "Value Entries",
    group: "finance",
    serviceName: "ValueEntries",
    description: "Item value entry history used for cost/revenue analysis.",
  },
];

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

function parseArgs(argv: string[]): ExportOptions {
  let outDir = DEFAULT_OUT_DIR;
  let pageSize = DEFAULT_PAGE_SIZE;
  let maxPages: number | null = null;
  let datasetKeys: Set<string> | null = null;

  for (const arg of argv) {
    if (arg.startsWith("--out-dir=")) {
      outDir = path.resolve(arg.slice("--out-dir=".length).trim());
      continue;
    }

    if (arg.startsWith("--page-size=")) {
      pageSize = parsePositiveInteger(arg.slice("--page-size=".length), "--page-size");
      continue;
    }

    if (arg.startsWith("--max-pages=")) {
      maxPages = parsePositiveInteger(arg.slice("--max-pages=".length), "--max-pages");
      continue;
    }

    if (arg.startsWith("--datasets=")) {
      const raw = arg.slice("--datasets=".length).trim();
      datasetKeys = new Set(
        raw
          .split(",")
          .map((part) => part.trim())
          .filter(Boolean),
      );
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return { outDir, pageSize, maxPages, datasetKeys };
}

function createCsv(rows: Array<Record<string, unknown>>) {
  if (rows.length === 0) {
    return "";
  }

  const headers = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      headers.add(key);
    }
  }

  const orderedHeaders = Array.from(headers).sort((a, b) => a.localeCompare(b));
  const lines = [orderedHeaders.join(",")];

  for (const row of rows) {
    const values = orderedHeaders.map((header) => escapeCsvValue(row[header]));
    lines.push(values.join(","));
  }

  return `${lines.join("\n")}\n`;
}

function escapeCsvValue(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  const normalized =
    typeof value === "string"
      ? value
      : typeof value === "number" || typeof value === "boolean"
        ? String(value)
        : JSON.stringify(value);

  if (/[",\n\r]/.test(normalized)) {
    return `"${normalized.replace(/"/g, "\"\"")}"`;
  }

  return normalized;
}

async function ensureDir(dirPath: string) {
  await mkdir(dirPath, { recursive: true });
}

async function httpRequest(url: string, accessToken: string): Promise<HttpResponse> {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  return {
    status: response.status,
    body: await response.text(),
    headers: response.headers,
  };
}

async function fetchJson(url: string, accessToken: string): Promise<FetchJsonResult> {
  const response = await httpRequest(url, accessToken);
  let payload: Record<string, unknown> | null = null;

  if (response.body) {
    try {
      payload = JSON.parse(response.body) as Record<string, unknown>;
    } catch {
      return {
        ok: false,
        status: response.status,
        payload: null,
        rawBody: response.body,
        error: "Response was not valid JSON.",
      };
    }
  }

  if (response.status < 200 || response.status >= 300) {
    return {
      ok: false,
      status: response.status,
      payload,
      rawBody: response.body,
      error: extractErrorMessage(payload) || `HTTP ${response.status}`,
    };
  }

  return {
    ok: true,
    status: response.status,
    payload,
    rawBody: response.body,
    error: "",
  };
}

async function fetchJsonWithRefresh(url: string, tokenState: AccessTokenState): Promise<FetchJsonResult> {
  let attempts = 0;
  let result = await fetchJson(url, tokenState.value);

  while (attempts < 4) {
    if (result.status === 401) {
      tokenState.value = await getAccessToken();
      result = await fetchJson(url, tokenState.value);
      attempts += 1;
      continue;
    }

    if (result.status === 429 || result.status === 503) {
      const waitMs = Math.min(5_000 * 2 ** attempts, 30_000);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      result = await fetchJson(url, tokenState.value);
      attempts += 1;
      continue;
    }

    return result;
  }

  return result;
}

function extractErrorMessage(payload: Record<string, unknown> | null) {
  if (!payload) {
    return "";
  }

  const error = payload.error;
  if (typeof error === "object" && error !== null) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") {
      return message;
    }
  }

  return "";
}

async function getAccessToken() {
  const tenantId = requireEnv("METRO_GRAPH_TENANT_ID");
  const clientId = requireEnv("METRO_GRAPH_CLIENT_ID");
  const clientSecret = requireEnv("METRO_GRAPH_CLIENT_SECRET");

  const response = await fetch(
    `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "client_credentials",
        scope: "https://api.businesscentral.dynamics.com/.default",
      }),
    },
  );

  const payload = (await response.json()) as {
    access_token?: string;
    error_description?: string;
  };

  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description || `BC authentication failed with HTTP ${response.status}.`);
  }

  return payload.access_token;
}

function getStandardApiRootUrl() {
  const tenantId = requireEnv("METRO_GRAPH_TENANT_ID");
  const environment = requireEnv("METRO_BC_ENVIRONMENT");
  return `${API_BASE_URL}/${encodeURIComponent(tenantId)}/${encodeURIComponent(environment)}/api/v2.0/`;
}

function getODataRootUrl() {
  const tenantId = requireEnv("METRO_GRAPH_TENANT_ID");
  const environment = requireEnv("METRO_BC_ENVIRONMENT");
  return `${API_BASE_URL}/${encodeURIComponent(tenantId)}/${encodeURIComponent(environment)}/ODataV4`;
}

function buildODataCollectionUrl(serviceName: string, pageSize: number, company: string, skip = 0) {
  const url = new URL(`${getODataRootUrl()}/${serviceName}`);
  url.searchParams.set("company", company);
  url.searchParams.set("$top", String(pageSize));
  if (skip > 0) {
    url.searchParams.set("$skip", String(skip));
  }
  return url.toString();
}

function normalizeRows(value: unknown) {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object");
  }

  return [] as Array<Record<string, unknown>>;
}

async function exportApiRoot(tokenState: AccessTokenState, outDir: string): Promise<DatasetResult> {
  const jsonResult = await fetchJsonWithRefresh(getStandardApiRootUrl(), tokenState);
  if (!jsonResult.ok || !jsonResult.payload) {
    return {
      key: "api-root",
      kind: "api-root",
      label: "Standard API Root",
      group: "metadata",
      description: "Built-in API v2.0 service document listing available entity sets.",
      status: jsonResult.status === 403 ? "blocked" : "failed",
      httpStatus: jsonResult.status,
      records: 0,
      pages: 0,
      jsonPath: null,
      csvPath: null,
      error: jsonResult.error,
      sampleFields: [],
    };
  }

  const rows = normalizeRows(jsonResult.payload.value);
  const datasetDir = path.join(outDir, "metadata");
  await ensureDir(datasetDir);
  const jsonPath = path.join(datasetDir, "api-root.json");
  const csvPath = path.join(datasetDir, "api-root.csv");
  await writeFile(jsonPath, JSON.stringify(jsonResult.payload, null, 2), "utf8");
  await writeFile(csvPath, createCsv(rows), "utf8");

  return {
    key: "api-root",
    kind: "api-root",
    label: "Standard API Root",
    group: "metadata",
    description: "Built-in API v2.0 service document listing available entity sets.",
    status: "exported",
    httpStatus: jsonResult.status,
    records: rows.length,
    pages: 1,
    jsonPath,
    csvPath,
    error: "",
    sampleFields: rows[0] ? Object.keys(rows[0]).sort((a, b) => a.localeCompare(b)) : [],
  };
}

async function exportODataDataset(
  tokenState: AccessTokenState,
  dataset: DatasetConfig,
  options: ExportOptions,
): Promise<DatasetResult> {
  const company = requireEnv("METRO_BC_COMPANY");
  const serviceName = dataset.serviceName ?? "";

  if (dataset.key === "odata-catalog") {
    const jsonResult = await fetchJsonWithRefresh(`${getODataRootUrl()}/?$format=json`, tokenState);
    if (!jsonResult.ok || !jsonResult.payload) {
      return {
        key: dataset.key,
        kind: dataset.kind,
        label: dataset.label,
        group: dataset.group,
        description: dataset.description,
        status: jsonResult.status === 403 ? "blocked" : "failed",
        httpStatus: jsonResult.status,
        records: 0,
        pages: 0,
        jsonPath: null,
        csvPath: null,
        error: jsonResult.error,
        sampleFields: [],
      };
    }

    const rows = normalizeRows(jsonResult.payload.value);
    const datasetDir = path.join(options.outDir, dataset.group);
    await ensureDir(datasetDir);
    const jsonPath = path.join(datasetDir, `${dataset.key}.json`);
    const csvPath = path.join(datasetDir, `${dataset.key}.csv`);
    await writeFile(jsonPath, JSON.stringify(jsonResult.payload, null, 2), "utf8");
    await writeFile(csvPath, createCsv(rows), "utf8");

    return {
      key: dataset.key,
      kind: dataset.kind,
      label: dataset.label,
      group: dataset.group,
      description: dataset.description,
      status: "exported",
      httpStatus: jsonResult.status,
      records: rows.length,
      pages: 1,
      jsonPath,
      csvPath,
      error: "",
      sampleFields: rows[0] ? Object.keys(rows[0]).sort((a, b) => a.localeCompare(b)) : [],
    };
  }

  const rows: Array<Record<string, unknown>> = [];
  const pagePayloads: Array<Record<string, unknown>> = [];
  let pages = 0;
  let skip = 0;
  let nextUrl: string | null = buildODataCollectionUrl(serviceName, options.pageSize, company, 0);

  while (nextUrl) {
    const pageResult = await fetchJsonWithRefresh(nextUrl, tokenState);
    if (!pageResult.ok || !pageResult.payload) {
      return {
        key: dataset.key,
        kind: dataset.kind,
        label: dataset.label,
        group: dataset.group,
        description: dataset.description,
        status:
          pageResult.status === 403 ? "blocked" : pageResult.status === 404 ? "missing" : "failed",
        httpStatus: pageResult.status,
        records: rows.length,
        pages,
        jsonPath: null,
        csvPath: null,
        error: pageResult.error,
        sampleFields: rows[0] ? Object.keys(rows[0]).sort((a, b) => a.localeCompare(b)) : [],
      };
    }

    pagePayloads.push(pageResult.payload);
    const pageRows = normalizeRows(pageResult.payload.value);
    rows.push(...pageRows);
    pages += 1;

    const odataNext = pageResult.payload["@odata.nextLink"];
    if (typeof odataNext === "string" && odataNext.trim()) {
      nextUrl = odataNext;
    } else if (pageRows.length === options.pageSize) {
      skip += options.pageSize;
      nextUrl = buildODataCollectionUrl(serviceName, options.pageSize, company, skip);
    } else {
      nextUrl = null;
    }

    if (options.maxPages !== null && pages >= options.maxPages) {
      nextUrl = null;
    }
  }

  const datasetDir = path.join(options.outDir, dataset.group);
  await ensureDir(datasetDir);
  const jsonPath = path.join(datasetDir, `${dataset.key}.json`);
  const csvPath = path.join(datasetDir, `${dataset.key}.csv`);
  await writeFile(
    jsonPath,
    JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        serviceName,
        company,
        pages,
        records: rows.length,
        items: rows,
      },
      null,
      2,
    ),
    "utf8",
  );
  await writeFile(csvPath, createCsv(rows), "utf8");

  return {
    key: dataset.key,
    kind: dataset.kind,
    label: dataset.label,
    group: dataset.group,
    description: dataset.description,
    status: "exported",
    httpStatus: 200,
    records: rows.length,
    pages,
    jsonPath,
    csvPath,
    error: "",
    sampleFields: rows[0] ? Object.keys(rows[0]).sort((a, b) => a.localeCompare(b)) : [],
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  await ensureDir(options.outDir);

  const selectedDatasets = DATASETS.filter((dataset) => {
    if (!options.datasetKeys || options.datasetKeys.size === 0) {
      return true;
    }

    return options.datasetKeys.has(dataset.key);
  });

  const tokenState: AccessTokenState = {
    value: await getAccessToken(),
  };
  const results: DatasetResult[] = [];
  const summaryPath = path.join(options.outDir, "bc-export-summary.json");

  const writeSummary = async () => {
    const summary = {
      exportedAt: new Date().toISOString(),
      company: requireEnv("METRO_BC_COMPANY"),
      environment: requireEnv("METRO_BC_ENVIRONMENT"),
      pageSize: options.pageSize,
      maxPages: options.maxPages,
      selectedDatasets: selectedDatasets.map((dataset) => dataset.key),
      results,
    };

    await writeFile(summaryPath, JSON.stringify(summary, null, 2), "utf8");
  };

  for (const dataset of selectedDatasets) {
    console.log(`Starting dataset ${dataset.key}...`);
    if (dataset.kind === "api-root") {
      results.push(await exportApiRoot(tokenState, options.outDir));
      await writeSummary();
      continue;
    }

    results.push(await exportODataDataset(tokenState, dataset, options));
    await writeSummary();
  }

  const exported = results.filter((result) => result.status === "exported");
  const blocked = results.filter((result) => result.status === "blocked");
  const failed = results.filter((result) => result.status === "failed");
  const missing = results.filter((result) => result.status === "missing");

  console.log(
    JSON.stringify(
      {
        summaryPath,
        exported: exported.map((result) => ({
          key: result.key,
          records: result.records,
          pages: result.pages,
          csvPath: result.csvPath,
        })),
        blocked: blocked.map((result) => ({
          key: result.key,
          httpStatus: result.httpStatus,
          error: result.error,
        })),
        missing: missing.map((result) => ({
          key: result.key,
          httpStatus: result.httpStatus,
          error: result.error,
        })),
        failed: failed.map((result) => ({
          key: result.key,
          httpStatus: result.httpStatus,
          error: result.error,
        })),
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
});

import "dotenv/config";

import { Pool } from "pg";

type Row = Record<string, unknown>;

type DatasetConfig = {
  key: string;
  serviceName: string;
  tableName: string;
  description: string;
  map: (row: Row, runId: string) => Row | null;
};

type Options = {
  datasets: string[];
  pageSize: number;
  maxPages: number | null;
  resume: boolean;
};

const API_BASE_URL = "https://api.businesscentral.dynamics.com/v2.0";
const DEFAULT_DATASETS = [
  "chart-of-accounts",
  "dimension-sets",
  "dimension-set-entries",
  "posted-rental-invoice",
  "posted-rental-header",
  "posted-rental-line",
  "rental-ledger-entries",
  "ws-rental-ledger-entries",
  "customer-ledger-entries",
  "gl-entries",
] as const;

const DATASETS: DatasetConfig[] = [
  {
    key: "posted-rental-invoice",
    serviceName: "Posted_Rental_Invoice_Excel",
    tableName: "bc_rmi_posted_rental_invoice_headers",
    description: "RMI posted rental invoice headers.",
    map: (row, runId) => {
      const documentNo = text(row, "No");
      const documentType = textAny(row, ["Document_Type", "DocumentType"]) || "Posted Invoice";
      if (!documentNo) return null;
      return {
        id: `bcrih:${documentType}:${documentNo}`,
        run_id: runId,
        document_type: documentType,
        document_no: documentNo,
        previous_doc_type: text(row, "PreviousDocType"),
        previous_no: text(row, "PreviousNo"),
        sell_to_customer_no: text(row, "SelltoCustomerNo"),
        bill_to_customer_no: text(row, "BilltoCustomerNo"),
        posting_date: dateText(row, "PostingDate"),
        document_date: dateText(row, "DocumentDate"),
        due_date: dateText(row, "DueDate"),
        location_code: text(row, "LocationCode"),
        responsibility_center: text(row, "ResponsibilityCenter"),
        shortcut_dimension1_code: text(row, "ShortcutDimension1Code"),
        shortcut_dimension2_code: text(row, "ShortcutDimension2Code"),
        external_document_no: text(row, "ExternalDocumentNo"),
        source_payload: row,
        imported_at: new Date(),
      };
    },
  },
  {
    key: "posted-rental-header",
    serviceName: "WSPostedRentalHeader",
    tableName: "bc_rmi_posted_rental_headers",
    description: "RMI posted rental headers.",
    map: (row, runId) => {
      const documentNo = textAny(row, ["No", "DocumentNo"]);
      const documentType = textAny(row, ["DocumentType", "Document_Type"]) || "Posted Invoice";
      if (!documentNo) return null;
      return {
        id: `bcrmih:${documentType}:${documentNo}`,
        run_id: runId,
        external_id: text(row, "id"),
        document_type: documentType,
        document_no: documentNo,
        previous_doc_type: text(row, "PreviousDocType"),
        previous_no: text(row, "PreviousNo"),
        sell_to_customer_no: text(row, "SelltoCustomerNo"),
        bill_to_customer_no: text(row, "BilltoCustomerNo"),
        ship_to_code: text(row, "ShiptoCode"),
        posting_date: dateText(row, "PostingDate"),
        order_date: dateText(row, "OrderDate"),
        select_thru_date: dateText(row, "SelectThruDate"),
        document_date: dateText(row, "DocumentDate"),
        due_date: dateText(row, "DueDate"),
        shipment_date: dateText(row, "ShipmentDate"),
        return_date: dateText(row, "ReturnDate"),
        location_code: text(row, "LocationCode"),
        responsibility_center: text(row, "ResponsibilityCenter"),
        shortcut_dimension1_code: text(row, "ShortcutDimension1Code"),
        shortcut_dimension2_code: text(row, "ShortcutDimension2Code"),
        status: text(row, "Status"),
        source_code: text(row, "SourceCode"),
        external_document_no: text(row, "ExternalDocumentNo"),
        dimension_set_id: integer(row, "DimensionSetID"),
        source_payload: row,
        imported_at: new Date(),
      };
    },
  },
  {
    key: "posted-rental-line",
    serviceName: "WSPostedRentalLine",
    tableName: "bc_rmi_posted_rental_lines",
    description: "RMI posted rental lines.",
    map: (row, runId) => {
      const documentNo = text(row, "DocumentNo");
      const documentType = text(row, "DocumentType") || "Posted Invoice";
      const lineNo = integer(row, "LineNo");
      if (!documentNo || lineNo === null) return null;
      return {
        id: `bcrmil:${documentType}:${documentNo}:${lineNo}`,
        run_id: runId,
        external_id: text(row, "id"),
        document_type: documentType,
        document_no: documentNo,
        line_no: lineNo,
        sequence_no: integer(row, "SequenceNo"),
        line_type: text(row, "LineType"),
        type: text(row, "Type"),
        item_no: text(row, "No"),
        description: text(row, "Description"),
        quantity: numeric(row, "Quantity"),
        unit_of_measure_code: text(row, "UnitOfMeasureCode"),
        unit_price: numeric(row, "UnitPrice"),
        gross_amount: numeric(row, "GrossAmount"),
        gross_amount_lcy: numeric(row, "GrossAmountLCY"),
        line_discount_amount: numeric(row, "LineDiscountAmount"),
        invoice_discount_amount: numeric(row, "InvoiceDiscountAmount"),
        tax_amount: numeric(row, "TaxAmount"),
        damage_waiver_amount: numeric(row, "DamageWaiverAmount"),
        from_date: dateText(row, "FromDate"),
        thru_date: dateText(row, "ThruDate"),
        invoice_from_date: dateText(row, "InvoiceFromDate"),
        invoice_thru_date: dateText(row, "InvoiceThruDate") || dateText(row, "InvoicedThruDate"),
        shipment_date: dateText(row, "ShipmentDate"),
        return_date: dateText(row, "ReturnDate"),
        posting_date: dateText(row, "PostingDate") || dateText(row, "FAPostingDate"),
        previous_doc_type: text(row, "PreviousDocType"),
        previous_no: text(row, "PreviousNo"),
        deal_code: text(row, "DealCode"),
        deal_length: numeric(row, "DealLength"),
        billing_for: text(row, "BillingFor"),
        location_code: text(row, "LocationCode"),
        shortcut_dimension1_code: text(row, "ShortcutDimension1Code"),
        shortcut_dimension2_code: text(row, "ShortcutDimension2Code"),
        tax_group_code: text(row, "TaxGroupCode"),
        dimension_set_id: integer(row, "DimensionSetID"),
        source_payload: row,
        imported_at: new Date(),
      };
    },
  },
  {
    key: "rental-ledger-entries",
    serviceName: "RentalLedgerEntries",
    tableName: "bc_rmi_rental_ledger_entries",
    description: "RMI rental ledger entries.",
    map: (row, runId) => mapRentalLedger(row, runId, "bcrle"),
  },
  {
    key: "ws-rental-ledger-entries",
    serviceName: "WSRentalLedgerEntries",
    tableName: "bc_rmi_ws_rental_ledger_entries",
    description: "RMI WS rental ledger entries with order/deal metadata.",
    map: (row, runId) => mapRentalLedger(row, runId, "bcwsrle"),
  },
  {
    key: "customer-ledger-entries",
    serviceName: "CustomerLedgerEntries",
    tableName: "bc_customer_ledger_entries",
    description: "Business Central customer ledger entries.",
    map: (row) => {
      const entryNo = entryNoText(row);
      if (!entryNo) return null;
      return {
        id: `bccustled:${entryNo}`,
        external_entry_no: entryNo,
        customer_no: text(row, "Customer_No"),
        posting_date: dateText(row, "Posting_Date"),
        document_no: text(row, "Document_No"),
        amount: numericAny(row, ["Amount", "Amount_LCY"]),
        payload: row,
        imported_at: new Date(),
      };
    },
  },
  {
    key: "gl-entries",
    serviceName: "G_LEntries",
    tableName: "bc_gl_entries",
    description: "Business Central general ledger entries.",
    map: (row) => {
      const entryNo = entryNoText(row);
      if (!entryNo) return null;
      const dimensionSetId = textAny(row, ["Dimension_Set_ID", "DimensionSetID"]);
      return {
        id: `bcgle:${entryNo}`,
        external_entry_no: entryNo,
        posting_date: dateText(row, "Posting_Date"),
        document_no: text(row, "Document_No"),
        description: text(row, "Description"),
        account_no: text(row, "G_L_Account_No"),
        amount: numeric(row, "Amount"),
        debit_amount: numeric(row, "Debit_Amount"),
        credit_amount: numeric(row, "Credit_Amount"),
        dimension_set_id: dimensionSetId ? `bcdset:${dimensionSetId}` : null,
        payload: row,
        imported_at: new Date(),
      };
    },
  },
  {
    key: "chart-of-accounts",
    serviceName: "Chart_of_Accounts",
    tableName: "bc_gl_accounts",
    description: "Business Central chart of accounts.",
    map: (row) => {
      const accountNo = text(row, "No");
      if (!accountNo) return null;
      return {
        id: `bcgla:${accountNo}`,
        account_no: accountNo,
        name: text(row, "Name") || accountNo,
        account_type: text(row, "Account_Type"),
        income_balance: text(row, "Income_Balance"),
        category: text(row, "Account_Category"),
        subcategory: text(row, "Account_Subcategory_Descript"),
        blocked: bool(row, "Blocked") ?? false,
        payload: row,
        imported_at: new Date(),
      };
    },
  },
  {
    key: "dimension-sets",
    serviceName: "DimensionSets",
    tableName: "bc_dimension_sets",
    description: "Business Central dimension set headers.",
    map: (row) => {
      const dimensionSetId = text(row, "Dimension_Set_ID");
      if (!dimensionSetId) return null;
      return {
        id: `bcdset:${dimensionSetId}`,
        external_dimension_set_id: dimensionSetId,
        payload: row,
        imported_at: new Date(),
      };
    },
  },
  {
    key: "dimension-set-entries",
    serviceName: "DimensionSetEntries",
    tableName: "bc_dimension_set_entries",
    description: "Business Central dimension set entries.",
    map: (row) => {
      const dimensionSetId = text(row, "Dimension_Set_ID");
      const dimensionCode = text(row, "Dimension_Code");
      const dimensionValueCode = text(row, "Dimension_Value_Code");
      if (!dimensionSetId || !dimensionCode || !dimensionValueCode) return null;
      return {
        id: `bcdset:${dimensionSetId}:${dimensionCode}:${dimensionValueCode}`,
        dimension_set_id: `bcdset:${dimensionSetId}`,
        dimension_code: dimensionCode,
        dimension_value_code: dimensionValueCode,
        payload: row,
        imported_at: new Date(),
      };
    },
  },
];

function mapRentalLedger(row: Row, runId: string, idPrefix: string) {
  const entryNo = entryNoText(row);
  if (!entryNo) return null;
  return {
    id: `${idPrefix}:${entryNo}`,
    run_id: runId,
    external_entry_no: entryNo,
    document_type: text(row, "DocumentType"),
    document_no: text(row, "DocumentNo"),
    order_no: text(row, "OrderNo"),
    posting_date: dateText(row, "PostingDate"),
    bill_to_customer_no: text(row, "BilltoCustomerNo"),
    type_ordered: text(row, "TypeOrdered"),
    no_ordered: text(row, "NoOrdered"),
    type_shipped: text(row, "TypeShipped"),
    no_shipped: text(row, "NoShipped"),
    serial_no_shipped: text(row, "SerialNoShipped"),
    quantity: numeric(row, "Quantity"),
    from_date: dateText(row, "FromDate"),
    thru_date: dateText(row, "ThruDate"),
    rental_days: numeric(row, "RentalDays"),
    unit_price: numeric(row, "UnitPrice"),
    gross_amount: numeric(row, "GrossAmount"),
    gross_amount_lcy: numeric(row, "GrossAmountLCY"),
    line_discount_amount: numeric(row, "LineDiscountAmount"),
    invoice_discount_amount: numeric(row, "InvoiceDiscountAmount"),
    deal_code: text(row, "DealCode"),
    shortcut_dimension1_code: text(row, "ShortcutDimension1Code"),
    shortcut_dimension2_code: text(row, "ShortcutDimension2Code"),
    source_payload: row,
    imported_at: new Date(),
  };
}

function parseArgs(argv: string[]): Options {
  const options: Options = {
    datasets: [...DEFAULT_DATASETS],
    pageSize: 1000,
    maxPages: null,
    resume: true,
  };

  for (const arg of argv) {
    if (arg.startsWith("--datasets=")) {
      const raw = arg.slice("--datasets=".length).trim();
      options.datasets =
        raw === "all"
          ? [...DEFAULT_DATASETS]
          : raw.split(",").map((part) => part.trim()).filter(Boolean);
      continue;
    }
    if (arg.startsWith("--page-size=")) {
      options.pageSize = positiveInt(arg.slice("--page-size=".length), "--page-size");
      continue;
    }
    if (arg.startsWith("--max-pages=")) {
      options.maxPages = positiveInt(arg.slice("--max-pages=".length), "--max-pages");
      continue;
    }
    if (arg === "--no-resume") {
      options.resume = false;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const pool = new Pool({
    connectionString: normalizePostgresConnectionString(requireEnv("DATABASE_URL")),
    max: Number(process.env.DATABASE_POOL_MAX || 2),
  });

  try {
    const tokenState = { value: await getAccessToken() };
    const selected = options.datasets.map((key) => {
      const dataset = DATASETS.find((candidate) => candidate.key === key);
      if (!dataset) throw new Error(`Unknown BC raw dataset: ${key}`);
      return dataset;
    });

    for (const dataset of selected) {
      await seedDataset(pool, tokenState, dataset, options);
    }
  } finally {
    await pool.end();
  }
}

async function seedDataset(
  pool: Pool,
  tokenState: { value: string },
  dataset: DatasetConfig,
  options: Options,
) {
  const runId = `bcraw_${dataset.key}_${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}`;
  const checkpointId = `bcraw:${dataset.key}`;
  const company = requireEnv("METRO_BC_COMPANY");
  const total = await fetchODataCount(tokenState, dataset.serviceName, company);

  await pool.query(
    `insert into bc_import_runs (id, provider, entity_type, status, started_at, records_seen, records_inserted, records_updated, records_skipped, records_failed, job_version, metadata)
     values ($1, 'business_central', $2, 'running', now(), 0, 0, 0, 0, 0, $3, $4)
     on conflict (id) do update set status = 'running', started_at = now(), metadata = excluded.metadata`,
    [runId, `raw:${dataset.key}`, "bc-seed-raw-history:v1", JSON.stringify({ total, serviceName: dataset.serviceName })],
  );

  const checkpoint = options.resume
    ? await loadCheckpoint(pool, checkpointId, dataset.serviceName, options.pageSize)
    : null;

  let nextUrl =
    checkpoint?.nextUrl ??
    buildODataCollectionUrl(dataset.serviceName, options.pageSize, company, 0);
  let pageNumber = checkpoint?.pageNumber ?? 0;
  let recordsSeen = checkpoint?.recordsSeen ?? 0;
  let recordsInserted = 0;

  console.log(
    `[${dataset.key}] starting at page ${pageNumber}, seen ${recordsSeen}/${total ?? "unknown"}`,
  );

  while (nextUrl) {
    const page = await fetchJsonWithRefresh(nextUrl, tokenState);
    const sourceRows = normalizeRows(page.value);
    const mappedRows = sourceRows
      .map((row) => dataset.map(row, runId))
      .filter((row): row is Row => Boolean(row));

    if (mappedRows.length > 0) {
      await bulkUpsert(pool, dataset.tableName, mappedRows);
    }

    pageNumber += 1;
    recordsSeen += sourceRows.length;
    recordsInserted += mappedRows.length;

    const odataNext = page["@odata.nextLink"];
    if (typeof odataNext === "string" && odataNext.trim()) {
      nextUrl = odataNext;
    } else if (sourceRows.length === options.pageSize) {
      nextUrl = buildODataCollectionUrl(
        dataset.serviceName,
        options.pageSize,
        company,
        pageNumber * options.pageSize,
      );
    } else {
      nextUrl = "";
    }

    const stoppedAtPageLimit =
      options.maxPages !== null && pageNumber >= (checkpoint?.pageNumber ?? 0) + options.maxPages && Boolean(nextUrl);
    if (stoppedAtPageLimit) {
      nextUrl = "";
    }

    await saveCheckpoint(pool, {
      id: checkpointId,
      runId,
      entityType: `raw:${dataset.key}`,
      serviceName: dataset.serviceName,
      pageSize: options.pageSize,
      pageNumber,
      nextUrl,
      recordsSeen,
      total,
      done: !nextUrl && !stoppedAtPageLimit,
    });
    await pool.query(
      `update bc_import_runs set records_seen = $2, records_inserted = $3, metadata = coalesce(metadata, '{}'::jsonb) || $4::jsonb where id = $1`,
      [runId, recordsSeen, recordsInserted, JSON.stringify({ total, pageNumber })],
    );

    console.log(
      `[${dataset.key}] page ${pageNumber}, seen ${recordsSeen}/${total ?? "unknown"}, upserted ${recordsInserted}`,
    );
  }

  await pool.query(
    `update bc_import_runs set status = 'succeeded', finished_at = now(), records_seen = $2, records_inserted = $3, metadata = coalesce(metadata, '{}'::jsonb) || $4::jsonb where id = $1`,
    [runId, recordsSeen, recordsInserted, JSON.stringify({ total, completedAt: new Date().toISOString() })],
  );
}

async function loadCheckpoint(
  pool: Pool,
  id: string,
  serviceName: string,
  pageSize: number,
) {
  const result = await pool.query<{
    page_number: number;
    cursor: string | null;
    checkpoint_data: { serviceName?: string; pageSize?: number; recordsSeen?: number; done?: boolean } | null;
  }>(
    `select page_number, cursor, checkpoint_data from bc_import_checkpoints where id = $1`,
    [id],
  );
  const row = result.rows[0];
  if (!row || row.checkpoint_data?.done) return null;
  if (row.checkpoint_data?.serviceName !== serviceName || row.checkpoint_data?.pageSize !== pageSize) {
    return null;
  }
  return {
    pageNumber: row.page_number,
    nextUrl: row.cursor || null,
    recordsSeen: Number(row.checkpoint_data?.recordsSeen ?? 0),
  };
}

async function saveCheckpoint(
  pool: Pool,
  input: {
    id: string;
    runId: string;
    entityType: string;
    serviceName: string;
    pageSize: number;
    pageNumber: number;
    nextUrl: string;
    recordsSeen: number;
    total: number | null;
    done: boolean;
  },
) {
  await pool.query(
    `insert into bc_import_checkpoints (id, entity_type, run_id, cursor, page_number, checkpoint_data, updated_at)
     values ($1, $2, $3, $4, $5, $6, now())
     on conflict (id) do update set run_id = excluded.run_id, cursor = excluded.cursor, page_number = excluded.page_number, checkpoint_data = excluded.checkpoint_data, updated_at = now()`,
    [
      input.id,
      input.entityType,
      input.runId,
      input.nextUrl || null,
      input.pageNumber,
      JSON.stringify({
        recordsSeen: input.recordsSeen,
        total: input.total,
        done: input.done,
        serviceName: input.serviceName,
        pageSize: input.pageSize,
      }),
    ],
  );
}

async function bulkUpsert(pool: Pool, tableName: string, rows: Row[]) {
  const columns = Object.keys(rows[0]);
  const values: unknown[] = [];
  const tuples = rows.map((row, rowIndex) => {
    const placeholders = columns.map((column, columnIndex) => {
      values.push(row[column]);
      return `$${rowIndex * columns.length + columnIndex + 1}`;
    });
    return `(${placeholders.join(", ")})`;
  });
  const updates = columns
    .filter((column) => column !== "id")
    .map((column) => `${quoteIdent(column)} = excluded.${quoteIdent(column)}`)
    .join(", ");

  await pool.query(
    `insert into ${quoteIdent(tableName)} (${columns.map(quoteIdent).join(", ")})
     values ${tuples.join(", ")}
     on conflict (id) do update set ${updates}`,
    values,
  );
}

async function getAccessToken() {
  const tenantId = requireEnv("METRO_GRAPH_TENANT_ID");
  const response = await fetch(
    `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: requireEnv("METRO_GRAPH_CLIENT_ID"),
        client_secret: requireEnv("METRO_GRAPH_CLIENT_SECRET"),
        grant_type: "client_credentials",
        scope: "https://api.businesscentral.dynamics.com/.default",
      }),
    },
  );
  const payload = (await response.json()) as { access_token?: string; error_description?: string };
  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description || `BC authentication failed with HTTP ${response.status}.`);
  }
  return payload.access_token;
}

async function fetchJsonWithRefresh(url: string, tokenState: { value: string }) {
  let response = await fetch(url, {
    headers: { Authorization: `Bearer ${tokenState.value}`, Accept: "application/json" },
  });
  if (response.status === 401) {
    tokenState.value = await getAccessToken();
    response = await fetch(url, {
      headers: { Authorization: `Bearer ${tokenState.value}`, Accept: "application/json" },
    });
  }
  const textBody = await response.text();
  if (!response.ok) {
    throw new Error(`BC request failed ${response.status}: ${textBody.slice(0, 500)}`);
  }
  return JSON.parse(textBody) as Record<string, unknown>;
}

async function fetchODataCount(tokenState: { value: string }, serviceName: string, company: string) {
  const url = `${getODataRootUrl()}/${serviceName}/$count?company=${encodeURIComponent(company)}`;
  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${tokenState.value}`, Accept: "application/json" },
    });
    if (!response.ok) return null;
    const body = await response.text();
    const parsed = Number.parseInt(body, 10);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function getODataRootUrl() {
  return `${API_BASE_URL}/${encodeURIComponent(requireEnv("METRO_GRAPH_TENANT_ID"))}/${encodeURIComponent(requireEnv("METRO_BC_ENVIRONMENT"))}/ODataV4`;
}

function buildODataCollectionUrl(serviceName: string, pageSize: number, company: string, skip: number) {
  const url = new URL(`${getODataRootUrl()}/${serviceName}`);
  url.searchParams.set("company", company);
  url.searchParams.set("$top", String(pageSize));
  if (skip > 0) url.searchParams.set("$skip", String(skip));
  return url.toString();
}

function normalizeRows(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is Row => Boolean(entry) && typeof entry === "object")
    : [];
}

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function normalizePostgresConnectionString(connectionString: string) {
  const url = new URL(connectionString);
  if (url.searchParams.get("sslrootcert") === "system") url.searchParams.delete("sslrootcert");
  return url.toString();
}

function positiveInt(value: string, flag: string) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${flag} must be a positive integer.`);
  return parsed;
}

function quoteIdent(identifier: string) {
  return `"${identifier.replace(/"/g, '""')}"`;
}

function text(row: Row, key: string) {
  const value = row[key];
  if (value === null || value === undefined) return null;
  return String(value).replace(/\u0000/g, "").trim() || null;
}

function textAny(row: Row, keys: string[]) {
  for (const key of keys) {
    const value = text(row, key);
    if (value) return value;
  }
  return null;
}

function entryNoText(row: Row) {
  return textAny(row, ["EntryNo", "Entry_No"]);
}

function numeric(row: Row, key: string) {
  const value = row[key];
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string" && value.trim()) return value.trim();
  return null;
}

function numericAny(row: Row, keys: string[]) {
  for (const key of keys) {
    const value = numeric(row, key);
    if (value !== null) return value;
  }
  return null;
}

function integer(row: Row, key: string) {
  const value = row[key];
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseInt(value.trim(), 10);
    return Number.isInteger(parsed) ? parsed : null;
  }
  return null;
}

function dateText(row: Row, key: string) {
  const value = text(row, key);
  if (!value || value === "0001-01-01" || value === "0001-01-01T00:00:00Z") return null;
  return value;
}

function bool(row: Row, key: string) {
  const value = row[key];
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "yes", "1"].includes(normalized)) return true;
    if (["false", "no", "0"].includes(normalized)) return false;
  }
  return null;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});

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
  concurrency: number;
  maxRetries: number;
  retryBaseDelayMs: number;
  retryMaxDelayMs: number;
};

const API_BASE_URL = "https://api.businesscentral.dynamics.com/v2.0";
const DEFAULT_DATASETS = [
  "customer-card",
  "chart-of-accounts",
  "dimension-sets",
  "dimension-set-entries",
  "posted-rental-invoice",
  "posted-rental-header",
  "posted-rental-line",
  "ws-rental-ledger-entries",
  "customer-ledger-entries",
  "gl-entries",
] as const;

const DATASETS: DatasetConfig[] = [
  {
    key: "customer-card",
    serviceName: "CustomerCard",
    tableName: "bc_customer_cards",
    description: "Business Central customer card records with RMI customer metadata.",
    map: (row, runId) => {
      const customerNo = text(row, "No");
      if (!customerNo) return null;
      return {
        id: `bccustcard:${customerNo}`,
        run_id: runId,
        customer_no: customerNo,
        name: text(row, "Name") || "Unknown Customer",
        customer_type: text(row, "Customer_Type"),
        parent_no: text(row, "Parent_No"),
        parent_name: text(row, "Parent_Name"),
        blocked: text(row, "Blocked"),
        responsibility_center: text(row, "Responsibility_Center"),
        salesperson_code: text(row, "Salesperson_Code"),
        default_sales_team: text(row, "RMI_Default_Sales_Team"),
        default_deal_code: text(row, "RMI_Default_Deal_Code"),
        damage_waiver_declined: bool(row, "RMI_Damage_Waiver_Declined"),
        insurance_cert_required: bool(row, "RMI_Insurance_Cert_Required"),
        insurance_expiration_date: dateText(row, "RMI_Insurance_Expiration_Date"),
        insurance_policy_no: text(row, "RMI_Insurance_Policy_No"),
        registration_number: text(row, "Registration_Number"),
        balance_lcy: numeric(row, "Balance_LCY"),
        balance_due_lcy: numeric(row, "Balance_Due_LCY"),
        credit_limit_lcy: numeric(row, "Credit_Limit_LCY"),
        source_payload: row,
        imported_at: new Date(),
      };
    },
  },
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
    concurrency: positiveInt(process.env.BC_RAW_HISTORY_CONCURRENCY || "1", "BC_RAW_HISTORY_CONCURRENCY"),
    maxRetries: positiveInt(process.env.BC_RAW_HISTORY_MAX_RETRIES || "8", "BC_RAW_HISTORY_MAX_RETRIES"),
    retryBaseDelayMs: positiveInt(process.env.BC_RAW_HISTORY_RETRY_BASE_DELAY_MS || "2000", "BC_RAW_HISTORY_RETRY_BASE_DELAY_MS"),
    retryMaxDelayMs: positiveInt(process.env.BC_RAW_HISTORY_RETRY_MAX_DELAY_MS || "120000", "BC_RAW_HISTORY_RETRY_MAX_DELAY_MS"),
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
    if (arg.startsWith("--concurrency=")) {
      options.concurrency = positiveInt(arg.slice("--concurrency=".length), "--concurrency");
      continue;
    }
    if (arg.startsWith("--max-retries=")) {
      options.maxRetries = positiveInt(arg.slice("--max-retries=".length), "--max-retries");
      continue;
    }
    if (arg.startsWith("--retry-base-delay-ms=")) {
      options.retryBaseDelayMs = positiveInt(arg.slice("--retry-base-delay-ms=".length), "--retry-base-delay-ms");
      continue;
    }
    if (arg.startsWith("--retry-max-delay-ms=")) {
      options.retryMaxDelayMs = positiveInt(arg.slice("--retry-max-delay-ms=".length), "--retry-max-delay-ms");
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
    max: Math.max(Number(process.env.DATABASE_POOL_MAX || 2), options.concurrency + 1),
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
    [
      runId,
      `raw:${dataset.key}`,
      "bc-seed-raw-history:v2",
      JSON.stringify({
        total,
        serviceName: dataset.serviceName,
        concurrency: options.concurrency,
        maxRetries: options.maxRetries,
      }),
    ],
  );

  const checkpoint = options.resume
    ? await loadCheckpoint(pool, checkpointId, dataset.serviceName, options.pageSize)
    : null;

  if (checkpoint?.done) {
    console.log(
      `[${dataset.key}] already completed, seen ${checkpoint.recordsSeen}/${total ?? "unknown"}; skipping`,
    );
    await pool.query(
      `update bc_import_runs set status = 'succeeded', finished_at = now(), records_seen = $2, records_inserted = 0, metadata = coalesce(metadata, '{}'::jsonb) || $3::jsonb where id = $1`,
      [runId, checkpoint.recordsSeen, JSON.stringify({ total, skippedCompletedCheckpoint: true })],
    );
    return;
  }

  let pageNumber = checkpoint?.pageNumber ?? 0;
  let recordsSeen = checkpoint?.recordsSeen ?? 0;
  let recordsInserted = 0;
  const startedAtPage = pageNumber;
  const totalPages = total === null ? null : Math.ceil(total / options.pageSize);

  console.log(
    `[${dataset.key}] starting at page ${pageNumber}, seen ${recordsSeen}/${total ?? "unknown"}, concurrency ${options.concurrency}`,
  );

  try {
    while (true) {
      const requestedPageLimit =
        options.maxPages === null ? options.concurrency : startedAtPage + options.maxPages - pageNumber;
      const remainingKnownPages = totalPages === null ? options.concurrency : totalPages - pageNumber;
      const batchSize = Math.min(options.concurrency, requestedPageLimit, remainingKnownPages);
      if (batchSize <= 0) break;

      const batchStartPage = pageNumber;
      const batchPageNumbers = Array.from({ length: batchSize }, (_, index) => batchStartPage + index);
      const batchResults = await Promise.all(
        batchPageNumbers.map((currentPageNumber) =>
          processPage(pool, tokenState, dataset, options, company, runId, currentPageNumber),
        ),
      );

      let reachedEnd = false;
      for (const result of batchResults.sort((a, b) => a.pageNumber - b.pageNumber)) {
        pageNumber = result.pageNumber + 1;
        recordsSeen += result.sourceRowCount;
        recordsInserted += result.upsertedRowCount;
        if (result.sourceRowCount < options.pageSize) reachedEnd = true;
        console.log(
          `[${dataset.key}] page ${pageNumber}, seen ${recordsSeen}/${total ?? "unknown"}, upserted ${recordsInserted}`,
        );
      }

      const stoppedAtPageLimit =
        options.maxPages !== null && pageNumber >= startedAtPage + options.maxPages && !reachedEnd;
      const done = reachedEnd || (totalPages !== null && pageNumber >= totalPages);
      const nextUrl = done || stoppedAtPageLimit
        ? ""
        : buildODataCollectionUrl(dataset.serviceName, options.pageSize, company, pageNumber * options.pageSize);
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
        done: done && !stoppedAtPageLimit,
      });
      await pool.query(
        `update bc_import_runs set records_seen = $2, records_inserted = $3, updated_at = now(), metadata = coalesce(metadata, '{}'::jsonb) || $4::jsonb where id = $1`,
        [runId, recordsSeen, recordsInserted, JSON.stringify({ total, pageNumber })],
      );

      if (done || stoppedAtPageLimit) break;
    }

    await pool.query(
      `update bc_import_runs set status = 'succeeded', finished_at = now(), records_seen = $2, records_inserted = $3, updated_at = now(), metadata = coalesce(metadata, '{}'::jsonb) || $4::jsonb where id = $1`,
      [runId, recordsSeen, recordsInserted, JSON.stringify({ total, completedAt: new Date().toISOString() })],
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await pool.query(
      `update bc_import_runs
       set status = 'failed',
           finished_at = now(),
           records_seen = $2,
           records_inserted = $3,
           records_failed = records_failed + 1,
           error_summary = $4,
           updated_at = now(),
           metadata = coalesce(metadata, '{}'::jsonb) || $5::jsonb
       where id = $1`,
      [
        runId,
        recordsSeen,
        recordsInserted,
        message.slice(0, 2048),
        JSON.stringify({ total, pageNumber, failedAt: new Date().toISOString() }),
      ],
    );
    throw error;
  }
}

async function processPage(
  pool: Pool,
  tokenState: { value: string },
  dataset: DatasetConfig,
  options: Options,
  company: string,
  runId: string,
  pageNumber: number,
) {
  const url = buildODataCollectionUrl(dataset.serviceName, options.pageSize, company, pageNumber * options.pageSize);
  const page = await fetchJsonWithRefresh(url, tokenState, options);
  const sourceRows = normalizeRows(page.value);
  const mappedRows = sourceRows
    .map((row) => dataset.map(row, runId))
    .filter((row): row is Row => Boolean(row));
  const dedupedRows = dedupeRowsById(mappedRows);

  if (dedupedRows.length > 0) {
    await bulkUpsert(pool, dataset.tableName, dedupedRows);
  }

  return {
    pageNumber,
    sourceRowCount: sourceRows.length,
    upsertedRowCount: dedupedRows.length,
  };
}

function dedupeRowsById(rows: Row[]) {
  const rowsById = new Map<string, Row>();
  let generatedFallbackIds = 0;
  for (const row of rows) {
    const id = row.id;
    if (typeof id === "string" && id.trim()) {
      rowsById.set(id, row);
      continue;
    }

    generatedFallbackIds += 1;
    rowsById.set(`__missing_id_${generatedFallbackIds}`, row);
  }
  return [...rowsById.values()];
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
  if (!row) return null;
  if (row.checkpoint_data?.serviceName !== serviceName || row.checkpoint_data?.pageSize !== pageSize) {
    return null;
  }
  return {
    pageNumber: row.page_number,
    nextUrl: row.cursor || null,
    recordsSeen: Number(row.checkpoint_data?.recordsSeen ?? 0),
    done: Boolean(row.checkpoint_data?.done),
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

async function fetchJsonWithRefresh(url: string, tokenState: { value: string }, options: Options) {
  let lastError: unknown = null;
  for (let attempt = 0; attempt <= options.maxRetries; attempt += 1) {
    try {
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
      if (response.ok) {
        return JSON.parse(textBody) as Record<string, unknown>;
      }
      if (!isRetryableHttpStatus(response.status) || attempt >= options.maxRetries) {
        throw new Error(`BC request failed ${response.status}: ${textBody.slice(0, 500)}`);
      }
      const retryAfterMs = retryAfterHeaderMs(response.headers.get("retry-after"));
      const delayMs = retryAfterMs ?? computeBackoffMs(attempt, options);
      console.warn(`BC request failed ${response.status}; retrying in ${delayMs}ms (attempt ${attempt + 1}/${options.maxRetries})`);
      await sleep(delayMs);
    } catch (error) {
      lastError = error;
      if (attempt >= options.maxRetries) break;
      const delayMs = computeBackoffMs(attempt, options);
      console.warn(`BC request error; retrying in ${delayMs}ms (attempt ${attempt + 1}/${options.maxRetries}): ${error instanceof Error ? error.message : String(error)}`);
      await sleep(delayMs);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
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

function isRetryableHttpStatus(status: number) {
  return status === 408 || status === 409 || status === 425 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

function retryAfterHeaderMs(value: string | null) {
  if (!value) return null;
  const seconds = Number.parseInt(value, 10);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  const dateMs = Date.parse(value);
  if (Number.isFinite(dateMs)) return Math.max(0, dateMs - Date.now());
  return null;
}

function computeBackoffMs(attempt: number, options: Options) {
  const exponential = options.retryBaseDelayMs * 2 ** attempt;
  const jitter = Math.floor(Math.random() * options.retryBaseDelayMs);
  return Math.min(options.retryMaxDelayMs, exponential + jitter);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

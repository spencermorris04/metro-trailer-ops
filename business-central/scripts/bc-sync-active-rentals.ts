import "dotenv/config";

import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { Pool, type PoolClient } from "pg";

type Row = Record<string, unknown>;

type Options = {
  pageSize: number;
  dryRun: boolean;
};

type Queryable = Pool | PoolClient;

const API_BASE_URL = "https://api.businesscentral.dynamics.com/v2.0";
const BC_SECRET_ID = process.env.BC_SECRET_ID || "metro-trailer/business-central";

function parseArgs(argv: string[]): Options {
  const options: Options = {
    pageSize: positiveInt(process.env.BC_ACTIVE_RENTALS_PAGE_SIZE || "1000", "BC_ACTIVE_RENTALS_PAGE_SIZE"),
    dryRun: false,
  };

  for (const arg of argv) {
    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    if (arg.startsWith("--page-size=")) {
      options.pageSize = positiveInt(arg.slice("--page-size=".length), "--page-size");
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  await loadBusinessCentralSecretIfNeeded();

  const pool = new Pool({
    connectionString: normalizePostgresConnectionString(requireEnv("DATABASE_URL")),
    max: 4,
  });

  const runId = `bcactive_${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}`;
  const tokenState = { value: await getAccessToken() };

  const client = await pool.connect();

  try {
    await createImportRun(pool, runId, options);
    await createTempTables(client);

    const fixedAssetRows = await fetchAllOData(tokenState, "FixedAssetCard", {
      pageSize: options.pageSize,
      select: [
        "No",
        "Description",
        "RMI_On_Rent",
        "RMI_In_Service",
        "Blocked",
        "Inactive",
        "RMI_Disposed",
        "Under_Maintenance",
        "FA_Class_Code",
        "FA_Subclass_Code",
        "FA_Location_Code",
        "RMI_Location_Code",
        "RMI_Global_Dimension_1_Code",
        "RMI_Product_No",
        "RMI_Service_Item_No",
      ],
    });
    const fixedAssetSeeds = fixedAssetRows.map(mapFixedAssetCard).filter((row): row is Row => Boolean(row));
    await bulkInsert(client, "tmp_bc_fixed_asset_cards", fixedAssetSeeds);

    const openShipmentRows = await fetchAllOData(tokenState, "WebPortalShipLedgerEntries", {
      pageSize: options.pageSize,
      filter: "Open eq true and Type eq 'Fixed Asset'",
      select: [
        "Entry_No",
        "PostingDate",
        "TransactionType",
        "Type",
        "No",
        "LocationCode",
        "Quantity",
        "QuantityRemaining",
        "Open",
        "DocumentType",
        "DocumentNo",
        "RentalLineType",
        "SellToCustomerNo",
        "Customer_Type",
        "Parent_No",
        "Sell_to_Customer_Name",
        "ShipToCity",
        "ShipToCounty",
        "ShipToPost",
        "ShipToAddress",
        "Description",
        "ShowOpen",
      ],
    });
    const openShipmentSeeds = openShipmentRows.map((row) => mapWebPortalShipment(row, runId)).filter((row): row is Row => Boolean(row));
    await bulkInsert(client, "tmp_bc_web_portal_ship_ledger_entries", openShipmentSeeds);

    if (options.dryRun) {
      console.log(
        JSON.stringify(
          {
            dryRun: true,
            fixedAssetCards: fixedAssetSeeds.length,
            openShipments: openShipmentSeeds.length,
          },
          null,
          2,
        ),
      );
      await markImportRun(pool, runId, "succeeded", fixedAssetSeeds.length, openShipmentSeeds.length, { dryRun: true });
      return;
    }

    const result = await applyActiveRentalSnapshot(client);
    await markImportRun(pool, runId, "succeeded", fixedAssetSeeds.length, openShipmentSeeds.length, result);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    await markImportRun(pool, runId, "failed", 0, 0, {
      error: error instanceof Error ? error.message : String(error),
    }).catch(() => undefined);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

async function loadBusinessCentralSecretIfNeeded() {
  const requiredNames = [
    "METRO_GRAPH_TENANT_ID",
    "METRO_GRAPH_CLIENT_ID",
    "METRO_GRAPH_CLIENT_SECRET",
    "METRO_BC_ENVIRONMENT",
    "METRO_BC_COMPANY",
  ];
  if (requiredNames.every((name) => process.env[name]?.trim())) {
    return;
  }

  const client = new SecretsManagerClient({ region: process.env.AWS_REGION || "us-east-1" });
  const secret = await client.send(new GetSecretValueCommand({ SecretId: BC_SECRET_ID }));
  const values = JSON.parse(secret.SecretString || "{}") as Record<string, unknown>;
  for (const [key, value] of Object.entries(values)) {
    if (typeof value === "string" && value.trim()) {
      process.env[key] = value;
    }
  }
}

async function createImportRun(pool: Pool, runId: string, options: Options) {
  await pool.query(
    `insert into bc_import_runs (
       id,
       provider,
       entity_type,
       status,
       started_at,
       records_seen,
       records_inserted,
       records_updated,
       records_skipped,
       records_failed,
       job_version,
       metadata
     )
     values ($1, 'business_central', 'active_rental_snapshot', 'running', now(), 0, 0, 0, 0, 0, 'bc-sync-active-rentals:v1', $2::jsonb)`,
    [runId, JSON.stringify({ pageSize: options.pageSize, dryRun: options.dryRun })],
  );
}

async function markImportRun(
  pool: Pool,
  runId: string,
  status: "succeeded" | "failed",
  recordsSeen: number,
  recordsInserted: number,
  metadata: Record<string, unknown>,
) {
  await pool.query(
    `update bc_import_runs
     set status = $2::bc_import_run_status,
         finished_at = now(),
         records_seen = $3,
         records_inserted = $4,
         error_summary = case when $2::text = 'failed' then left(coalesce($5::jsonb->>'error', ''), 2048) else null end,
         metadata = coalesce(metadata, '{}'::jsonb) || $5::jsonb,
         updated_at = now()
     where id = $1`,
    [runId, status, recordsSeen, recordsInserted, JSON.stringify(metadata)],
  );
}

async function createTempTables(pool: Queryable) {
  await pool.query(`
    create temp table tmp_bc_fixed_asset_cards (
      asset_number text primary key,
      is_on_rent boolean not null,
      is_in_service boolean not null,
      is_blocked boolean not null,
      is_inactive boolean not null,
      is_disposed boolean not null,
      under_maintenance boolean not null,
      fa_class_code text,
      fa_subclass_code text,
      bc_location_code text,
      bc_dimension1_code text,
      bc_product_no text,
      bc_service_item_no text,
      source_payload jsonb not null
    ) on commit preserve rows
  `);

  await pool.query(`
    create temp table tmp_bc_web_portal_ship_ledger_entries
      (like bc_web_portal_ship_ledger_entries including defaults)
      on commit preserve rows
  `);
}

async function applyActiveRentalSnapshot(client: PoolClient) {
  try {
    await client.query("begin");
    const branchInsert = await client.query(`
        insert into branches (
          id,
          code,
          name,
          address,
          created_at,
          updated_at
        )
        select
          'branch_' || substr(md5(code || clock_timestamp()::text || random()::text), 1, 12),
          code,
          code,
          '{}'::jsonb,
          now(),
          now()
        from (
          select distinct coalesce(nullif(bc_location_code, ''), 'UNASSIGNED') as code
          from tmp_bc_fixed_asset_cards
        ) source
        where not exists (
          select 1
          from branches b
          where b.code = source.code
        )
      `);

    const assetUpdate = await client.query(`
        update assets a
        set is_on_rent = t.is_on_rent,
            is_in_service = t.is_in_service,
            is_blocked = t.is_blocked,
            is_inactive = t.is_inactive,
            is_disposed = t.is_disposed,
            under_maintenance = t.under_maintenance,
            status = case
              when t.is_disposed or t.is_inactive then 'retired'::asset_status
              when t.under_maintenance then 'in_maintenance'::asset_status
              when t.is_on_rent then 'on_rent'::asset_status
              else 'available'::asset_status
            end,
            availability = case
              when t.is_disposed or t.is_inactive or t.under_maintenance then 'unavailable'::asset_availability
              when t.is_on_rent then 'limited'::asset_availability
              else 'rentable'::asset_availability
            end,
            fa_class_code = coalesce(t.fa_class_code, a.fa_class_code),
            fa_subclass_code = coalesce(t.fa_subclass_code, a.fa_subclass_code),
            bc_location_code = coalesce(t.bc_location_code, a.bc_location_code),
            bc_dimension1_code = coalesce(t.bc_dimension1_code, a.bc_dimension1_code),
            bc_product_no = coalesce(t.bc_product_no, a.bc_product_no),
            bc_service_item_no = nullif(coalesce(t.bc_service_item_no, a.bc_service_item_no, ''), ''),
            branch_id = coalesce(b.id, a.branch_id),
            source_payload = jsonb_set(coalesce(a.source_payload, '{}'::jsonb), '{fixedAssetCard}', t.source_payload, true),
            updated_at = now()
        from tmp_bc_fixed_asset_cards t
        left join branches b
          on b.code = coalesce(nullif(t.bc_location_code, ''), 'UNASSIGNED')
        where a.asset_number = t.asset_number
      `);

    const missingAssetInsert = await client.query(`
        insert into assets (
          id,
          asset_number,
          branch_id,
          type,
          subtype,
          status,
          availability,
          maintenance_status,
          fa_class_code,
          fa_subclass_code,
          bc_location_code,
          bc_dimension1_code,
          bc_product_no,
          bc_service_item_no,
          is_blocked,
          is_inactive,
          is_disposed,
          is_on_rent,
          is_in_service,
          under_maintenance,
          source_payload,
          created_at,
          updated_at
        )
        select
          'asset_' || substr(md5(t.asset_number || clock_timestamp()::text || random()::text), 1, 12),
          t.asset_number,
          b.id,
          case
            when upper(coalesce(t.fa_class_code, '')) like '%ROAD TRL%' then 'road_trailer'::asset_type
            when upper(coalesce(t.fa_class_code, '')) like '%CARTAG%' then 'cartage_trailer'::asset_type
            when upper(coalesce(t.fa_class_code, '')) like '%STORAG TRL%' then 'storage_trailer'::asset_type
            when upper(coalesce(t.fa_class_code, '')) like '%STORAGE CO%' then 'storage_container'::asset_type
            when upper(coalesce(t.fa_class_code, '')) like '%FLATBD%' then 'flatbed_trailer'::asset_type
            when upper(coalesce(t.fa_class_code, '')) like '%OFFICE%' then 'office_trailer'::asset_type
            when upper(coalesce(t.fa_class_code, '')) like '%REEFER%' then 'reefer_trailer'::asset_type
            when upper(coalesce(t.fa_class_code, '')) like '%YARD TRUCK%' then 'yard_truck'::asset_type
            when upper(coalesce(t.fa_class_code, '')) like '%CHASSIS%' then 'chassis'::asset_type
            else 'specialty_trailer'::asset_type
          end,
          t.fa_subclass_code,
          case
            when t.is_disposed or t.is_inactive then 'retired'::asset_status
            when t.under_maintenance then 'in_maintenance'::asset_status
            when t.is_on_rent then 'on_rent'::asset_status
            else 'available'::asset_status
          end,
          case
            when t.is_disposed or t.is_inactive or t.under_maintenance then 'unavailable'::asset_availability
            when t.is_on_rent then 'limited'::asset_availability
            else 'rentable'::asset_availability
          end,
          'clear'::maintenance_status,
          t.fa_class_code,
          t.fa_subclass_code,
          t.bc_location_code,
          t.bc_dimension1_code,
          t.bc_product_no,
          t.bc_service_item_no,
          t.is_blocked,
          t.is_inactive,
          t.is_disposed,
          t.is_on_rent,
          t.is_in_service,
          t.under_maintenance,
          jsonb_build_object('fixedAssetCard', t.source_payload),
          now(),
          now()
        from tmp_bc_fixed_asset_cards t
        join branches b
          on b.code = coalesce(nullif(t.bc_location_code, ''), 'UNASSIGNED')
        left join assets a
          on a.asset_number = t.asset_number
        where a.id is null
      `);

    const mappingUpsert = await client.query(`
        insert into external_entity_mappings (
          id,
          provider,
          entity_type,
          internal_id,
          external_id,
          payload,
          created_at,
          updated_at
        )
        select
          'map_' || substr(md5(a.id || t.asset_number || clock_timestamp()::text || random()::text), 1, 12),
          'business_central'::integration_provider,
          'bc_asset',
          a.id,
          t.asset_number,
          jsonb_build_object('fixedAssetCard', t.source_payload),
          now(),
          now()
        from tmp_bc_fixed_asset_cards t
        join assets a
          on a.asset_number = t.asset_number
        on conflict (provider, entity_type, external_id) do update
        set internal_id = excluded.internal_id,
            payload = excluded.payload,
            updated_at = now()
      `);

    const staleOnRent = await client.query(`
        update assets a
        set is_on_rent = false,
            status = case when a.status = 'on_rent' then 'available'::asset_status else a.status end,
            availability = case when a.status = 'on_rent' then 'rentable'::asset_availability else a.availability end,
            updated_at = now()
        where a.is_on_rent = true
          and not exists (
            select 1 from tmp_bc_fixed_asset_cards t
            where t.asset_number = a.asset_number
              and t.is_on_rent = true
          )
      `);

    await client.query("delete from bc_web_portal_ship_ledger_entries");
    const snapshotInsert = await client.query(`
        insert into bc_web_portal_ship_ledger_entries
        select * from tmp_bc_web_portal_ship_ledger_entries
      `);
    const fixedAssetCards = await client.query("select count(*)::int as count from tmp_bc_fixed_asset_cards");
    const openShipments = await client.query("select count(*)::int as count from tmp_bc_web_portal_ship_ledger_entries");
    await client.query("commit");

    return {
      fixedAssetCards: Number(fixedAssetCards.rows[0]?.count ?? 0),
      openShipments: Number(openShipments.rows[0]?.count ?? 0),
      branchesInserted: branchInsert.rowCount ?? 0,
      assetsUpdated: assetUpdate.rowCount ?? 0,
      missingAssetsInserted: missingAssetInsert.rowCount ?? 0,
      assetMappingsUpserted: mappingUpsert.rowCount ?? 0,
      staleOnRentCleared: staleOnRent.rowCount ?? 0,
      snapshotRows: snapshotInsert.rowCount ?? 0,
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}

async function fetchAllOData(
  tokenState: { value: string },
  serviceName: string,
  input: { pageSize: number; filter?: string; select?: string[] },
) {
  const rows: Row[] = [];
  for (let skip = 0; ; skip += input.pageSize) {
    const url = buildODataCollectionUrl(serviceName, input.pageSize, skip, input.filter, input.select);
    let response = await fetch(url, {
      headers: { Authorization: `Bearer ${tokenState.value}`, Accept: "application/json" },
    });
    if (response.status === 401) {
      tokenState.value = await getAccessToken();
      response = await fetch(url, {
        headers: { Authorization: `Bearer ${tokenState.value}`, Accept: "application/json" },
      });
    }
    const payload = (await response.json()) as { value?: Row[]; error?: { message?: string } };
    if (!response.ok) {
      throw new Error(payload.error?.message || `${serviceName} failed with HTTP ${response.status}`);
    }
    const page = Array.isArray(payload.value) ? payload.value : [];
    rows.push(...page);
    console.log(`[${serviceName}] fetched ${rows.length}`);
    if (page.length < input.pageSize) {
      return rows;
    }
  }
}

function mapFixedAssetCard(row: Row): Row | null {
  const assetNumber = text(row, "No");
  if (!assetNumber) return null;
  return {
    asset_number: assetNumber,
    is_on_rent: bool(row, "RMI_On_Rent"),
    is_in_service: bool(row, "RMI_In_Service"),
    is_blocked: bool(row, "Blocked"),
    is_inactive: bool(row, "Inactive"),
    is_disposed: bool(row, "RMI_Disposed"),
    under_maintenance: bool(row, "Under_Maintenance"),
    fa_class_code: text(row, "FA_Class_Code"),
    fa_subclass_code: text(row, "FA_Subclass_Code"),
    bc_location_code: text(row, "FA_Location_Code") || text(row, "RMI_Location_Code"),
    bc_dimension1_code: text(row, "RMI_Global_Dimension_1_Code"),
    bc_product_no: text(row, "RMI_Product_No"),
    bc_service_item_no: text(row, "RMI_Service_Item_No"),
    source_payload: JSON.stringify(row),
  };
}

function mapWebPortalShipment(row: Row, runId: string): Row | null {
  const entryNo = text(row, "Entry_No");
  if (!entryNo) return null;
  return {
    id: `bcwpsle:${entryNo}`,
    run_id: runId,
    external_entry_no: entryNo,
    posting_date: dateText(row, "PostingDate"),
    transaction_type: text(row, "TransactionType"),
    type: text(row, "Type"),
    asset_number: text(row, "No"),
    location_code: text(row, "LocationCode"),
    quantity: numeric(row, "Quantity"),
    quantity_remaining: numeric(row, "QuantityRemaining"),
    open: bool(row, "Open"),
    document_type: text(row, "DocumentType"),
    document_no: text(row, "DocumentNo"),
    rental_line_type: text(row, "RentalLineType"),
    sell_to_customer_no: text(row, "SellToCustomerNo"),
    customer_type: text(row, "Customer_Type"),
    parent_no: text(row, "Parent_No"),
    sell_to_customer_name: text(row, "Sell_to_Customer_Name"),
    ship_to_city: text(row, "ShipToCity"),
    ship_to_county: text(row, "ShipToCounty"),
    ship_to_post_code: text(row, "ShipToPost"),
    ship_to_address: text(row, "ShipToAddress"),
    description: text(row, "Description"),
    show_open: text(row, "ShowOpen"),
    source_payload: JSON.stringify(row),
    imported_at: new Date(),
  };
}

async function bulkInsert(pool: Queryable, tableName: string, rows: Row[]) {
  if (rows.length === 0) return;
  const chunkSize = 500;
  for (let index = 0; index < rows.length; index += chunkSize) {
    const chunk = rows.slice(index, index + chunkSize);
    const columns = Object.keys(chunk[0]);
    const values: unknown[] = [];
    const tuples = chunk.map((row, rowIndex) => {
      const placeholders = columns.map((column, columnIndex) => {
        values.push(row[column]);
        return `$${rowIndex * columns.length + columnIndex + 1}`;
      });
      return `(${placeholders.join(", ")})`;
    });
    await pool.query(
      `insert into ${quoteIdent(tableName)} (${columns.map(quoteIdent).join(", ")})
       values ${tuples.join(", ")}`,
      values,
    );
  }
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

function buildODataCollectionUrl(
  serviceName: string,
  pageSize: number,
  skip: number,
  filter?: string,
  select?: string[],
) {
  const url = new URL(`${getODataRootUrl()}/${serviceName}`);
  url.searchParams.set("company", requireEnv("METRO_BC_COMPANY"));
  url.searchParams.set("$top", String(pageSize));
  if (skip > 0) url.searchParams.set("$skip", String(skip));
  if (filter) url.searchParams.set("$filter", filter);
  if (select?.length) url.searchParams.set("$select", select.join(","));
  return url.toString();
}

function getODataRootUrl() {
  return `${API_BASE_URL}/${encodeURIComponent(requireEnv("METRO_GRAPH_TENANT_ID"))}/${encodeURIComponent(requireEnv("METRO_BC_ENVIRONMENT"))}/ODataV4`;
}

function text(row: Row, key: string) {
  const value = row[key];
  return typeof value === "string" ? value.trim() : value === null || value === undefined ? null : String(value);
}

function bool(row: Row, key: string) {
  const value = row[key];
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return ["true", "yes", "1", "open"].includes(value.trim().toLowerCase());
  if (typeof value === "number") return value !== 0;
  return false;
}

function numeric(row: Row, key: string) {
  const value = row[key];
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseFloat(value.replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function dateText(row: Row, key: string) {
  const value = text(row, key);
  return value && value !== "0001-01-01" ? value : null;
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

function quoteIdent(value: string) {
  return `"${value.replace(/"/g, "\"\"")}"`;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

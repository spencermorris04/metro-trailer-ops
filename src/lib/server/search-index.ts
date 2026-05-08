import { pool } from "@/lib/db";
import type { GlobalSearchResult } from "@/lib/search-core";

type SearchIndexRow = {
  id: string;
  entity_type: string;
  entity_id: string;
  title: string;
  subtitle: string | null;
  href: string;
  branch_id: string | null;
  keywords: string[];
  score: number;
};

const entityLabels: Record<string, { type: string; source: string; badge?: string }> = {
  asset: { type: "Asset", source: "assets" },
  customer: { type: "Customer", source: "customers" },
  contract: { type: "Contract", source: "contracts" },
  invoice: { type: "Invoice", source: "invoices" },
  work_order: { type: "Work Order", source: "work_orders" },
  inspection: { type: "Inspection", source: "inspections" },
  bc_source_document: { type: "BC Source", source: "business_central" },
  bc_gl_entry: { type: "BC GL", source: "business_central", badge: "GL" },
  bc_customer_ledger_entry: {
    type: "BC Customer Ledger",
    source: "business_central",
    badge: "Customer ledger",
  },
  bc_vendor_ledger_entry: {
    type: "BC Vendor Ledger",
    source: "business_central",
    badge: "Vendor ledger",
  },
  bc_bank_ledger_entry: {
    type: "BC Bank Ledger",
    source: "business_central",
    badge: "Bank ledger",
  },
  bc_fa_ledger_entry: {
    type: "BC FA Ledger",
    source: "business_central",
    badge: "FA ledger",
  },
};

function compactText(parts: Array<string | null | undefined>) {
  return parts.filter(Boolean).join(" / ");
}

export async function ensureGlobalSearchIndexSchema() {
  await pool.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS global_search_documents (
      id text PRIMARY KEY,
      entity_type text NOT NULL,
      entity_id text NOT NULL,
      title text NOT NULL,
      subtitle text,
      href text NOT NULL,
      branch_id text REFERENCES branches(id),
      search_text text NOT NULL,
      keywords jsonb NOT NULL DEFAULT '[]'::jsonb,
      updated_at timestamp with time zone NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS global_search_documents_entity_unique
      ON global_search_documents(entity_type, entity_id)
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS global_search_documents_entity_branch_idx
      ON global_search_documents(entity_type, branch_id)
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS global_search_documents_search_text_trgm_idx
      ON global_search_documents USING gin (search_text gin_trgm_ops)
  `);
}

async function upsertFromSelect(sqlText: string) {
  await pool.query(sqlText);
}

export async function rebuildGlobalSearchIndex() {
  await ensureGlobalSearchIndexSchema();
  await pool.query("TRUNCATE global_search_documents");

  await upsertFromSelect(`
    INSERT INTO global_search_documents (id, entity_type, entity_id, title, subtitle, href, branch_id, search_text, keywords, updated_at)
    SELECT
      'asset:' || a.id,
      'asset',
      a.id,
      a.asset_number,
      concat_ws(' / ', b.code, a.type::text, nullif(a.serial_number, ''), nullif(a.registration_number, '')),
      '/assets/' || a.id,
      a.branch_id,
      concat_ws(' ', a.asset_number, a.serial_number, a.registration_number, a.bc_product_no, a.bc_service_item_no, a.gps_device_id, b.code, b.name),
      jsonb_build_array(a.asset_number, b.code, a.serial_number, a.registration_number),
      a.updated_at
    FROM assets a
    INNER JOIN branches b ON b.id = a.branch_id
    ON CONFLICT (entity_type, entity_id) DO UPDATE SET
      title = excluded.title,
      subtitle = excluded.subtitle,
      href = excluded.href,
      branch_id = excluded.branch_id,
      search_text = excluded.search_text,
      keywords = excluded.keywords,
      updated_at = excluded.updated_at
  `);

  await upsertFromSelect(`
    INSERT INTO global_search_documents (id, entity_type, entity_id, title, subtitle, href, branch_id, search_text, keywords, updated_at)
    SELECT
      'customer:' || c.id,
      'customer',
      c.id,
      c.name,
      concat_ws(' / ', c.customer_number, c.customer_type::text),
      '/customers/' || c.id,
      null,
      concat_ws(' ', c.name, c.customer_number, c.branch_coverage::text, c.contact_info::text, c.billing_address::text),
      jsonb_build_array(c.customer_number, c.name),
      c.updated_at
    FROM customers c
    ON CONFLICT (entity_type, entity_id) DO UPDATE SET
      title = excluded.title,
      subtitle = excluded.subtitle,
      href = excluded.href,
      branch_id = excluded.branch_id,
      search_text = excluded.search_text,
      keywords = excluded.keywords,
      updated_at = excluded.updated_at
  `);

  await upsertFromSelect(`
    INSERT INTO global_search_documents (id, entity_type, entity_id, title, subtitle, href, branch_id, search_text, keywords, updated_at)
    SELECT
      'contract:' || c.id,
      'contract',
      c.id,
      c.contract_number,
      concat_ws(' / ', cust.name, b.code, c.source_document_no),
      '/contracts/' || c.id,
      c.branch_id,
      concat_ws(' ', c.contract_number, cust.name, cust.customer_number, b.code, b.name, c.source_document_no),
      jsonb_build_array(c.contract_number, cust.customer_number, b.code),
      c.updated_at
    FROM contracts c
    INNER JOIN customers cust ON cust.id = c.customer_id
    INNER JOIN branches b ON b.id = c.branch_id
    ON CONFLICT (entity_type, entity_id) DO UPDATE SET
      title = excluded.title,
      subtitle = excluded.subtitle,
      href = excluded.href,
      branch_id = excluded.branch_id,
      search_text = excluded.search_text,
      keywords = excluded.keywords,
      updated_at = excluded.updated_at
  `);

  await upsertFromSelect(`
    INSERT INTO global_search_documents (id, entity_type, entity_id, title, subtitle, href, branch_id, search_text, keywords, updated_at)
    SELECT
      'invoice:' || i.id,
      'invoice',
      i.id,
      i.invoice_number,
      concat_ws(' / ', cust.name, ct.contract_number, b.code),
      '/ar/invoices?q=' || i.invoice_number,
      ct.branch_id,
      concat_ws(' ', i.invoice_number, cust.name, cust.customer_number, ct.contract_number, b.code, i.source_document_no),
      jsonb_build_array(i.invoice_number, cust.customer_number, ct.contract_number),
      i.updated_at
    FROM invoices i
    INNER JOIN customers cust ON cust.id = i.customer_id
    LEFT JOIN contracts ct ON ct.id = i.contract_id
    LEFT JOIN branches b ON b.id = ct.branch_id
    ON CONFLICT (entity_type, entity_id) DO UPDATE SET
      title = excluded.title,
      subtitle = excluded.subtitle,
      href = excluded.href,
      branch_id = excluded.branch_id,
      search_text = excluded.search_text,
      keywords = excluded.keywords,
      updated_at = excluded.updated_at
  `);

  await upsertFromSelect(`
    INSERT INTO global_search_documents (id, entity_type, entity_id, title, subtitle, href, branch_id, search_text, keywords, updated_at)
    SELECT
      'work_order:' || w.id,
      'work_order',
      w.id,
      w.title,
      concat_ws(' / ', a.asset_number, b.code, w.id),
      '/maintenance',
      w.branch_id,
      concat_ws(' ', w.id, w.title, w.description, w.symptom_summary, a.asset_number, a.serial_number, b.code, b.name),
      jsonb_build_array(w.id, a.asset_number, b.code),
      w.updated_at
    FROM work_orders w
    INNER JOIN assets a ON a.id = w.asset_id
    INNER JOIN branches b ON b.id = w.branch_id
    ON CONFLICT (entity_type, entity_id) DO UPDATE SET
      title = excluded.title,
      subtitle = excluded.subtitle,
      href = excluded.href,
      branch_id = excluded.branch_id,
      search_text = excluded.search_text,
      keywords = excluded.keywords,
      updated_at = excluded.updated_at
  `);

  await upsertFromSelect(`
    INSERT INTO global_search_documents (id, entity_type, entity_id, title, subtitle, href, branch_id, search_text, keywords, updated_at)
    SELECT
      'inspection:' || i.id,
      'inspection',
      i.id,
      concat_ws(' ', a.asset_number, i.inspection_type::text),
      concat_ws(' / ', i.external_inspection_id, b.code, i.id),
      '/inspections',
      a.branch_id,
      concat_ws(' ', i.id, i.external_inspection_id, i.external_unit_id, a.asset_number, a.serial_number, b.code, b.name),
      jsonb_build_array(i.id, i.external_inspection_id, a.asset_number, b.code),
      i.updated_at
    FROM inspections i
    INNER JOIN assets a ON a.id = i.asset_id
    INNER JOIN branches b ON b.id = a.branch_id
    ON CONFLICT (entity_type, entity_id) DO UPDATE SET
      title = excluded.title,
      subtitle = excluded.subtitle,
      href = excluded.href,
      branch_id = excluded.branch_id,
      search_text = excluded.search_text,
      keywords = excluded.keywords,
      updated_at = excluded.updated_at
  `);

  await upsertFromSelect(`
    INSERT INTO global_search_documents (id, entity_type, entity_id, title, subtitle, href, branch_id, search_text, keywords, updated_at)
    SELECT
      'bc_source_document:' || id,
      'bc_source_document',
      id,
      document_no,
      concat_ws(' / ', document_type, customer_external_id),
      '/source-documents',
      null,
      concat_ws(' ', document_no, external_document_id, customer_external_id, document_type, status),
      jsonb_build_array(document_no, external_document_id, customer_external_id),
      imported_at
    FROM bc_source_documents
    ON CONFLICT (entity_type, entity_id) DO UPDATE SET
      title = excluded.title,
      subtitle = excluded.subtitle,
      href = excluded.href,
      branch_id = excluded.branch_id,
      search_text = excluded.search_text,
      keywords = excluded.keywords,
      updated_at = excluded.updated_at
  `);

  const ledgerSources = [
    ["bc_gl_entry", "bc_gl_entries", "coalesce(document_no, external_entry_no)", "concat_ws(' / ', account_no, description, external_entry_no)", "'/gl/journal'", "concat_ws(' ', external_entry_no, document_no, account_no, description)"],
    ["bc_customer_ledger_entry", "bc_customer_ledger_entries", "coalesce(document_no, external_entry_no)", "concat_ws(' / ', customer_no, external_entry_no)", "'/source-documents'", "concat_ws(' ', external_entry_no, document_no, customer_no)"],
    ["bc_vendor_ledger_entry", "bc_vendor_ledger_entries", "coalesce(document_no, external_entry_no)", "concat_ws(' / ', vendor_no, external_entry_no)", "'/ap/bills'", "concat_ws(' ', external_entry_no, document_no, vendor_no)"],
    ["bc_bank_ledger_entry", "bc_bank_ledger_entries", "coalesce(document_no, external_entry_no)", "concat_ws(' / ', bank_account_no, external_entry_no)", "'/cash'", "concat_ws(' ', external_entry_no, document_no, bank_account_no)"],
    ["bc_fa_ledger_entry", "bc_fa_ledger_entries", "coalesce(document_no, external_entry_no)", "concat_ws(' / ', asset_no, external_entry_no)", "'/assets'", "concat_ws(' ', external_entry_no, document_no, asset_no)"],
  ];

  for (const [entityType, tableName, title, subtitle, href, searchText] of ledgerSources) {
    await upsertFromSelect(`
      INSERT INTO global_search_documents (id, entity_type, entity_id, title, subtitle, href, branch_id, search_text, keywords, updated_at)
      SELECT
        '${entityType}:' || id,
        '${entityType}',
        id,
        ${title},
        ${subtitle},
        ${href},
        null,
        ${searchText},
        jsonb_build_array(external_entry_no, document_no),
        imported_at
      FROM ${tableName}
      ON CONFLICT (entity_type, entity_id) DO UPDATE SET
        title = excluded.title,
        subtitle = excluded.subtitle,
        href = excluded.href,
        branch_id = excluded.branch_id,
        search_text = excluded.search_text,
        keywords = excluded.keywords,
        updated_at = excluded.updated_at
    `);
  }

  const { rows } = await pool.query<{ count: string }>(
    "SELECT count(*)::text AS count FROM global_search_documents",
  );
  return Number(rows[0]?.count ?? 0);
}

export async function queryGlobalSearchIndex(query: string, store?: string | null) {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }

  await ensureGlobalSearchIndexSchema();
  const pattern = `%${trimmed.replace(/[%_]/g, "\\$&")}%`;
  const storePattern = store && store !== "all" ? `%${store.replace(/[%_]/g, "\\$&")}%` : null;
  const { rows } = await pool.query<SearchIndexRow>(
    `
      SELECT
        id,
        entity_type,
        entity_id,
        title,
        subtitle,
        href,
        branch_id,
        keywords,
        CASE
          WHEN lower(title) = lower($1) THEN 100
          WHEN lower(title) LIKE lower($1) || '%' THEN 85
          WHEN title ILIKE $2 THEN 70
          WHEN coalesce(subtitle, '') ILIKE $2 THEN 60
          ELSE 40
        END AS score
      FROM global_search_documents
      WHERE search_text ILIKE $2
        AND ($3::text IS NULL OR branch_id = $3 OR search_text ILIKE $4)
      ORDER BY
        CASE
          WHEN lower(title) = lower($1) THEN 0
          WHEN lower(title) LIKE lower($1) || '%' THEN 1
          ELSE 2
        END,
        updated_at DESC
      LIMIT 36
    `,
    [trimmed, pattern, store && store !== "all" ? store : null, storePattern],
  );

  return rows.map((row): GlobalSearchResult => {
    const entity = entityLabels[row.entity_type] ?? {
      type: row.entity_type,
      source: "workspace",
    };
    return {
      id: row.id,
      type: entity.type,
      title: row.title,
      subtitle: row.subtitle ?? compactText(row.keywords),
      href: row.href,
      badge: entity.badge,
      source: entity.source,
      score: Number(row.score ?? 0),
    };
  });
}
